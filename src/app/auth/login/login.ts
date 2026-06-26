import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  cargando = signal(false);
  error = signal<string | null>(null);

  async onSubmit(email: string, password: string, event: Event) {
    event.preventDefault();
    this.cargando.set(true);
    this.error.set(null);

    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });

    if (error) {
      this.error.set('Email o contraseña incorrectos.');
      this.cargando.set(false);
    } else {
      this.router.navigate(['/semana']);
    }
  }
}
