import { registerPlugin } from '@capacitor/core';

import type { CXONEVoicePlugin } from './definitions';

const CXONEVoice = registerPlugin<CXONEVoicePlugin>('CXONEVoice', {
  web: () => import('./web').then(m => new m.CXONEVoiceWeb()),
});

export * from './definitions';
export { CXONEVoice };