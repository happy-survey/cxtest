// Mock implementation for testing without building the plugin
export const CXONEVoice = {
  initialize: async (options) => {
    console.log('Mock: Initializing CXONE Voice plugin', options);
    return Promise.resolve();
  },

  makeCall: async (options) => {
    console.log('Mock: Making call', options);
    return Promise.resolve({
      callId: `mock-call-${Date.now()}`,
      state: 'dialing'
    });
  },

  answerCall: async (options) => {
    console.log('Mock: Answering call', options);
    return Promise.resolve();
  },

  endCall: async (options) => {
    console.log('Mock: Ending call', options);
    return Promise.resolve();
  },

  muteCall: async (options) => {
    console.log('Mock: Muting call', options);
    return Promise.resolve();
  },

  holdCall: async (options) => {
    console.log('Mock: Holding call', options);
    return Promise.resolve();
  },

  resumeCall: async (options) => {
    console.log('Mock: Resuming call', options);
    return Promise.resolve();
  },

  playRecording: async (options) => {
    console.log('Mock: Playing recording', options);
    return Promise.resolve();
  },

  stopRecording: async (options) => {
    console.log('Mock: Stopping recording', options);
    return Promise.resolve();
  },

  getActiveCall: async () => {
    console.log('Mock: Getting active call');
    return Promise.resolve(null);
  },

  checkPermissions: async () => {
    console.log('Mock: Checking permissions');
    return Promise.resolve({
      microphone: 'granted',
      notifications: 'granted',
      phone: 'granted'
    });
  },

  requestPermissions: async () => {
    console.log('Mock: Requesting permissions');
    return Promise.resolve({
      microphone: 'granted',
      notifications: 'granted',
      phone: 'granted'
    });
  },

  addListener: (eventName, callback) => {
    console.log(`Mock: Adding listener for ${eventName}`);
    // Simulate some events for testing
    if (eventName === 'callStateChanged') {
      setTimeout(() => {
        callback({
          callId: 'mock-call',
          previousState: 'dialing',
          currentState: 'connected'
        });
      }, 2000);
    }
    return Promise.resolve({ remove: () => {} });
  },

  removeAllListeners: async () => {
    console.log('Mock: Removing all listeners');
    return Promise.resolve();
  }
};