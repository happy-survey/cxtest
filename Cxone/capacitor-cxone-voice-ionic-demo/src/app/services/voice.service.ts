import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Platform } from '@ionic/angular';
import { Call, CallHistoryItem, CallState } from '../models/call.model';
import { environment } from '../../environments/environment';
import { ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CxoneFacadeService } from './cxone-facade.service';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  private activeCallSubject = new BehaviorSubject<Call | null>(null);
  private callHistorySubject = new BehaviorSubject<CallHistoryItem[]>([]);
  private audioLevelsSubject = new Subject<{ local: number; remote: number }>();
  private recordingStateSubject = new BehaviorSubject<string>('stopped');
  private isInitializedSubject = new BehaviorSubject<boolean>(false);

  public activeCall$ = this.activeCallSubject.asObservable();
  public callHistory$ = this.callHistorySubject.asObservable();
  public audioLevels$ = this.audioLevelsSubject.asObservable();
  public recordingState$ = this.recordingStateSubject.asObservable();
  public isInitialized$ = this.isInitializedSubject.asObservable();

  private callTimer: any;
  private callStartTime?: Date;

  private useCxone = false;

  constructor(
    private platform: Platform,
    private toastController: ToastController,
    private alertController: AlertController,
    private router: Router,
    private cxoneService: CxoneFacadeService
  ) {
    this.loadCallHistory();
    this.setupCxoneListeners();
  }

  async initialize(): Promise<void> {
    try {
      // Check if we have CXONE credentials configured
      if (environment.cxone.tenantId && environment.cxone.tenantId !== 'your-tenant-id') {
        try {
          await this.cxoneService.initialize();
          this.useCxone = true;
          this.isInitializedSubject.next(true);
          await this.showToast('Connected to CXONE', 'success');
        } catch (cxoneError: any) {
          console.error('Failed to initialize CXONE:', cxoneError);
          this.useCxone = false;
          
          // Show detailed error message
          const errorMessage = cxoneError.message || 'Unknown error';
          await this.showAlert(
            'CXONE Initialization Failed',
            `Unable to connect to CXONE: ${errorMessage}`,
            'Please check your CXONE credentials in the environment configuration.'
          );
          
          // Don't initialize in demo mode - force user to fix configuration
          this.isInitializedSubject.next(false);
          throw new Error('CXONE configuration required');
        }
      } else {
        // Show configuration required message
        await this.showAlert(
          'CXONE Configuration Required',
          'CXONE credentials are not configured.',
          'Please update src/environments/environment.ts with your CXONE tenantId and clientId.'
        );
        
        this.useCxone = false;
        this.isInitializedSubject.next(false);
        throw new Error('CXONE configuration required');
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      throw error;
    }
  }

  private simulateAudioLevels(): void {
    setInterval(() => {
      if (this.activeCallSubject.value && this.activeCallSubject.value.state === 'connected') {
        this.audioLevelsSubject.next({
          local: Math.random() * 0.7,
          remote: Math.random() * 0.7
        });
      }
    }, 200);
  }

  async makeCall(phoneNumber: string, displayName?: string): Promise<void> {
    try {
      if (this.useCxone) {
        // Use CXONE to make the call
        await this.cxoneService.makeCall(phoneNumber);
        // CXONE will handle the call state via events
      } else {
        // Mock call for demo mode
        const mockCall: Call = {
          id: `mock-${Date.now()}`,
          phoneNumber,
          displayName,
          direction: 'outbound',
          state: 'dialing',
          startTime: new Date(),
          isMuted: false,
          isOnHold: false
        };

        this.activeCallSubject.next(mockCall);
        this.startCallTimer();
        
        // Simulate call connection
        setTimeout(() => {
          mockCall.state = 'connected';
          this.activeCallSubject.next(mockCall);
        }, 2000);
      }
      
      // Navigate to active call page
      await this.router.navigate(['/active-call']);
    } catch (error) {
      console.error('Failed to make call:', error);
      await this.showToast('Failed to make call', 'danger');
      throw error;
    }
  }

  async answerCall(callId: string): Promise<void> {
    try {
      if (this.useCxone) {
        await this.cxoneService.answerCall(callId);
      } else {
        const activeCall = this.activeCallSubject.value;
        if (activeCall) {
          activeCall.state = 'connecting';
          this.activeCallSubject.next(activeCall);
          
          // Simulate connection
          setTimeout(() => {
            activeCall.state = 'connected';
            this.activeCallSubject.next(activeCall);
          }, 1000);
        }
      }
      
      this.startCallTimer();
      await this.router.navigate(['/active-call']);
    } catch (error) {
      console.error('Failed to answer call:', error);
      await this.showToast('Failed to answer call', 'danger');
      throw error;
    }
  }

  async endCall(): Promise<void> {
    const activeCall = this.activeCallSubject.value;
    if (!activeCall) return;

    try {
      if (this.useCxone) {
        await this.cxoneService.endCall(activeCall.id);
      }
      
      // Add to call history
      this.addToCallHistory(activeCall);
      
      // Clear active call
      this.activeCallSubject.next(null);
      this.stopCallTimer();
      
      // Navigate back
      await this.router.navigate(['/tabs/dialer']);
    } catch (error) {
      console.error('Failed to end call:', error);
      await this.showToast('Failed to end call', 'danger');
      throw error;
    }
  }

  async toggleMute(): Promise<void> {
    const activeCall = this.activeCallSubject.value;
    if (!activeCall) return;

    try {
      const newMuteState = !activeCall.isMuted;
      
      if (this.useCxone) {
        await this.cxoneService.muteCall(newMuteState);
      }
      
      activeCall.isMuted = newMuteState;
      this.activeCallSubject.next(activeCall);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      await this.showToast('Failed to toggle mute', 'danger');
      throw error;
    }
  }

  async toggleHold(): Promise<void> {
    const activeCall = this.activeCallSubject.value;
    if (!activeCall) return;

    try {
      const newHoldState = !activeCall.isOnHold;
      
      if (this.useCxone) {
        await this.cxoneService.holdCall(activeCall.id, newHoldState);
      }
      
      activeCall.isOnHold = newHoldState;
      activeCall.state = activeCall.isOnHold ? 'held' : 'connected';
      this.activeCallSubject.next(activeCall);
    } catch (error) {
      console.error('Failed to toggle hold:', error);
      await this.showToast('Failed to toggle hold', 'danger');
      throw error;
    }
  }

  async playRecording(url: string, volume: number = 0.5): Promise<void> {
    const activeCall = this.activeCallSubject.value;
    if (!activeCall) {
      await this.showToast('No active call', 'warning');
      return;
    }

    try {
      // Mock recording for web
      this.recordingStateSubject.next('started');
      await this.showToast('Playing recording (simulated)', 'success');
      
      setTimeout(() => {
        this.recordingStateSubject.next('completed');
      }, 5000);
    } catch (error) {
      console.error('Failed to play recording:', error);
      await this.showToast('Failed to play recording', 'danger');
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    const activeCall = this.activeCallSubject.value;
    if (!activeCall) return;

    try {
      this.recordingStateSubject.next('stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      await this.showToast('Failed to stop recording', 'danger');
      throw error;
    }
  }

  async checkPermissions(): Promise<any> {
    // Mock permissions for web
    return {
      microphone: 'granted',
      notifications: 'granted',
      phone: 'granted'
    };
  }

  async requestPermissions(): Promise<any> {
    // Mock permissions for web
    return {
      microphone: 'granted',
      notifications: 'granted',
      phone: 'granted'
    };
  }

  simulateIncomingCall(): void {
    const call: Call = {
      id: `incoming-${Date.now()}`,
      phoneNumber: '+1 (555) 123-4567',
      displayName: 'John Doe',
      direction: 'inbound',
      state: 'ringing',
      startTime: new Date(),
      isMuted: false,
      isOnHold: false
    };

    this.activeCallSubject.next(call);
    this.router.navigate(['/incoming-call']);
  }

  private startCallTimer(): void {
    this.callStartTime = new Date();
    this.callTimer = setInterval(() => {
      const activeCall = this.activeCallSubject.value;
      if (activeCall && this.callStartTime) {
        activeCall.duration = Math.floor((new Date().getTime() - this.callStartTime.getTime()) / 1000);
        this.activeCallSubject.next(activeCall);
      }
    }, 1000);
  }

  private stopCallTimer(): void {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
    this.callStartTime = undefined;
  }

  private addToCallHistory(call: Call): void {
    const historyItem: CallHistoryItem = {
      ...call,
      endTime: new Date(),
      duration: call.duration || 0
    };

    const history = this.callHistorySubject.value;
    history.unshift(historyItem);
    
    // Keep only last 50 calls
    if (history.length > 50) {
      history.pop();
    }
    
    this.callHistorySubject.next(history);
    this.saveCallHistory();
  }

  private loadCallHistory(): void {
    const savedHistory = localStorage.getItem('callHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        this.callHistorySubject.next(history);
      } catch (error) {
        console.error('Failed to load call history:', error);
      }
    }
  }

  private saveCallHistory(): void {
    const history = this.callHistorySubject.value;
    localStorage.setItem('callHistory', JSON.stringify(history));
  }

  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
  
  private async showAlert(header: string, subHeader: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      subHeader,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  clearCallHistory(): void {
    this.callHistorySubject.next([]);
    localStorage.removeItem('callHistory');
  }

  private setupCxoneListeners(): void {
    // Subscribe to CXONE events
    this.cxoneService.onIncomingCall((event) => {
      const call: Call = {
        id: event.callId,
        phoneNumber: event.phoneNumber || 'Unknown',
        displayName: event.displayName,
        direction: 'inbound',
        state: 'ringing',
        startTime: new Date(),
        isMuted: false,
        isOnHold: false
      };
      
      this.activeCallSubject.next(call);
      this.router.navigate(['/incoming-call']);
    });
    
    this.cxoneService.onCallStateChanged((event) => {
      const currentCall = this.activeCallSubject.value;
      if (currentCall && currentCall.id === event.callId) {
        const newState = this.mapPluginState(event.currentState);
        currentCall.state = newState;
        
        if (event.currentState === 'connected' && !this.callStartTime) {
          this.startCallTimer();
        } else if (event.currentState === 'disconnected') {
          this.stopCallTimer();
          this.addToCallHistory(currentCall);
          this.activeCallSubject.next(null);
          return;
        }
        
        this.activeCallSubject.next(currentCall);
      }
    });
  }
  
  private mapPluginState(state: string): CallState {
    switch (state) {
      case 'dialing':
        return 'dialing';
      case 'ringing':
        return 'ringing';
      case 'connecting':
        return 'connecting';
      case 'connected':
        return 'connected';
      case 'held':
        return 'held';
      case 'disconnecting':
        return 'disconnecting';
      case 'disconnected':
        return 'disconnected';
      default:
        return 'failed';
    }
  }

  private mapCxoneState(cxoneState: string): CallState {
    switch (cxoneState?.toUpperCase()) {
      case 'INCOMING':
      case 'RINGING':
        return 'ringing';
      case 'DIALING':
      case 'OUTBOUND':
        return 'dialing';
      case 'CONNECTING':
        return 'connecting';
      case 'ACTIVE':
      case 'CONNECTED':
        return 'connected';
      case 'HELD':
        return 'held';
      case 'ENDED':
      case 'DISCONNECTED':
        return 'disconnected';
      case 'FAILED':
        return 'failed';
      default:
        return 'disconnected';
    }
  }
}