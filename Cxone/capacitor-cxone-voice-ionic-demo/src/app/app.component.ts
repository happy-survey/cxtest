import { Component } from '@angular/core';
import { Platform, AlertController } from '@ionic/angular';
import { VoiceService } from './services/voice.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private voiceService: VoiceService,
    private alertController: AlertController,
    private router: Router
  ) {
    this.initializeApp();
  }

  async initializeApp() {
    await this.platform.ready();
    
    // Initialize voice service when app starts
    try {
      await this.voiceService.initialize();
      console.log('Voice service initialized');
    } catch (error: any) {
      console.error('Failed to initialize voice service:', error);
      
      // Show configuration required alert
      const alert = await this.alertController.create({
        header: 'Configuration Required',
        message: 'CXONE credentials are not configured. Please go to Settings to configure your CXONE account.',
        buttons: [
          {
            text: 'Go to Settings',
            handler: () => {
              this.router.navigate(['/tabs/settings']);
            }
          }
        ],
        backdropDismiss: false
      });
      
      await alert.present();
    }
  }
}