// Network utility functions for adaptive streaming quality.
// Placeholder — will use NetInfo or similar in Phase 2.

export type ConnectionType = 'wifi' | 'cellular' | 'unknown';

export function getCurrentConnectionType(): ConnectionType {
  // TODO: Implement with @react-native-community/netinfo
  return 'wifi';
}
