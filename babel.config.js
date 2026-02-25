module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-syntax-import-attributes',
      'react-native-reanimated/plugin', // Must be last
    ],
  };
};
