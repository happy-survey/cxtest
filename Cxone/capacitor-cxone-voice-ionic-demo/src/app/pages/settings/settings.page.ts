import { Component, OnInit } from '@angular/core';
import { VoiceService } from '../../services/voice.service';
import { CxoneFacadeService } from '../../services/cxone-facade.service';
import { environment } from '../../../environments/environment';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  // Legacy credentials
  agentId: string = environment.cxone.agentId;
  apiKey: string = environment.cxone.apiKey;
  
  // OAuth credentials
  tenantId: string = environment.cxone.tenantId;
  clientId: string = environment.cxone.clientId;
  clientSecret: string = environment.cxone.clientSecret || '';
  defaultSkillId: string = environment.cxone.defaultSkillId;
  
  selectedEnvironment: string = environment.cxone.environment;
  
  permissions: any = {
    microphone: 'unknown',
    notifications: 'unknown',
    phone: 'unknown'
  };
  
  isAuthenticated = false;
  authMode: 'oauth' | 'legacy' = 'oauth';

  constructor(
    public voiceService: VoiceService,
    public cxoneService: CxoneFacadeService,
    private alertController: AlertController,
    private toastController: ToastController
  ) { }

  async ngOnInit() {
    await this.checkPermissions();
    this.checkAuthStatus();
  }

  async checkPermissions() {
    try {
      this.permissions = await this.voiceService.checkPermissions();
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }
  }

  async requestPermissions() {
    try {
      this.permissions = await this.voiceService.requestPermissions();
      const toast = await this.toastController.create({
        message: 'Permissions updated',
        duration: 2000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Failed to request permissions:', error);
      const toast = await this.toastController.create({
        message: 'Failed to request permissions',
        duration: 2000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    }
  }

  async saveSettings() {
    const alert = await this.alertController.create({
      header: 'Reinitialize Voice Service',
      message: 'Changing these settings will reinitialize the voice service. Continue?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Continue',
          handler: async () => {
            try {
              // Update environment
              environment.cxone.agentId = this.agentId;
              environment.cxone.apiKey = this.apiKey;
              environment.cxone.tenantId = this.tenantId;
              environment.cxone.clientId = this.clientId;
              environment.cxone.clientSecret = this.clientSecret;
              environment.cxone.defaultSkillId = this.defaultSkillId;
              environment.cxone.environment = this.selectedEnvironment as any;
              
              // Reinitialize voice service
              await this.voiceService.initialize();
              
              const toast = await this.toastController.create({
                message: 'Settings saved and voice service reinitialized',
                duration: 3000,
                position: 'bottom',
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              console.error('Failed to reinitialize:', error);
              const toast = await this.toastController.create({
                message: 'Failed to reinitialize voice service',
                duration: 3000,
                position: 'bottom',
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  getPermissionIcon(status: string): string {
    switch (status) {
      case 'granted':
        return 'checkmark-circle';
      case 'denied':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  }

  getPermissionColor(status: string): string {
    switch (status) {
      case 'granted':
        return 'success';
      case 'denied':
        return 'danger';
      default:
        return 'warning';
    }
  }

  async loginToCxone(): Promise<void> {
    try {
      await this.cxoneService.login();
      // The login will redirect to CXONE auth page
    } catch (error) {
      console.error('Failed to login:', error);
      const toast = await this.toastController.create({
        message: 'Failed to login to CXONE',
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    }
  }

  async logoutFromCxone(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout from CXONE?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: async () => {
            try {
              await this.cxoneService.logout();
              this.isAuthenticated = false;
              
              const toast = await this.toastController.create({
                message: 'Logged out successfully',
                duration: 2000,
                position: 'bottom',
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              console.error('Failed to logout:', error);
              const toast = await this.toastController.create({
                message: 'Failed to logout',
                duration: 2000,
                position: 'bottom',
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private checkAuthStatus(): void {
    this.isAuthenticated = this.cxoneService.isInitialized;
  }

  toggleAuthMode(): void {
    this.authMode = this.authMode === 'oauth' ? 'legacy' : 'oauth';
  }
}