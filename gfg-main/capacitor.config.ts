import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.peakx.sender',
  appName: 'Peak-X Sender',
  webDir: 'dist',
  android: {
    backgroundColor: '#0a0f1c',
    allowMixedContent: true,
  },
  ios: {
    backgroundColor: '#0a0f1c',
    contentInset: 'automatic',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0f1c',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
