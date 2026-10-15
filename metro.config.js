const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Zustand v5 ships ESM (.mjs) files that use import.meta, which crashes
// when Metro bundles them into a non-module <script> for web.
// This custom resolver redirects zustand .mjs imports to their CJS equivalents.
const zustandRoot = path.resolve(__dirname, 'node_modules', 'zustand');
const originalResolveRequest = config.resolver.resolveRequest;

// Web stubs for native-only modules
const maplibreStub = path.resolve(__dirname, 'lib', 'maplibre-web-stub.js');
const taskManagerStub = path.resolve(__dirname, 'lib', 'task-manager-web-stub.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Redirect zustand ESM to CJS
    if (moduleName === 'zustand') {
      return { type: 'sourceFile', filePath: path.join(zustandRoot, 'index.js') };
    }
    if (moduleName === 'zustand/middleware') {
      return { type: 'sourceFile', filePath: path.join(zustandRoot, 'middleware.js') };
    }
    if (moduleName === 'zustand/shallow') {
      const shallow = path.join(zustandRoot, 'shallow.js');
      if (require('fs').existsSync(shallow)) {
        return { type: 'sourceFile', filePath: shallow };
      }
    }
    // Stub out native-only modules on web
    if (moduleName === '@maplibre/maplibre-react-native') {
      return { type: 'sourceFile', filePath: maplibreStub };
    }
    if (moduleName === 'expo-task-manager') {
      return { type: 'sourceFile', filePath: taskManagerStub };
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
