const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package
config.watchFolders = [path.resolve(workspaceRoot, 'shared')];

// Resolve @kirimin/shared
config.resolver.extraNodeModules = {
  '@kirimin/shared': path.resolve(workspaceRoot, 'shared/src/index.ts'),
};

module.exports = config;

