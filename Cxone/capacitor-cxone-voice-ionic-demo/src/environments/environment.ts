export const environment = {
  production: false,
  cxone: {
    // Agent credentials (REQUIRED)
    agentId: '56449133',
    apiKey: 'demo-api-key',
    
    // OAuth configuration (REQUIRED)
    tenantId: '4609908', // REQUIRED - Replace with actual tenant ID
    clientId: '0b697ebb-4ea2-4052-b12b-d3cf12a53eca', // REQUIRED - Replace with actual client ID
    clientSecret: '', // Optional - for confidential clients
    
    // Environment settings
    environment: 'development' as const,
    defaultSkillId: 'your-default-skill-id',
    
    // CXONE WebRTC configuration (optional - defaults will be used based on environment)
    stunServers: [
      'stun:stun-dev.cxone.nice.com:3478' // Development CXONE STUN server
    ],
    turnServers: [
      'turn:turn-dev.cxone.nice.com:3478' // Development CXONE TURN server
    ],
    turnUsername: 'cxone',
    turnCredential: 'cxone'
  }
};