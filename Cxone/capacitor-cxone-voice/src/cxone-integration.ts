import type { InitializeOptions, CallState } from './definitions';

/**
 * CXONE Voice SDK Integration Layer
 * This class handles the integration between the Capacitor plugin and CXONE Voice SDK
 */
export class CXONEIntegration {
  private voiceSDK: any; // Will be properly typed when actual SDK is imported
  private initialized = false;
  private webRTCService: any;
  private eventHandlers: Map<string, ((...args: any[]) => void)[]> = new Map();

  constructor() {
    this.eventHandlers.set('incomingCall', []);
    this.eventHandlers.set('callStateChanged', []);
    this.eventHandlers.set('error', []);
  }

  async initialize(options: InitializeOptions): Promise<void> {
    try {
      // Import and initialize CXONE Voice SDK
      const { VoiceSDK } = await import('@nice-devone/voice-sdk');
      
      this.voiceSDK = new VoiceSDK({
        agentId: options.agentId,
        apiKey: options.apiKey,
        environment: options.environment,
        region: options.region || 'na',
        logLevel: options.logLevel || 'info',
      });

      // Initialize WebRTC service
      this.webRTCService = await this.voiceSDK.createWebRTCService({
        enableVideo: false,
        audioConstraints: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Set up event listeners
      this.setupEventListeners();
      
      // Connect to CXONE
      await this.voiceSDK.connect();
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize CXONE SDK: ${error.message}`);
    }
  }

  private setupEventListeners(): void {
    // Listen for incoming calls
    this.voiceSDK.on('incomingCall', (callData: any) => {
      this.emit('incomingCall', {
        callId: callData.callId,
        phoneNumber: callData.from,
        displayName: callData.displayName,
        hasVideo: false,
        metadata: callData.metadata,
      });
    });

    // Listen for call state changes
    this.voiceSDK.on('callStateChanged', (stateData: any) => {
      this.emit('callStateChanged', {
        callId: stateData.callId,
        previousState: this.mapCXONEStateToCallState(stateData.previousState),
        currentState: this.mapCXONEStateToCallState(stateData.currentState),
        reason: stateData.reason,
      });
    });

    // Listen for errors
    this.voiceSDK.on('error', (error: any) => {
      this.emit('error', {
        code: this.mapCXONEErrorCode(error.code),
        message: error.message,
        details: error.details,
      });
    });
  }

  async makeCall(phoneNumber: string, options?: any): Promise<string> {
    if (!this.initialized) {
      throw new Error('CXONE SDK not initialized');
    }

    const call = await this.voiceSDK.makeCall({
      to: phoneNumber,
      from: options?.callerId,
      displayName: options?.displayName,
      metadata: options?.metadata,
    });

    return call.callId;
  }

  async answerCall(callId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('CXONE SDK not initialized');
    }

    await this.voiceSDK.answerCall(callId);
  }

  async endCall(callId: string, reason?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('CXONE SDK not initialized');
    }

    await this.voiceSDK.endCall(callId, reason);
  }

  async muteCall(callId: string, muted: boolean): Promise<void> {
    if (!this.initialized) {
      throw new Error('CXONE SDK not initialized');
    }

    const call = this.voiceSDK.getCall(callId);
    if (call) {
      await call.setMuted(muted);
    }
  }

  async holdCall(callId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('CXONE SDK not initialized');
    }

    const call = this.voiceSDK.getCall(callId);
    if (call) {
      await call.hold();
    }
  }

  async resumeCall(callId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('CXONE SDK not initialized');
    }

    const call = this.voiceSDK.getCall(callId);
    if (call) {
      await call.resume();
    }
  }

  async transferCall(callId: string, targetNumber: string, transferType: 'blind' | 'attended'): Promise<void> {
    if (!this.initialized) {
      throw new Error('CXONE SDK not initialized');
    }

    const call = this.voiceSDK.getCall(callId);
    if (call) {
      if (transferType === 'blind') {
        await call.blindTransfer(targetNumber);
      } else {
        await call.attendedTransfer(targetNumber);
      }
    }
  }

  async getOffer(callId: string): Promise<RTCSessionDescriptionInit> {
    const call = this.voiceSDK.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    return await call.getOffer();
  }

  async setAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const call = this.voiceSDK.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    await call.setAnswer(answer);
  }

  async addIceCandidate(callId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const call = this.voiceSDK.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    await call.addIceCandidate(candidate);
  }

  getMediaStream(callId: string): MediaStream | null {
    const call = this.voiceSDK.getCall(callId);
    if (!call) {
      return null;
    }

    return call.getLocalStream();
  }

  // Event handling
  on(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  // State mapping
  private mapCXONEStateToCallState(cxoneState: string): CallState {
    const stateMap: Record<string, CallState> = {
      'idle': 'idle',
      'initiating': 'dialing',
      'ringing': 'ringing',
      'connecting': 'connecting',
      'connected': 'connected',
      'holding': 'holding',
      'held': 'held',
      'resuming': 'resuming',
      'disconnecting': 'disconnecting',
      'disconnected': 'disconnected',
      'failed': 'failed',
    };

    return stateMap[cxoneState] || 'idle';
  }

  private mapCXONEErrorCode(cxoneCode: string): string {
    const errorMap: Record<string, string> = {
      'AUTH_FAILED': 'INITIALIZATION_FAILED',
      'PERMISSION_DENIED': 'PERMISSION_DENIED',
      'CALL_FAILED': 'CALL_FAILED',
      'NETWORK_ERROR': 'NETWORK_ERROR',
      'INVALID_STATE': 'INVALID_STATE',
      'NOT_SUPPORTED': 'NOT_SUPPORTED',
      'SDK_ERROR': 'CXONE_ERROR',
      'WEBRTC_ERROR': 'WEBRTC_ERROR',
      'MEDIA_ERROR': 'AUDIO_ERROR',
    };

    return errorMap[cxoneCode] || 'UNKNOWN_ERROR';
  }

  // Audio mixing support
  async createAudioMixer(): Promise<AudioMixer> {
    return new AudioMixer(this.webRTCService);
  }

  async cleanup(): Promise<void> {
    if (this.initialized) {
      await this.voiceSDK.disconnect();
      this.initialized = false;
    }
  }
}

/**
 * Audio Mixer for playing recordings during calls
 */
export class AudioMixer {
  private audioContext: AudioContext;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private recordingSource: MediaElementAudioSourceNode | null = null;
  private microphoneGain: GainNode;
  private recordingGain: GainNode;
  private merger: ChannelMergerNode;
  private destination: MediaStreamAudioDestinationNode;
  private recordingElement: HTMLAudioElement | null = null;

  constructor(private webRTCService: any) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create audio nodes
    this.microphoneGain = this.audioContext.createGain();
    this.recordingGain = this.audioContext.createGain();
    this.merger = this.audioContext.createChannelMerger(2);
    this.destination = this.audioContext.createMediaStreamDestination();
    
    // Connect nodes
    this.microphoneGain.connect(this.merger, 0, 0);
    this.recordingGain.connect(this.merger, 0, 1);
    this.merger.connect(this.destination);
    
    // Set default gain values
    this.microphoneGain.gain.value = 1.0;
    this.recordingGain.gain.value = 0.5;
  }

  async setMicrophoneStream(stream: MediaStream): Promise<void> {
    if (this.microphoneSource) {
      this.microphoneSource.disconnect();
    }
    
    this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
    this.microphoneSource.connect(this.microphoneGain);
  }

  async playRecording(url: string, options?: { volume?: number; loop?: boolean }): Promise<void> {
    // Stop any existing recording
    this.stopRecording();
    
    // Create new audio element
    this.recordingElement = new Audio(url);
    this.recordingElement.loop = options?.loop || false;
    
    // Create source from audio element
    this.recordingSource = this.audioContext.createMediaElementSource(this.recordingElement);
    this.recordingSource.connect(this.recordingGain);
    
    // Set volume
    if (options?.volume !== undefined) {
      this.recordingGain.gain.value = options.volume;
    }
    
    // Play the recording
    await this.recordingElement.play();
  }

  stopRecording(): void {
    if (this.recordingElement) {
      this.recordingElement.pause();
      this.recordingElement.currentTime = 0;
      this.recordingElement = null;
    }
    
    if (this.recordingSource) {
      this.recordingSource.disconnect();
      this.recordingSource = null;
    }
  }

  getMixedStream(): MediaStream {
    return this.destination.stream;
  }

  setMicrophoneVolume(volume: number): void {
    this.microphoneGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  setRecordingVolume(volume: number): void {
    this.recordingGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  cleanup(): void {
    this.stopRecording();
    if (this.microphoneSource) {
      this.microphoneSource.disconnect();
    }
    this.audioContext.close();
  }
}