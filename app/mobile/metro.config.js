const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// @current/core is a file: dependency outside this folder, shipped as TypeScript source
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../packages/core')];

// uniwind must be the outermost wrapper
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
