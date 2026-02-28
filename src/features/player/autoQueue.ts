import { usePlayerStore } from '@/core/store/playerStore';
import { useSettingsStore } from '@/core/store/settingsStore';
import { smartAutoplay } from '@/features/recommendation/smartAutoplay';

let isAutoQueueing = false;

// Automatically fetch related tracks when the queue runs out.
// Returns true if tracks were added, false otherwise.
export async function triggerAutoQueue(): Promise<boolean> {
  if (isAutoQueueing) return false;

  const { autoQueue } = useSettingsStore.getState();
  if (!autoQueue) {
    if (__DEV__) console.log('[autoQueue] disabled in settings');
    return false;
  }

  const store = usePlayerStore.getState();
  const { queue, currentIndex, repeatMode } = store;

  if (__DEV__) console.log('[autoQueue] state: queueLen:', queue.length, 'currentIndex:', currentIndex, 'repeatMode:', repeatMode);

  // If repeat-all is on, the queue loops — no need for auto-queue
  if (repeatMode === 'all') return false;

  // Need a current track to seed from
  const currentTrack = queue[currentIndex];
  if (!currentTrack) {
    if (__DEV__) console.log('[autoQueue] no current track at index', currentIndex);
    return false;
  }

  isAutoQueueing = true;
  try {
    console.log('[autoQueue] Fetching smart recommendations for:', currentTrack.title);
    const tracks = await smartAutoplay.generateTracks(currentTrack.id);

    if (tracks.length === 0) return false;

    // Filter out tracks already in the queue
    const existingIds = new Set(queue.map((t) => t.id));
    const newTracks = tracks.filter((t) => !existingIds.has(t.id));

    if (newTracks.length === 0) return false;

    console.log('[autoQueue] Adding', newTracks.length, 'tracks to queue');
    store.addToQueue(newTracks);
    store.setRadioMode(true);
    return true;
  } catch (err) {
    console.error('[autoQueue] Failed to fetch related tracks:', err);
    return false;
  } finally {
    isAutoQueueing = false;
  }
}
