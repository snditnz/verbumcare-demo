const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = {
  ...config,
  resolver: {
    ...config.resolver,
    // Ensure date-fns and other ESM packages resolve correctly
    sourceExts: [...config.resolver.sourceExts, 'cjs'],
  },
  resetCache: true, // Force cache reset on first run
  transformer: {
    ...config.transformer,
    // Enable better error messages
    minifierConfig: {
      ...config.transformer.minifierConfig,
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};
