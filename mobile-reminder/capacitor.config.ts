import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nhaminh.hr.reminder',
  appName: 'Nhân Sự Nhà Mình',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
};

export default config;
