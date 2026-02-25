const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Required for youtubei.js — resolves the react-native export in package.json
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
