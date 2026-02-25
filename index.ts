// Polyfills — must be imported before anything else
import 'react-native-url-polyfill/auto';
import 'text-encoding-polyfill';
import 'web-streams-polyfill/polyfill';
import 'event-target-polyfill';
import { decode, encode } from 'base-64';

if (!global.btoa) global.btoa = encode;
if (!global.atob) global.atob = decode;

// Register TrackPlayer background service before app mounts
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/features/player/service';
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Hand off to expo-router (file-based routing from src/app/)
import 'expo-router/entry';
