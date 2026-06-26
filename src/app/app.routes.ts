import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'semana', pathMatch: 'full' },
  {
    path: 'semana',
    loadComponent: () => import('./semana/semana').then(m => m.Semana),
    canActivate: [authGuard],
  },
  {
    path: 'hoy',
    loadComponent: () => import('./hoy/hoy').then(m => m.Hoy),
    canActivate: [authGuard],
  },
  {
    path: 'habitos',
    loadComponent: () => import('./habitos/habitos').then(m => m.Habitos),
    canActivate: [authGuard],
  },
  {
    path: 'reporte',
    loadComponent: () => import('./reporte/reporte').then(m => m.Reporte),
    canActivate: [authGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then(m => m.Login),
  },
];
