import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface NotaDia {
  id: string;
  fecha: string;
  contenido: string;
  actualizado_en: string;
}

@Injectable({ providedIn: 'root' })
export class NotasDiaService {
  private supabase = inject(SupabaseService);

  async getNota(fecha: string): Promise<NotaDia | null> {
    const { data, error } = await this.supabase.client
      .from('notas_dia')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertNota(fecha: string, contenido: string): Promise<void> {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');
    const { error } = await this.supabase.client
      .from('notas_dia')
      .upsert(
        { usuario_id: user.id, fecha, contenido, actualizado_en: new Date().toISOString() },
        { onConflict: 'usuario_id,fecha' }
      );
    if (error) throw error;
  }

  async getNotasEnRango(desde: string, hasta: string): Promise<NotaDia[]> {
    const { data, error } = await this.supabase.client
      .from('notas_dia')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return data;
  }
}
