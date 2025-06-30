import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { CXONEVoice } from 'capacitor-cxone-voice';

/**
 * Facade service for CXONE integration
 * This provides a simplified interface that avoids direct SDK imports
 * to prevent TypeScript compilation issues with the CXONE SDK dependencies
 */
@Injectable({
  providedIn: 'root'
})
export class CxoneFacadeService {
  private isInitializedSubject = new BehaviorSubject<boolean>(false);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private incomingCallListeners: ((event: any) => void)[] = [];
  private callStateListeners: ((event: any) => void)[] = [];
  
  public isInitialized$ = this.isInitializedSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Set up plugin event listeners
    CXONEVoice.addListener('incomingCall', (event) => {
      console.log('CXONE Facade: Incoming call event:', event);
      this.incomingCallListeners.forEach(listener => listener(event));
    });
    
    CXONEVoice.addListener('callStateChanged', (event) => {
      console.log('CXONE Facade: Call state changed:', event);
      this.callStateListeners.forEach(listener => listener(event));
    });
    
    CXONEVoice.addListener('error', (event) => {
      console.error('CXONE Facade: Error event:', event);
    });
  }

  /**
   * Initialize CXONE connection using the Capacitor plugin
   */
  async initialize(): Promise<void> {
    try {
      console.log('CXONE Facade: Initializing with config:', {
        tenantId: environment.cxone.tenantId,
        environment: environment.cxone.environment
      });
      
      // Check if we have valid credentials
      if (!environment.cxone.tenantId || environment.cxone.tenantId === 'your-tenant-id') {
        throw new Error('CXONE credentials not configured. Please update environment.ts with actual CXONE credentials.');
      }
      
      // Initialize the plugin with CXONE configuration
      await CXONEVoice.initialize({
        agentId: environment.cxone.agentId,
        apiKey: environment.cxone.apiKey,
        environment: environment.cxone.environment,
        
        // Required CXONE configuration
        tenantId: environment.cxone.tenantId,
        clientId: environment.cxone.clientId,
        clientSecret: environment.cxone.clientSecret,
        
        // Optional CXONE WebRTC servers
        stunServers: environment.cxone.stunServers,
        turnServers: environment.cxone.turnServers,
        turnUsername: environment.cxone.turnUsername,
        turnCredential: environment.cxone.turnCredential,
        
        // Platform features
        enableCallKit: true, // iOS
        enableConnectionService: true, // Android
        enablePushNotifications: true
      });
      
      console.log('CXONE Facade: Plugin initialized successfully');
      this.isInitializedSubject.next(true);
    } catch (error) {
      console.error('CXONE Facade: Initialization failed:', error);
      this.isInitializedSubject.next(false);
      throw error;
    }
  }

  /**
   * Login to CXONE
   * Redirects to CXONE OAuth login page
   */
  async login(): Promise<void> {
    const baseUrl = this.getCxoneBaseUrl();
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const clientId = encodeURIComponent(environment.cxone.clientId);
    const tenantId = encodeURIComponent(environment.cxone.tenantId);
    
    // Construct OAuth authorize URL
    const authorizeUrl = `${baseUrl}/auth/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${redirectUri}&` +
      `tenant_id=${tenantId}&` +
      `state=${this.generateState()}`;
    
    // Redirect to login
    window.location.href = authorizeUrl;
  }

  /**
   * Handle OAuth callback
   */
  async handleAuthCallback(code: string): Promise<void> {
    console.log('CXONE Facade: Handling auth callback with code:', code.substring(0, 10) + '...');
    // In production, exchange code for token here
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Logout from CXONE
   */
  async logout(): Promise<void> {
    this.isAuthenticatedSubject.next(false);
    const logoutUrl = `${this.getCxoneBaseUrl()}/logout`;
    window.location.href = logoutUrl;
  }

  /**
   * Make an outbound call
   */
  async makeCall(phoneNumber: string, skillId?: string): Promise<void> {
    console.log('CXONE Facade: Making call to', phoneNumber, 'with skill', skillId);
    
    // Use the Capacitor plugin to make the call
    const result = await CXONEVoice.makeCall({
      phoneNumber,
      displayName: `Call to ${phoneNumber}`,
      metadata: {
        skillId: skillId || environment.cxone.defaultSkillId
      }
    });
    
    console.log('CXONE Facade: Call initiated with ID:', result.callId);
  }

  /**
   * Answer an incoming call
   */
  async answerCall(contactId: string): Promise<void> {
    console.log('CXONE Facade: Answering call', contactId);
    
    // Use the Capacitor plugin to answer the call
    await CXONEVoice.answerCall({
      callId: contactId
    });
    // In production, use SDK to answer call
  }

  /**
   * End active call
   */
  async endCall(contactId: string): Promise<void> {
    console.log('CXONE Facade: Ending call', contactId);
    
    // Use the Capacitor plugin to end the call
    await CXONEVoice.endCall({
      callId: contactId
    });
  }

  /**
   * Mute/unmute call
   */
  async muteCall(mute: boolean): Promise<void> {
    console.log('CXONE Facade: Setting mute to', mute);
    
    // Get the active call first
    const activeCall = await CXONEVoice.getActiveCall();
    if (activeCall) {
      await CXONEVoice.muteCall({
        callId: activeCall.callId,
        muted: mute
      });
    }
  }

  /**
   * Hold/resume call
   */
  async holdCall(contactId: string, hold: boolean): Promise<void> {
    console.log('CXONE Facade: Setting hold to', hold, 'for call', contactId);
    
    // Use the Capacitor plugin to hold/resume
    if (hold) {
      await CXONEVoice.holdCall({ callId: contactId });
    } else {
      await CXONEVoice.resumeCall({ callId: contactId });
    }
  }

  // Helper methods
  private getCxoneBaseUrl(): string {
    const env = environment.cxone.environment as string;
    switch (env) {
      case 'development':
        return 'https://cxone-dev.niceincontact.com';
      case 'staging':
        return 'https://cxone-staging.niceincontact.com';
      case 'production':
        return 'https://cxone.niceincontact.com';
      default:
        return 'https://cxone-dev.niceincontact.com';
    }
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  get isInitialized(): boolean {
    return this.isInitializedSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }
  
  // Event listener registration
  public onIncomingCall(listener: (event: any) => void): void {
    this.incomingCallListeners.push(listener);
  }
  
  public onCallStateChanged(listener: (event: any) => void): void {
    this.callStateListeners.push(listener);
  }
}