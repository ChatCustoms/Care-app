/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  icon: 'https://github.com/expo.png',
  // Referenced from app.config.ts's ios.entitlements, not duplicated here —
  // a single source of truth so the main app and widget targets can't drift
  // apart on which App Group they share.
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
