import type { RadioStrategy } from '@/features/radio/types';
import type { MusicTrack } from '@/features/youtube/types';
import type { ScoredCandidate } from './types';
import { getRadioTracks } from '@/features/youtube/radio';
import { getSimilarTracks } from '@/features/metadata/lastfm';
import { searchMusic } from '@/features/youtube/search';
import { useSettingsStore } from '@/core/store/settingsStore';
import { usePlayerStore } from '@/core/store/playerStore';
import { getArtistScore, normalizeArtistKey } from './tasteProfile';
import { getTrackEngagement, getTotalPlayCount } from './engagement';

// Scoring weights
const WEIGHT_ARTIST_AFFINITY = 0.4;
const PENALTY_RECENTLY_PLAYED = -100;
const PENALTY_RECENTLY_SKIPPED = -50;
const PENALTY_FREQUENT_SKIP = -20;
const BONUS_COMPLETED = 10;
const BONUS_EXPLORATION = 2;

// Epsilon-greedy: 80% exploit, 20% explore
const EXPLOIT_RATIO = 0.8;

// Cold start threshold — below this, rely purely on YouTube Up Next
const COLD_START_THRESHOLD = 20;

// Recency windows
const RECENTLY_PLAYED_MS = 2 * 60 * 60 * 1000; // 2 hours
const RECENTLY_SKIPPED_MS = 1 * 60 * 60 * 1000; // 1 hour

export const smartAutoplay: RadioStrategy = {
  name: 'Smart Autoplay',

  async generateTracks(seedVideoId: string): Promise<MusicTrack[]> {
    const totalPlays = await getTotalPlayCount();
    const isColdStart = totalPlays < COLD_START_THRESHOLD;

    // Phase 1: Generate candidates
    const candidates = await generateCandidates(seedVideoId);

    if (candidates.length === 0) return [];

    // Cold start: just return YouTube Up Next order (system works like before)
    if (isColdStart) {
      if (__DEV__) console.log('[smartAutoplay] Cold start — using YouTube order');
      return candidates.map((c) => c.track);
    }

    // Phase 2: Score candidates
    const scored = await scoreCandidates(candidates);

    // Phase 3: Select via epsilon-greedy
    const selected = epsilonGreedySelect(scored);

    // Phase 4: Interleave for variety
    const result = interleave(selected);

    if (__DEV__) {
      console.log(`[smartAutoplay] ${result.length} tracks selected from ${candidates.length} candidates`);
      result.slice(0, 3).forEach((t, i) =>
        console.log(`  ${i + 1}. ${t.title} - ${t.artist}`)
      );
    }

    return result;
  },
};

// Phase 1: Gather candidates from multiple sources.
async function generateCandidates(seedVideoId: string): Promise<ScoredCandidate[]> {
  const candidates: ScoredCandidate[] = [];

  // Get current track info for Last.fm lookup
  const store = usePlayerStore.getState();
  const currentTrack = store.queue.find((t) => t.id === seedVideoId);

  // YouTube Up Next (primary source)
  const youtubePromise = getRadioTracks(seedVideoId)
    .then((tracks) =>
      tracks.map((t) => ({ track: t, score: 0, source: 'youtube' as const }))
    )
    .catch(() => [] as ScoredCandidate[]);

  // Last.fm similar tracks (if API key configured)
  const lastfmPromise = fetchLastFmCandidates(currentTrack);

  const [ytCandidates, lfmCandidates] = await Promise.all([
    youtubePromise,
    lastfmPromise,
  ]);

  candidates.push(...ytCandidates, ...lfmCandidates);

  // Deduplicate by track ID
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.track.id)) return false;
    seen.add(c.track.id);
    return true;
  });
}

// Fetch similar tracks from Last.fm and resolve them via YouTube search.
async function fetchLastFmCandidates(
  currentTrack: MusicTrack | undefined
): Promise<ScoredCandidate[]> {
  if (!currentTrack) return [];

  const { lastFmApiKey } = useSettingsStore.getState();
  if (!lastFmApiKey) return [];

  try {
    const { setLastFmApiKey } = await import('@/features/metadata/lastfm');
    setLastFmApiKey(lastFmApiKey);

    const similar = await getSimilarTracks(
      currentTrack.artist,
      currentTrack.title,
      10
    );

    if (!similar || similar.length === 0) return [];

    // Search YouTube for the top 5 Last.fm results (limit to avoid too many API calls)
    const results: ScoredCandidate[] = [];
    for (const item of similar.slice(0, 5)) {
      const name = item.name ?? item.title;
      const artist = item.artist?.name ?? item.artist;
      if (!name || !artist) continue;

      try {
        const searchResult = await searchMusic(`${artist} ${name}`);
        const match = searchResult.tracks[0];
        if (match) {
          results.push({ track: match, score: 0, source: 'lastfm' });
        }
      } catch {
        // Skip failed searches
      }
    }

    return results;
  } catch (err) {
    if (__DEV__) console.warn('[smartAutoplay] Last.fm fetch failed:', err);
    return [];
  }
}

// Phase 2: Score each candidate based on taste profile + engagement.
async function scoreCandidates(
  candidates: ScoredCandidate[]
): Promise<ScoredCandidate[]> {
  const now = Date.now();

  for (const candidate of candidates) {
    let score = 0;

    // Artist affinity (40% weight)
    const artistScore = await getArtistScore(candidate.track.artist);
    score += artistScore * WEIGHT_ARTIST_AFFINITY;

    // Track-level engagement
    const engagement = await getTrackEngagement(candidate.track.id);
    if (engagement) {
      // Bonus for previously completed tracks
      if (engagement.play_count > 0 && engagement.skip_count === 0) {
        score += BONUS_COMPLETED;
      }

      // Penalty for frequently skipped tracks
      if (engagement.skip_count > engagement.play_count * 0.5) {
        score += PENALTY_FREQUENT_SKIP;
      }

      // Penalty for recently played (avoid repetition)
      if (
        engagement.last_played_at &&
        now - engagement.last_played_at < RECENTLY_PLAYED_MS
      ) {
        score += PENALTY_RECENTLY_PLAYED;
      }

      // Penalty for recently skipped
      if (
        engagement.last_skipped_at &&
        now - engagement.last_skipped_at < RECENTLY_SKIPPED_MS
      ) {
        score += PENALTY_RECENTLY_SKIPPED;
      }
    } else {
      // Unknown artist = exploration bonus
      const key = normalizeArtistKey(candidate.track.artist);
      const knownArtist = artistScore > 0;
      if (!knownArtist) {
        score += BONUS_EXPLORATION;
      }
    }

    candidate.score = score;
  }

  return candidates;
}

// Phase 3: Epsilon-greedy selection.
// 80% of picks from top-scored, 20% random from positive-score pool.
function epsilonGreedySelect(
  candidates: ScoredCandidate[]
): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  // Sort by score descending
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  const targetCount = Math.min(sorted.length, 15);
  const exploitCount = Math.ceil(targetCount * EXPLOIT_RATIO);
  const exploreCount = targetCount - exploitCount;

  // Exploit: top candidates by score
  const exploitPicks = sorted.slice(0, exploitCount);

  // Explore: random picks from remaining candidates with score > -50
  const remaining = sorted
    .slice(exploitCount)
    .filter((c) => c.score > -50);
  const explorePicks: ScoredCandidate[] = [];
  const remainingCopy = [...remaining];

  for (let i = 0; i < exploreCount && remainingCopy.length > 0; i++) {
    const idx = Math.floor(Math.random() * remainingCopy.length);
    explorePicks.push(remainingCopy.splice(idx, 1)[0]);
  }

  return [...exploitPicks, ...explorePicks];
}

// Phase 4: Interleave exploit and explore picks for variety.
// Avoids front-loading all "safe" picks.
function interleave(candidates: ScoredCandidate[]): MusicTrack[] {
  if (candidates.length <= 2) return candidates.map((c) => c.track);

  const result: MusicTrack[] = [];
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  // Take from top and bottom alternately
  let lo = 0;
  let hi = sorted.length - 1;
  let fromTop = true;

  while (lo <= hi) {
    if (fromTop) {
      result.push(sorted[lo].track);
      lo++;
    } else {
      result.push(sorted[hi].track);
      hi--;
    }
    fromTop = !fromTop;
  }

  return result;
}
