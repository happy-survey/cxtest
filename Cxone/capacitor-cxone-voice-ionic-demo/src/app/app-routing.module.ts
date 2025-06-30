import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full'
  },
  {
    path: 'tabs',
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule)
  },
  {
    path: 'active-call',
    loadChildren: () => import('./pages/active-call/active-call.module').then( m => m.ActiveCallPageModule)
  },
  {
    path: 'incoming-call',
    loadChildren: () => import('./pages/incoming-call/incoming-call.module').then( m => m.IncomingCallPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }