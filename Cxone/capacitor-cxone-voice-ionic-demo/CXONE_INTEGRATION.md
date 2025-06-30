# CXONE Integration Guide

The demo app now includes full CXONE SDK integration for real voice capabilities.

## Configuration

### 1. Update Environment Settings

Edit `src/environments/environment.ts` with your CXONE credentials:

```typescript
export const environment = {
  production: false,
  cxone: {
    // OAuth configuration (recommended)
    tenantId: 'your-tenant-id',
    clientId: 'your-client-id',
    clientSecret: '', // Optional - for confidential clients
    
    // Legacy credentials (if using legacy auth)
    agentId: 'your-agent-id',
    apiKey: 'your-api-key',
    
    // Environment settings
    environment: 'development', // or 'staging', 'production'
    defaultSkillId: 'your-default-skill-id', // For outbound calls
  }
};
```

### 2. Authentication Methods

The app supports two authentication methods:

#### OAuth (Recommended)
1. Go to Settings page
2. Select "OAuth" authentication mode
3. Enter your Tenant ID and Client ID
4. Click "Login to CXONE"
5. Complete the OAuth flow in your browser
6. You'll be redirected back to the app

#### Legacy API Key
1. Go to Settings page
2. Select "Legacy" authentication mode
3. Enter your Agent ID and API Key
4. Click "Save Configuration"

## Using CXONE Features

When properly configured with CXONE credentials, the app will:

1. **Make Real Calls**: 
   - Uses CXONE WebRTC for actual voice communication
   - Integrates with your contact center routing

2. **Handle Incoming Calls**:
   - Receives real incoming calls from CXONE ACD
   - Shows native call UI on mobile devices

3. **Call Controls**:
   - Mute/unmute with CXONE audio control
   - Hold/resume through CXONE API
   - Transfer calls to other agents or numbers

4. **Agent Status**:
   - Syncs with CXONE agent states
   - Updates availability in real-time

## Service Architecture

### CxoneService (`cxone.service.ts`)
- Handles CXONE SDK initialization
- Manages authentication
- Provides voice call methods
- Emits call events

### VoiceService (`voice.service.ts`)
- Abstracts between CXONE and demo modes
- Falls back to simulation if CXONE fails
- Maintains consistent API for UI components

## Required CXONE Setup

1. **Register Your Application**:
   - Register your app in CXONE Admin
   - Get OAuth credentials (Client ID, Tenant ID)
   - Configure redirect URIs

2. **Agent Permissions**:
   - Agent must have voice permissions
   - Appropriate skill assignments
   - WebRTC enabled for the agent

3. **Network Requirements**:
   - WebSocket connectivity to CXONE
   - WebRTC media ports open
   - STUN/TURN server access

## Troubleshooting

### "Not authenticated" Error
- Check OAuth credentials in environment.ts
- Ensure redirect URI matches your app URL
- Verify tenant ID is correct

### No Audio in Calls
- Check browser microphone permissions
- Verify WebRTC is not blocked
- Test STUN/TURN connectivity

### Calls Not Connecting
- Verify default skill ID exists
- Check agent is in available state
- Ensure WebSocket connection is established

## Demo Mode Fallback

If CXONE initialization fails, the app automatically falls back to demo mode:
- Simulated calls with timers
- Mock audio levels
- No actual voice communication
- Useful for UI development/testing

## Development Tips

1. **Test OAuth Flow**:
   ```bash
   # Run with HTTPS for OAuth redirects
   ionic serve --ssl
   ```

2. **Monitor CXONE Events**:
   - Open browser console
   - Look for "CXONE Service initialized" message
   - Check for WebSocket connection logs

3. **Debug Call States**:
   - Subscribe to `cxoneService.activeContact$`
   - Monitor state transitions
   - Check console for CXONE SDK errors