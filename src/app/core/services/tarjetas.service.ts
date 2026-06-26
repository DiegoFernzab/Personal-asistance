import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
export type EstadoTarjeta = 'no_empezado' | 'en_proceso' | 'completado';

export interface Tarjeta {
  id: string;
  usuario_id: string;
  titulo: string;
  dia_semana: DiaSemana;
  semana_inicio: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  orden_sin_hora: number | null;
  estado: EstadoTarjeta;
  descripcion?: string | null;
  creado_en?: string;
}

@Injectable({ providedIn: 'root' })
export class TarjetasService {
  private supabase = inject(SupabaseService);

  async getTarjetas(semanaInicio: string): Promise<Tarjeta[]> {
    const { data, error } = await this.supabase.client
      .from('tarjetas')
      .select('*')
      .eq('semana_inicio', semanaInicio);
    if (error) throw error;
    return data;
  }

  async reordenarSinHora(actualizaciones: { id: string; orden_sin_hora: number }[]): Promise<void> {
    const promesas = actualizaciones.map(({ id, orden_sin_hora }) =>
      this.supabase.client.from('tarjetas').update({ orden_sin_hora }).eq('id', id)
    );
    const resultados = await Promise.all(promesas);
    const error = resultados.find(r => r.error)?.error;
    if (error) throw error;
  }

  async createTarjeta(t: Omit<Tarjeta, 'id' | 'usuario_id' | 'creado_en'>): Promise<Tarjeta> {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');
    const { data, error } = await this.supabase.client
      .from('tarjetas')
      .insert({ ...t, usuario_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTarjeta(id: string, cambios: Partial<Omit<Tarjeta, 'id' | 'usuario_id' | 'creado_en'>>): Promise<void> {
    const { error } = await this.supabase.client.from('tarjetas').update(cambios).eq('id', id);
    if (error) throw error;
  }

  async deleteTarjeta(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('tarjetas').delete().eq('id', id);
    if (error) throw error;
  }

  async getTarjetasEnRango(lunes1: string, lunes2: string): Promise<Tarjeta[]> {
    const { data, error } = await this.supabase.client
      .from('tarjetas')
      .select('*')
      .gte('semana_inicio', lunes1)
      .lte('semana_inicio', lunes2);
    if (error) throw error;
    return data;
  }
}
