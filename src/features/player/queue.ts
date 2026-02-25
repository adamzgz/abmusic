import TrackPlayer, { Track } from 'react-native-track-player';

// Rolling queue management.
// Instead of adding 100+ tracks upfront (URLs expire in ~6h),
// we keep only 3-5 tracks ahead of the current one.

const LOOKAHEAD = 3;

export async function addToQueue(track: Track) {
  await TrackPlayer.add(track);
}

export async function replaceQueue(tracks: Track[]) {
  await TrackPlayer.reset();
  await TrackPlayer.add(tracks);
}

export async function getQueueSize(): Promise<number> {
  const queue = await TrackPlayer.getQueue();
  return queue.length;
}

// Returns how many tracks are ahead of the current one.
export async function getTracksAhead(): Promise<number> {
  const queue = await TrackPlayer.getQueue();
  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  if (activeIndex === undefined) return 0;
  return queue.length - 1 - activeIndex;
}

// Check if we need to add more tracks to the queue.
export async function needsMoreTracks(): Promise<boolean> {
  const ahead = await getTracksAhead();
  return ahead < LOOKAHEAD;
}
