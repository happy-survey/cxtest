import type { PluginListenerHandle } from '@capacitor/core';

export interface CXONEVoicePlugin {
  /**
   * Initialize the plugin with CXONE credentials
   */
  initialize(options: InitializeOptions): Promise<void>;

  /**
   * Make an outbound call
   */
  makeCall(options: MakeCallOptions): Promise<CallResult>;

  /**
   * Answer an incoming call
   */
  answerCall(options: AnswerCallOptions): Promise<void>;

  /**
   * End an active call
   */
  endCall(options: EndCallOptions): Promise<void>;

  /**
   * Mute or unmute the microphone during a call
   */
  muteCall(options: MuteCallOptions): Promise<void>;

  /**
   * Play a recording during an active call
   */
  playRecording(options: PlayRecordingOptions): Promise<void>;

  /**
   * Stop playing a recording
   */
  stopRecording(options: StopRecordingOptions): Promise<void>;

  /**
   * Get information about the currently active call
   */
  getActiveCall(): Promise<CallInfo | null>;

  /**
   * Get all active calls
   */
  getActiveCalls(): Promise<CallInfo[]>;

  /**
   * Put a call on hold
   */
  holdCall(options: HoldCallOptions): Promise<void>;

  /**
   * Resume a held call
   */
  resumeCall(options: ResumeCallOptions): Promise<void>;

  /**
   * Transfer a call to another number
   */
  transferCall(options: TransferCallOptions): Promise<void>;

  /**
   * Check if the plugin has necessary permissions
   */
  checkPermissions(): Promise<PermissionStatus>;

  /**
   * Request necessary permissions
   */
  requestPermissions(): Promise<PermissionStatus>;

  /**
   * Register for push notifications (iOS)
   */
  registerForPushNotifications(): Promise<{ pushToken: string }>;

  /**
   * Listen for incoming calls
   */
  addListener(
    eventName: 'incomingCall',
    listenerFunc: (event: IncomingCallEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Listen for call state changes
   */
  addListener(
    eventName: 'callStateChanged',
    listenerFunc: (event: CallStateChangedEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Listen for audio level changes
   */
  addListener(
    eventName: 'audioLevelChanged',
    listenerFunc: (event: AudioLevelChangedEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Listen for recording playback events
   */
  addListener(
    eventName: 'recordingPlaybackStateChanged',
    listenerFunc: (event: RecordingPlaybackEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Listen for errors
   */
  addListener(
    eventName: 'error',
    listenerFunc: (event: ErrorEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

export interface InitializeOptions {
  agentId: string;
  apiKey: string;
  environment: 'production' | 'staging' | 'development';
  region?: 'na' | 'eu' | 'apac';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableCallKit?: boolean; // iOS only
  enableConnectionService?: boolean; // Android only
  ringtoneUrl?: string;
  enablePushNotifications?: boolean;
  // CXONE specific options (required)
  tenantId: string;
  clientId: string;
  clientSecret?: string;
  stunServers?: string[];
  turnServers?: string[];
  turnUsername?: string;
  turnCredential?: string;
}

export interface MakeCallOptions {
  phoneNumber: string;
  callerId?: string;
  displayName?: string;
  metadata?: Record<string, any>;
  video?: boolean;
}

export interface CallResult {
  callId: string;
  state: CallState;
}

export interface AnswerCallOptions {
  callId: string;
  video?: boolean;
}

export interface EndCallOptions {
  callId: string;
  reason?: EndCallReason;
}

export interface MuteCallOptions {
  callId: string;
  muted: boolean;
}

export interface PlayRecordingOptions {
  callId: string;
  recordingUrl: string;
  volume?: number; // 0.0 to 1.0
  loop?: boolean;
}

export interface StopRecordingOptions {
  callId: string;
}

export interface HoldCallOptions {
  callId: string;
}

export interface ResumeCallOptions {
  callId: string;
}

export interface TransferCallOptions {
  callId: string;
  targetNumber: string;
  transferType: 'blind' | 'attended';
}

export interface CallInfo {
  callId: string;
  phoneNumber: string;
  displayName?: string;
  direction: 'inbound' | 'outbound';
  state: CallState;
  startTime: string; // ISO 8601
  duration: number; // seconds
  isMuted: boolean;
  isOnHold: boolean;
  hasVideo: boolean;
  metadata?: Record<string, any>;
}

export type CallState = 
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'holding'
  | 'held'
  | 'resuming'
  | 'disconnecting'
  | 'disconnected'
  | 'failed';

export type EndCallReason = 
  | 'user_initiated'
  | 'remote_ended'
  | 'failed'
  | 'declined'
  | 'timeout'
  | 'busy'
  | 'network_error';

export interface IncomingCallEvent {
  callId: string;
  phoneNumber: string;
  displayName?: string;
  hasVideo: boolean;
  metadata?: Record<string, any>;
}

export interface CallStateChangedEvent {
  callId: string;
  previousState: CallState;
  currentState: CallState;
  reason?: string;
}

export interface AudioLevelChangedEvent {
  callId: string;
  localLevel: number; // 0.0 to 1.0
  remoteLevel: number; // 0.0 to 1.0
}

export interface RecordingPlaybackEvent {
  callId: string;
  state: 'started' | 'stopped' | 'completed' | 'error';
  recordingUrl: string;
  error?: string;
}

export interface ErrorEvent {
  code: ErrorCode;
  message: string;
  details?: any;
}

export type ErrorCode = 
  | 'INITIALIZATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'CALL_FAILED'
  | 'NETWORK_ERROR'
  | 'INVALID_STATE'
  | 'NOT_SUPPORTED'
  | 'CXONE_ERROR'
  | 'WEBRTC_ERROR'
  | 'AUDIO_ERROR'
  | 'UNKNOWN_ERROR';

export interface PermissionStatus {
  microphone: PermissionState;
  notifications?: PermissionState; // iOS only
  phone?: PermissionState; // Android only
}

export type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';