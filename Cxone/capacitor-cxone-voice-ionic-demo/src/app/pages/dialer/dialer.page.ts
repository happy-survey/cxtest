import { Component, OnInit } from '@angular/core';
import { VoiceService } from '../../services/voice.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-dialer',
  templateUrl: './dialer.page.html',
  styleUrls: ['./dialer.page.scss'],
})
export class DialerPage implements OnInit {
  phoneNumber: string = '';
  displayName: string = '';

  constructor(
    public voiceService: VoiceService,
    private toastController: ToastController
  ) { }

  ngOnInit() {
  }

  addDigit(digit: string) {
    this.phoneNumber += digit;
  }

  deleteDigit() {
    this.phoneNumber = this.phoneNumber.slice(0, -1);
  }

  clearNumber() {
    this.phoneNumber = '';
  }

  async makeCall() {
    if (!this.phoneNumber) {
      const toast = await this.toastController.create({
        message: 'Please enter a phone number',
        duration: 2000,
        position: 'bottom',
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      await this.voiceService.makeCall(this.phoneNumber, this.displayName || undefined);
      // Clear the form after successful call
      this.phoneNumber = '';
      this.displayName = '';
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  }

  formatPhoneNumber(number: string): string {
    // Simple US phone number formatting
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else {
      return `+${cleaned.slice(0, cleaned.length - 10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
    }
  }
}