import { Component, OnInit } from '@angular/core';
import { VoiceService } from '../../services/voice.service';
import { CallHistoryItem } from '../../models/call.model';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {

  constructor(
    public voiceService: VoiceService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
  }

  async callNumber(phoneNumber: string) {
    try {
      await this.voiceService.makeCall(phoneNumber);
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'long' });
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  getCallIcon(item: CallHistoryItem): string {
    if (item.direction === 'inbound') {
      return item.duration > 0 ? 'call-outline' : 'call-outline';
    } else {
      return 'call-outline';
    }
  }

  getCallColor(item: CallHistoryItem): string {
    if (item.direction === 'inbound' && item.duration === 0) {
      return 'danger'; // Missed call
    }
    return item.direction === 'inbound' ? 'primary' : 'success';
  }

  async clearHistory() {
    const alert = await this.alertController.create({
      header: 'Clear Call History',
      message: 'Are you sure you want to clear all call history?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear',
          role: 'destructive',
          handler: () => {
            this.voiceService.clearCallHistory();
          }
        }
      ]
    });

    await alert.present();
  }
}