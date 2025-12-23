const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable TypeScript checking during development
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Add resolver for better module resolution
config.resolver.alias = {
  '@': './src',
  '@components': './src/components',
  '@screens': './src/screens',
  '@services': './src/services',
  '@stores': './src/stores',
  '@utils': './src/utils',
  '@constants': './src/constants',
  '@types': './src/types',
};

module.exports = config;