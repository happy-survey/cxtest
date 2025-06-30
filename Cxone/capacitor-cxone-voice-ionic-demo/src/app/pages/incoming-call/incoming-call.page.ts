import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { VoiceService } from '../../services/voice.service';
import { Call } from '../../models/call.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-incoming-call',
  templateUrl: './incoming-call.page.html',
  styleUrls: ['./incoming-call.page.scss'],
})
export class IncomingCallPage implements OnInit, OnDestroy {
  incomingCall: Call | null = null;
  private subscription?: Subscription;

  constructor(
    private voiceService: VoiceService,
    private router: Router
  ) { }

  ngOnInit() {
    this.subscription = this.voiceService.activeCall$.subscribe(call => {
      if (call && call.state === 'ringing' && call.direction === 'inbound') {
        this.incomingCall = call;
      } else if (!call || call.state !== 'ringing') {
        // Call ended or answered, navigate away
        this.router.navigate(['/tabs/dialer']);
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  async answerCall() {
    if (!this.incomingCall) return;
    
    try {
      await this.voiceService.answerCall(this.incomingCall.id);
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  }

  async declineCall() {
    if (!this.incomingCall) return;
    
    try {
      await this.voiceService.endCall();
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  }
}