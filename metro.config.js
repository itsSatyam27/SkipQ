const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK uses .cjs extensions
config.resolver.sourceExts.push('cjs');

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@firebase/firestore') {
    return {
      filePath: path.resolve(
        __dirname,
        platform === 'web'
          ? 'node_modules/@firebase/firestore/dist/index.esm.js'
          : 'node_modules/@firebase/firestore/dist/index.rn.js'
      ),
      type: 'sourceFile',
    };
  }
  if (moduleName === '@firebase/auth') {
    return {
      filePath: path.resolve(
        __dirname,
        platform === 'web'
          ? 'node_modules/@firebase/auth/dist/esm/index.js'
          : 'node_modules/@firebase/auth/dist/rn/index.js'
      ),
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
