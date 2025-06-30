import { WebPlugin } from '@capacitor/core';

import type {
  CXONEVoicePlugin,
  InitializeOptions,
  MakeCallOptions,
  CallResult,
  AnswerCallOptions,
  EndCallOptions,
  MuteCallOptions,
  PlayRecordingOptions,
  StopRecordingOptions,
  CallInfo,
  HoldCallOptions,
  ResumeCallOptions,
  TransferCallOptions,
  PermissionStatus,
  CallState,
} from './definitions';

export class CXONEVoiceWeb extends WebPlugin implements CXONEVoicePlugin {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private activeCalls: Map<string, CallInfo> = new Map();
  private audioContext: AudioContext | null = null;
  private recordingAudioElements: Map<string, HTMLAudioElement> = new Map();
  private microphoneGainNode: GainNode | null = null;
  private recordingGainNode: GainNode | null = null;
  private mergerNode: ChannelMergerNode | null = null;
  private cxoneClient: any = null; // CXoneClient type from @nice-devone/core-sdk
  private voiceService: any = null; // VoiceService type from @nice-devone/voice-sdk
  private initialized = false;
  private cxoneConfig: any = null;

  constructor() {
    super();
    this.initializeWebRTC();
  }

  private initializeWebRTC(): void {
    // WebRTC configuration - CXONE servers only
    try {
      const iceServers = this.getCXONEIceServers();
      
      this.peerConnection = new RTCPeerConnection({
        iceServers,
      });
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      // Don't create peer connection without proper CXONE configuration
      return;
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to signaling server via CXONE SDK
        console.log('New ICE candidate:', event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.notifyListeners('callStateChanged', {
        callId: 'current',
        previousState: 'connecting' as CallState,
        currentState: 'connected' as CallState,
      });
    };
  }

  async initialize(options: InitializeOptions): Promise<void> {
    try {
      // Store CXONE configuration
      this.cxoneConfig = options;
      
      // CXONE credentials are required
      if (!options.tenantId || !options.clientId) {
        throw new Error('CXONE credentials (tenantId and clientId) are required');
      }
      
      await this.initializeCXONESDK(options);
      
      // Initialize audio context for mixing
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Setup audio nodes for mixing
      this.setupAudioMixing();
      
      this.initialized = true;
      console.log('CXONEVoice Web initialized with options:', options);
    } catch (error) {
      this.notifyListeners('error', {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize CXONE Voice plugin',
        details: error,
      });
      throw error;
    }
  }

  private setupAudioMixing(): void {
    if (!this.audioContext) return;

    // Create gain nodes for controlling volume
    this.microphoneGainNode = this.audioContext.createGain();
    this.recordingGainNode = this.audioContext.createGain();
    
    // Create merger node to combine audio streams
    this.mergerNode = this.audioContext.createChannelMerger(2);
    
    // Connect nodes
    this.microphoneGainNode.connect(this.mergerNode, 0, 0);
    this.recordingGainNode.connect(this.mergerNode, 0, 1);
    
    // The merger output will be connected to the WebRTC peer connection
  }

  async makeCall(options: MakeCallOptions): Promise<CallResult> {
    try {
      if (!this.initialized) {
        throw new Error('Plugin not initialized');
      }

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: options.video || false,
      });

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Generate call ID
      const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Create call info
      const callInfo: CallInfo = {
        callId,
        phoneNumber: options.phoneNumber,
        displayName: options.displayName,
        direction: 'outbound',
        state: 'dialing',
        startTime: new Date().toISOString(),
        duration: 0,
        isMuted: false,
        isOnHold: false,
        hasVideo: options.video || false,
        metadata: options.metadata,
      };

      this.activeCalls.set(callId, callInfo);

      // Simulate dialing (in real implementation, this would use CXONE SDK)
      setTimeout(() => {
        this.updateCallState(callId, 'ringing');
      }, 1000);

      setTimeout(() => {
        this.updateCallState(callId, 'connected');
      }, 3000);

      return { callId, state: 'dialing' };
    } catch (error) {
      this.notifyListeners('error', {
        code: 'CALL_FAILED',
        message: 'Failed to make call',
        details: error,
      });
      throw error;
    }
  }

  async answerCall(options: AnswerCallOptions): Promise<void> {
    try {
      const call = this.activeCalls.get(options.callId);
      if (!call) {
        throw new Error('Call not found');
      }

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: options.video || false,
      });

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      this.updateCallState(options.callId, 'connecting');
      
      // Simulate connection (in real implementation, this would use CXONE SDK)
      setTimeout(() => {
        this.updateCallState(options.callId, 'connected');
      }, 1000);
    } catch (error) {
      this.notifyListeners('error', {
        code: 'CALL_FAILED',
        message: 'Failed to answer call',
        details: error,
      });
      throw error;
    }
  }

  async endCall(options: EndCallOptions): Promise<void> {
    try {
      const call = this.activeCalls.get(options.callId);
      if (!call) {
        throw new Error('Call not found');
      }

      this.updateCallState(options.callId, 'disconnecting');

      // Stop all tracks
      this.localStream?.getTracks().forEach(track => track.stop());
      this.remoteStream?.getTracks().forEach(track => track.stop());

      // Close peer connection
      this.peerConnection?.close();

      // Clean up recording if playing
      const recordingElement = this.recordingAudioElements.get(options.callId);
      if (recordingElement) {
        recordingElement.pause();
        recordingElement.remove();
        this.recordingAudioElements.delete(options.callId);
      }

      this.updateCallState(options.callId, 'disconnected');
      this.activeCalls.delete(options.callId);

      // Reinitialize WebRTC for next call
      this.initializeWebRTC();
    } catch (error) {
      this.notifyListeners('error', {
        code: 'CALL_FAILED',
        message: 'Failed to end call',
        details: error,
      });
      throw error;
    }
  }

  async muteCall(options: MuteCallOptions): Promise<void> {
    try {
      const call = this.activeCalls.get(options.callId);
      if (!call) {
        throw new Error('Call not found');
      }

      const audioTrack = this.localStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !options.muted;
        call.isMuted = options.muted;
        this.activeCalls.set(options.callId, call);
      }
    } catch (error) {
      this.notifyListeners('error', {
        code: 'AUDIO_ERROR',
        message: 'Failed to mute/unmute call',
        details: error,
      });
      throw error;
    }
  }

  async playRecording(options: PlayRecordingOptions): Promise<void> {
    try {
      const call = this.activeCalls.get(options.callId);
      if (!call || call.state !== 'connected') {
        throw new Error('No active call found');
      }

      // Create audio element for the recording
      const audio = new Audio(options.recordingUrl);
      audio.volume = options.volume || 0.5;
      audio.loop = options.loop || false;

      // Store reference
      this.recordingAudioElements.set(options.callId, audio);

      // If we have audio context, mix the recording with microphone
      if (this.audioContext && this.recordingGainNode) {
        const source = this.audioContext.createMediaElementSource(audio);
        source.connect(this.recordingGainNode);
        this.recordingGainNode.gain.value = options.volume || 0.5;
      }

      // Play the recording
      await audio.play();

      this.notifyListeners('recordingPlaybackStateChanged', {
        callId: options.callId,
        state: 'started',
        recordingUrl: options.recordingUrl,
      });

      // Listen for when recording ends
      audio.addEventListener('ended', () => {
        this.notifyListeners('recordingPlaybackStateChanged', {
          callId: options.callId,
          state: 'completed',
          recordingUrl: options.recordingUrl,
        });
      });
    } catch (error) {
      this.notifyListeners('recordingPlaybackStateChanged', {
        callId: options.callId,
        state: 'error',
        recordingUrl: options.recordingUrl,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async stopRecording(options: StopRecordingOptions): Promise<void> {
    try {
      const audio = this.recordingAudioElements.get(options.callId);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        this.recordingAudioElements.delete(options.callId);

        this.notifyListeners('recordingPlaybackStateChanged', {
          callId: options.callId,
          state: 'stopped',
          recordingUrl: audio.src,
        });
      }
    } catch (error) {
      this.notifyListeners('error', {
        code: 'AUDIO_ERROR',
        message: 'Failed to stop recording',
        details: error,
      });
      throw error;
    }
  }

  async getActiveCall(): Promise<CallInfo | null> {
    const activeCalls = Array.from(this.activeCalls.values()).filter(
      call => call.state === 'connected'
    );
    return activeCalls.length > 0 ? activeCalls[0] : null;
  }

  async getActiveCalls(): Promise<CallInfo[]> {
    return Array.from(this.activeCalls.values());
  }

  async holdCall(options: HoldCallOptions): Promise<void> {
    try {
      const call = this.activeCalls.get(options.callId);
      if (!call) {
        throw new Error('Call not found');
      }

      call.isOnHold = true;
      this.updateCallState(options.callId, 'held');
      
      // Mute local audio when on hold
      const audioTrack = this.localStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
      }
    } catch (error) {
      this.notifyListeners('error', {
        code: 'CALL_FAILED',
        message: 'Failed to hold call',
        details: error,
      });
      throw error;
    }
  }

  async resumeCall(options: ResumeCallOptions): Promise<void> {
    try {
      const call = this.activeCalls.get(options.callId);
      if (!call) {
        throw new Error('Call not found');
      }

      call.isOnHold = false;
      this.updateCallState(options.callId, 'connected');
      
      // Unmute local audio when resuming
      const audioTrack = this.localStream?.getAudioTracks()[0];
      if (audioTrack && !call.isMuted) {
        audioTrack.enabled = true;
      }
    } catch (error) {
      this.notifyListeners('error', {
        code: 'CALL_FAILED',
        message: 'Failed to resume call',
        details: error,
      });
      throw error;
    }
  }

  async transferCall(_options: TransferCallOptions): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
    // This would be implemented with CXONE SDK
    throw new Error('Call transfer not implemented in web version');
  }

  async checkPermissions(): Promise<PermissionStatus> {
    try {
      const microphonePermission = await navigator.permissions.query({ 
        name: 'microphone' as PermissionName 
      });
      
      return {
        microphone: microphonePermission.state as any,
      };
    } catch (error) {
      return {
        microphone: 'prompt',
      };
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    try {
      // Request microphone permission by attempting to get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      return {
        microphone: 'granted',
      };
    } catch (error) {
      return {
        microphone: 'denied',
      };
    }
  }

  async registerForPushNotifications(): Promise<{ pushToken: string }> {
    // Web push notifications would be implemented here
    throw new Error('Push notifications not implemented for web');
  }

  private updateCallState(callId: string, newState: CallState): void {
    const call = this.activeCalls.get(callId);
    if (call) {
      const previousState = call.state;
      call.state = newState;
      
      if (newState === 'connected' && previousState !== 'connected') {
        call.startTime = new Date().toISOString();
      }
      
      this.activeCalls.set(callId, call);
      
      this.notifyListeners('callStateChanged', {
        callId,
        previousState,
        currentState: newState,
      });
    }
  }

  // Monitor audio levels - uncomment when needed
  // private startAudioLevelMonitoring(callId: string): void {
  //   if (!this.audioContext || !this.localStream) return;

  //   const analyser = this.audioContext.createAnalyser();
  //   const microphone = this.audioContext.createMediaStreamSource(this.localStream);
  //   microphone.connect(analyser);
    
  //   analyser.fftSize = 256;
  //   const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
  //   const checkAudioLevel = () => {
  //     analyser.getByteFrequencyData(dataArray);
  //     const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
  //     const normalizedLevel = average / 255;
      
  //     this.notifyListeners('audioLevelChanged', {
  //       callId,
  //       localLevel: normalizedLevel,
  //       remoteLevel: 0, // Would need remote stream analysis
  //     });
      
  //     if (this.activeCalls.has(callId)) {
  //       requestAnimationFrame(checkAudioLevel);
  //     }
  //   };
    
  //   checkAudioLevel();
  // }

  private async initializeCXONESDK(options: InitializeOptions): Promise<void> {
    try {
      // Dynamic imports to avoid build issues
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error - CXONE SDK types not available at build time
      const { CXoneClient } = await import('@nice-devone/core-sdk');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error - CXONE SDK types not available at build time
      const { VoiceService } = await import('@nice-devone/voice-sdk');
      
      // Initialize CXONE client
      this.cxoneClient = new CXoneClient();
      await this.cxoneClient.init({
        tenantId: options.tenantId,
        clientId: options.clientId,
        environment: options.environment || 'production',
      });
      
      // Initialize voice service
      this.voiceService = new VoiceService(this.cxoneClient);
      await this.voiceService.initialize();
      
      console.log('CXONE SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CXONE SDK:', error);
      throw new Error(`CXONE SDK initialization failed: ${(error as Error).message}`);
    }
  }

  private getCXONEIceServers(): RTCIceServer[] {
    // CXONE configuration is required
    if (!this.cxoneConfig) {
      throw new Error('CXONE configuration is required. Please initialize with CXONE credentials.');
    }
    
    // Use custom STUN/TURN servers if provided
    if (this.cxoneConfig.stunServers || this.cxoneConfig.turnServers) {
      const servers: RTCIceServer[] = [];
      
      // Add STUN servers
      this.cxoneConfig.stunServers?.forEach((server: string) => {
        servers.push({ urls: server });
      });
      
      // Add TURN servers with credentials
      this.cxoneConfig.turnServers?.forEach((server: string) => {
        servers.push({
          urls: server,
          username: this.cxoneConfig.turnUsername || 'cxone',
          credential: this.cxoneConfig.turnCredential || 'cxone'
        });
      });
      
      return servers;
    }
    
    // Use default CXONE servers based on environment
    const environment = this.cxoneConfig.environment || 'production';
    const cxoneServers: Record<string, RTCIceServer[]> = {
      production: [
        { urls: 'stun:stun.cxone.nice.com:3478' },
        { urls: 'turn:turn.cxone.nice.com:3478', username: 'cxone', credential: 'cxone' }
      ],
      staging: [
        { urls: 'stun:stun-staging.cxone.nice.com:3478' },
        { urls: 'turn:turn-staging.cxone.nice.com:3478', username: 'cxone', credential: 'cxone' }
      ],
      development: [
        { urls: 'stun:stun-dev.cxone.nice.com:3478' },
        { urls: 'turn:turn-dev.cxone.nice.com:3478', username: 'cxone', credential: 'cxone' }
      ]
    };
    
    return cxoneServers[environment] || cxoneServers.production;
  }
}