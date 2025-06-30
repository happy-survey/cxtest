# Capacitor CXONE Voice Plugin

A comprehensive Capacitor plugin for integrating CXONE voice capabilities into your iOS, Android, and PWA applications. This plugin provides native call UI integration, CXONE WebRTC infrastructure, and advanced audio features.

**Important**: This plugin exclusively uses CXONE WebRTC servers. Google STUN/TURN servers or other fallback options are not supported.

## Features

- **Native Call UI Integration**
  - iOS: CallKit integration for native phone UI
  - Android: ConnectionService for system dialer integration
  - PWA: WebRTC-based calling with custom UI

- **Core Voice Features**
  - Inbound and outbound calling
  - Call muting/unmuting
  - Call hold/resume
  - Call transfer (blind and attended)
  - Audio recording playback during calls

- **Advanced Capabilities**
  - CXONE WebRTC infrastructure (Google STUN/TURN not supported)
  - Audio level monitoring
  - Push notifications for incoming calls
  - Background call handling
  - Bluetooth headset support

## Installation

```bash
npm install capacitor-cxone-voice
npx cap sync
```

### iOS Setup

1. Add required capabilities in Xcode:
   - Background Modes: Voice over IP, Audio
   - Push Notifications

2. Add to your `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app requires microphone access for voice calls.</string>
<key>UIBackgroundModes</key>
<array>
  <string>voip</string>
  <string>audio</string>
</array>
```

### Android Setup

1. Add to your `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<service
  android:name="com.cxone.voice.CallConnectionService"
  android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE">
  <intent-filter>
    <action android:name="android.telecom.ConnectionService" />
  </intent-filter>
</service>
```

2. Add Firebase configuration for push notifications

### Web/PWA Setup

No additional setup required. The plugin uses native WebRTC APIs available in modern browsers.

## Usage

### Initialize the Plugin

```typescript
import { CXONEVoice } from 'capacitor-cxone-voice';

// Initialize with your CXONE credentials (required)
await CXONEVoice.initialize({
  agentId: 'your-agent-id',
  apiKey: 'your-api-key',
  environment: 'production',
  
  // Required CXONE configuration
  tenantId: 'your-tenant-id', // REQUIRED
  clientId: 'your-client-id', // REQUIRED
  
  // Optional platform-specific features
  enableCallKit: true, // iOS only
  enableConnectionService: true, // Android only
  enablePushNotifications: true
});
```

### Making Outbound Calls

```typescript
const { callId } = await CXONEVoice.makeCall({
  phoneNumber: '+1234567890',
  callerId: '+0987654321', // Optional
  displayName: 'John Doe', // Optional
  metadata: { // Optional custom data
    customerId: '12345',
    campaign: 'sales'
  }
});
```

### Handling Incoming Calls

```typescript
// Listen for incoming calls
CXONEVoice.addListener('incomingCall', (event) => {
  console.log('Incoming call:', event);
  // Show UI for accepting/declining call
  
  // Answer the call
  await CXONEVoice.answerCall({ callId: event.callId });
});
```

### Managing Active Calls

```typescript
// Mute/unmute
await CXONEVoice.muteCall({ 
  callId: activeCallId, 
  muted: true 
});

// Hold/resume
await CXONEVoice.holdCall({ callId: activeCallId });
await CXONEVoice.resumeCall({ callId: activeCallId });

// End call
await CXONEVoice.endCall({ 
  callId: activeCallId,
  reason: 'user_initiated' 
});
```

### Playing Recordings During Calls

```typescript
// Play a recording
await CXONEVoice.playRecording({
  callId: activeCallId,
  recordingUrl: 'https://example.com/recording.mp3',
  volume: 0.7, // 0.0 to 1.0
  loop: false
});

// Stop recording playback
await CXONEVoice.stopRecording({ callId: activeCallId });

// Listen for playback events
CXONEVoice.addListener('recordingPlaybackStateChanged', (event) => {
  console.log('Recording state:', event.state); // 'started', 'stopped', 'completed', 'error'
});
```

### Monitoring Call State

```typescript
// Listen for call state changes
CXONEVoice.addListener('callStateChanged', (event) => {
  console.log(`Call ${event.callId} state changed:`, {
    from: event.previousState,
    to: event.currentState
  });
});

// Get active call
const activeCall = await CXONEVoice.getActiveCall();
if (activeCall) {
  console.log('Active call:', activeCall);
}
```

### Audio Level Monitoring

```typescript
// Listen for audio levels
CXONEVoice.addListener('audioLevelChanged', (event) => {
  console.log('Audio levels:', {
    local: event.localLevel, // 0.0 to 1.0
    remote: event.remoteLevel // 0.0 to 1.0
  });
});
```

### Permissions

```typescript
// Check permissions
const permissions = await CXONEVoice.checkPermissions();
console.log('Permissions:', permissions);

// Request permissions
const granted = await CXONEVoice.requestPermissions();
console.log('Permissions granted:', granted);
```

### Push Notifications (iOS)

```typescript
// Register for push notifications
const { pushToken } = await CXONEVoice.registerForPushNotifications();
console.log('VoIP push token:', pushToken);
```

## API Reference

### Methods

#### `initialize(options: InitializeOptions): Promise<void>`
Initialize the plugin with CXONE credentials.

#### `makeCall(options: MakeCallOptions): Promise<CallResult>`
Make an outbound call.

#### `answerCall(options: AnswerCallOptions): Promise<void>`
Answer an incoming call.

#### `endCall(options: EndCallOptions): Promise<void>`
End an active call.

#### `muteCall(options: MuteCallOptions): Promise<void>`
Mute or unmute the microphone.

#### `playRecording(options: PlayRecordingOptions): Promise<void>`
Play an audio recording during a call.

#### `stopRecording(options: StopRecordingOptions): Promise<void>`
Stop playing a recording.

#### `holdCall(options: HoldCallOptions): Promise<void>`
Put a call on hold.

#### `resumeCall(options: ResumeCallOptions): Promise<void>`
Resume a held call.

#### `getActiveCall(): Promise<CallInfo | null>`
Get information about the currently active call.

#### `getActiveCalls(): Promise<CallInfo[]>`
Get all active calls.

#### `checkPermissions(): Promise<PermissionStatus>`
Check current permission status.

#### `requestPermissions(): Promise<PermissionStatus>`
Request required permissions.

### Events

- `incomingCall` - Fired when an incoming call is received
- `callStateChanged` - Fired when call state changes
- `audioLevelChanged` - Fired periodically with audio levels
- `recordingPlaybackStateChanged` - Fired when recording playback state changes
- `error` - Fired when an error occurs

### Types

See [definitions.ts](src/definitions.ts) for complete type definitions.

## Example App

Check the [example](example/) directory for a complete example application demonstrating all features.

## Development

### Building the Plugin

```bash
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### iOS Development

```bash
cd ios
pod install
open Plugin.xcworkspace
```

### Android Development

Open the `android/` directory in Android Studio.

## Troubleshooting

### iOS Issues

1. **CallKit not working**: Ensure VoIP background mode is enabled
2. **No incoming calls**: Check push notification setup and VoIP certificate
3. **Audio issues**: Verify audio session configuration

### Android Issues

1. **ConnectionService not working**: Check MANAGE_OWN_CALLS permission
2. **No audio**: Verify RECORD_AUDIO permission is granted
3. **Call UI not showing**: Ensure phone account is registered

### Web/PWA Issues

1. **No microphone access**: Check browser permissions
2. **WebRTC connection fails**: Verify STUN/TURN server configuration

## Contributing

Contributions are welcome! Please read our [contributing guide](CONTRIBUTING.md) for details.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/capacitor-cxone-voice/issues).