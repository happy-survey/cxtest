export const environment = {
  production: true,
  cxone: {
    // Agent credentials (REQUIRED)
    agentId: '', // REQUIRED - Set via environment variable
    apiKey: '', // REQUIRED - Set via environment variable
    
    // OAuth configuration (REQUIRED)
    tenantId: '', // REQUIRED - Set via environment variable
    clientId: '', // REQUIRED - Set via environment variable
    clientSecret: '', // Optional - for confidential clients
    
    // Environment settings
    environment: 'production' as const,
    defaultSkillId: '',
    
    // CXONE WebRTC configuration (optional - defaults will be used)
    stunServers: [
      'stun:stun.cxone.nice.com:3478' // Production CXONE STUN server
    ],
    turnServers: [
      'turn:turn.cxone.nice.com:3478' // Production CXONE TURN server
    ],
    turnUsername: 'cxone',
    turnCredential: 'cxone'
  }
};