# CXONE Voice Ionic Demo App

A comprehensive Ionic Angular application demonstrating the capabilities of the CXONE Voice Capacitor plugin.

## Features

- **Dialer**: Full-featured phone dialer with number formatting
- **Call Management**: Handle inbound/outbound calls with native UI
- **Call History**: Track and redial previous calls
- **Active Call Controls**: Mute, hold, speaker, and recording playback
- **Settings**: Configure CXONE credentials and manage permissions
- **Cross-Platform**: Works on iOS, Android, and Web/PWA

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Ionic CLI: `npm install -g @ionic/cli`
- For iOS: Xcode and CocoaPods
- For Android: Android Studio

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the CXONE Voice plugin (in the plugin directory):
```bash
cd ../capacitor-cxone-voice
npm install
npm run build
```

3. Return to the demo app and sync Capacitor:
```bash
cd ../capacitor-cxone-voice-ionic-demo
npx cap sync
```

## Configuration

### Required CXONE Configuration

**Important**: This demo app requires valid CXONE credentials. Google STUN/TURN servers or other fallback options are not supported.

1. Update CXONE credentials in `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  cxone: {
    // Agent credentials (REQUIRED)
    agentId: 'your-agent-id',
    apiKey: 'your-api-key',
    
    // OAuth configuration (REQUIRED)
    tenantId: 'your-tenant-id', // REQUIRED - Replace with actual tenant ID
    clientId: 'your-client-id', // REQUIRED - Replace with actual client ID
    environment: 'development' // or 'staging', 'production'
  }
};
```

2. For production, update `src/environments/environment.prod.ts`

## Running the App

### Web Development
```bash
ionic serve
```

### iOS
```bash
ionic cap build ios
ionic cap run ios
```

Or open in Xcode:
```bash
ionic cap open ios
```

### Android
```bash
ionic cap build android
ionic cap run android
```

Or open in Android Studio:
```bash
ionic cap open android
```

## Platform-Specific Setup

### iOS Setup

1. Add to `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app requires microphone access for voice calls.</string>
```

2. Enable capabilities in Xcode:
- Background Modes → Voice over IP
- Background Modes → Audio
- Push Notifications

3. Configure VoIP push certificate in Apple Developer Portal

### Android Setup

1. Permissions are automatically added by the plugin

2. For Android 12+, notification permission will be requested at runtime

## App Structure

```
src/app/
├── pages/
│   ├── tabs/          # Tab navigation
│   ├── dialer/        # Phone dialer interface
│   ├── history/       # Call history list
│   ├── settings/      # App settings and permissions
│   ├── active-call/   # Active call controls
│   └── incoming-call/ # Incoming call screen
├── services/
│   └── voice.service.ts # Voice calling service
├── models/
│   └── call.model.ts    # Call data models
└── app.module.ts        # App module
```

## Key Features Implementation

### Making Calls
```typescript
await this.voiceService.makeCall(phoneNumber, displayName);
```

### Handling Incoming Calls
The app automatically navigates to the incoming call screen when a call is received.

### Call Controls
- **Mute/Unmute**: Toggle microphone during calls
- **Hold/Resume**: Put calls on hold
- **Play Recording**: Play audio files during active calls
- **End Call**: Terminate active calls

### Permissions
The app handles permissions automatically:
- Microphone (required)
- Notifications (iOS/Android 13+)
- Phone/Call Management (Android)

## Troubleshooting

### Build Issues
1. Clean and rebuild:
```bash
rm -rf node_modules
npm install
npx cap sync
```

2. For iOS pod issues:
```bash
cd ios/App
pod deintegrate
pod install
```

### Plugin Not Found
Ensure the plugin is built and linked:
```bash
cd ../capacitor-cxone-voice
npm run build
cd ../capacitor-cxone-voice-ionic-demo
npm install
npx cap sync
```

### Permission Issues
- iOS: Check Info.plist and capabilities in Xcode
- Android: Ensure all permissions are granted in app settings

## Testing

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
npm run e2e
```

## Production Build

### Web
```bash
ionic build --prod
```

### iOS
```bash
ionic cap build ios --prod
```

### Android
```bash
ionic cap build android --prod
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT