/**
 * Example environment configuration for CXONE Voice Demo App
 * 
 * IMPORTANT: This app requires valid CXONE credentials to function.
 * There is no fallback to Google STUN/TURN servers or demo mode.
 * 
 * To use this app:
 * 1. Copy this file to environment.ts
 * 2. Replace all placeholder values with your actual CXONE credentials
 * 3. Ensure your CXONE account has WebRTC capabilities enabled
 */

export const environment = {
  production: false,
  cxone: {
    // Agent credentials (REQUIRED)
    agentId: 'your-agent-id', // Your CXONE agent ID
    apiKey: 'your-api-key',   // Your CXONE API key
    
    // OAuth configuration (REQUIRED)
    tenantId: 'your-tenant-id', // REQUIRED - Your CXONE tenant ID
    clientId: 'your-client-id', // REQUIRED - Your OAuth client ID
    clientSecret: '',           // Optional - Only for confidential clients
    
    // Environment settings
    environment: 'development' as const, // 'development' | 'staging' | 'production'
    defaultSkillId: 'your-default-skill-id',
    
    // CXONE WebRTC configuration (optional - defaults will be used based on environment)
    // If not specified, the following defaults will be used:
    // Development: stun/turn-dev.cxone.nice.com:3478
    // Staging: stun/turn-staging.cxone.nice.com:3478
    // Production: stun/turn.cxone.nice.com:3478
    stunServers: [
      'stun:stun-dev.cxone.nice.com:3478' // Development CXONE STUN server
    ],
    turnServers: [
      'turn:turn-dev.cxone.nice.com:3478' // Development CXONE TURN server
    ],
    turnUsername: 'cxone',     // TURN server username
    turnCredential: 'cxone'    // TURN server credential
  }
};