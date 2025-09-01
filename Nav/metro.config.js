// Metro configuration for Expo
// Blocklist large/native folders to prevent excessive file watching and unwanted reloads
const { getDefaultConfig } = require('@expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);
config.resolver = config.resolver || {};
config.resolver.blockList = exclusionList([
  /ios\/Pods\/.*/,
  /ios\/build\/.*/,
  /android\/.*/,
  /trash\/.*/,
]);

module.exports = config;
