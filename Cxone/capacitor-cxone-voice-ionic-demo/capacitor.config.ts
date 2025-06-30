import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cxone.voicedemo',
  appName: 'CXONE Voice Demo',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;