import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { VoiceService } from '../../services/voice.service';
import { Call } from '../../models/call.model';
import { Subscription } from 'rxjs';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-active-call',
  templateUrl: './active-call.page.html',
  styleUrls: ['./active-call.page.scss'],
})
export class ActiveCallPage implements OnInit, OnDestroy {
  activeCall: Call | null = null;
  audioLevels = { local: 0, remote: 0 };
  recordingUrl: string = '';
  recordingVolume: number = 50;
  recordingState: string = 'stopped';
  
  private subscriptions: Subscription[] = [];

  constructor(
    public voiceService: VoiceService,
    private router: Router,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    // Subscribe to active call
    this.subscriptions.push(
      this.voiceService.activeCall$.subscribe(call => {
        this.activeCall = call;
        if (!call) {
          // No active call, navigate back
          this.router.navigate(['/tabs/dialer']);
        }
      })
    );

    // Subscribe to audio levels
    this.subscriptions.push(
      this.voiceService.audioLevels$.subscribe(levels => {
        this.audioLevels = levels;
      })
    );

    // Subscribe to recording state
    this.subscriptions.push(
      this.voiceService.recordingState$.subscribe(state => {
        this.recordingState = state;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  async toggleMute() {
    try {
      await this.voiceService.toggleMute();
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  }

  async toggleHold() {
    try {
      await this.voiceService.toggleHold();
    } catch (error) {
      console.error('Failed to toggle hold:', error);
    }
  }

  async toggleSpeaker() {
    // This would need to be implemented in the plugin
    console.log('Toggle speaker not implemented yet');
  }

  async showRecordingDialog() {
    const alert = await this.alertController.create({
      header: 'Play Recording',
      inputs: [
        {
          name: 'url',
          type: 'url',
          placeholder: 'Recording URL',
          value: this.recordingUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        },
        {
          name: 'volume',
          type: 'number',
          placeholder: 'Volume (0-100)',
          value: this.recordingVolume,
          min: 0,
          max: 100
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Play',
          handler: async (data) => {
            if (data.url) {
              this.recordingUrl = data.url;
              this.recordingVolume = parseInt(data.volume) || 50;
              await this.playRecording();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async playRecording() {
    try {
      await this.voiceService.playRecording(this.recordingUrl, this.recordingVolume / 100);
    } catch (error) {
      console.error('Failed to play recording:', error);
    }
  }

  async stopRecording() {
    try {
      await this.voiceService.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }

  async endCall() {
    try {
      await this.voiceService.endCall();
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }

  getStateColor(state?: string): string {
    switch (state) {
      case 'connected':
        return 'success';
      case 'held':
        return 'warning';
      case 'dialing':
      case 'connecting':
        return 'primary';
      default:
        return 'medium';
    }
  }
}