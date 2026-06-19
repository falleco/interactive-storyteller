import 'tsx/cjs';

module.exports = () => ({
  expo: {
    name: 'Merlim Stories',
    slug: 'wondertales',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'wondertales',
    userInterfaceStyle: 'automatic',
    assetBundlePatterns: ['assets/images/**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.wondertalesai.app',
      infoPlist: {
        NSMotionUsageDescription:
          'This app uses motion sensors to create cool parallax effects in the background.',
      },
      appleTeamId: 'D479U7HWPM',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#0573AF',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      permissions: [
        'android.permission.BODY_SENSORS',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
      ],
      predictiveBackGestureEnabled: false,
      package: 'com.wondertalesai.app',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/pixelpurl.ttf',
            './assets/fonts/tchaikovsky.ttf',
          ],
        },
      ],
      'expo-web-browser',
      'expo-sqlite',
      'expo-audio',
      'expo-secure-store',
      'expo-apple-authentication',
      [
        'expo-image-picker',
        {
          photosPermission:
            'Wonder Tales uses your photos so you can pick a profile picture for your child.',
          cameraPermission:
            'Wonder Tales needs camera access to take a profile picture for your child.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission:
            'Wonder Tales reads your recent photos to show them in the picker.',
          savePhotosPermission:
            'Wonder Tales saves story illustrations to your photo library.',
          isAccessMediaLocationEnabled: false,
        },
      ],
      'expo-image',
      'expo-status-bar',
      './plugins/withPlugin.ts',
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 29,
            extraMavenRepos: [
              '../../node_modules/@borndotcom/react-native-godot/android/libs/libgodot-android/4.5.1.migeran.2',
            ],
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
});
