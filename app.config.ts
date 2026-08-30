import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Care App',
  slug: 'care-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'careapp',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.stephanochatham.careapp',
    // supportsTablet: false — this is a phone-first caregiving app.
    supportsTablet: false,
    // App Group for the widget extension (Milestone 12) to share
    // pre-computed feed/medication status with the main app — the widget
    // never calls Supabase directly. Referenced (not duplicated) by
    // targets/widget/expo-target.config.js so the two can't drift apart.
    entitlements: {
      'com.apple.security.application-groups': ['group.com.stephanochatham.careapp'],
    },
  },
  android: {
    package: 'com.stephanochatham.careapp',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    '@bacons/apple-targets',
    './modules/expo-widget-module/app.plugin.js',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  // EXPO_PUBLIC_* variables are available at runtime via process.env.
  // They are NOT secrets — do not put private keys here.
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
