export interface Call {
  id: string;
  phoneNumber: string;
  displayName?: string;
  direction: 'inbound' | 'outbound';
  state: CallState;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  isMuted: boolean;
  isOnHold: boolean;
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

export interface CallHistoryItem extends Call {
  endTime: Date;
  duration: number;
}