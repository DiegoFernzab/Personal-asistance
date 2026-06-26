import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DiaSemana } from './tarjetas.service';

export interface BloqueFijo {
  id: string;
  usuario_id: string;
  titulo: string;
  dia_semana: DiaSemana;
  semana_inicio: string;
  hora_inicio: string;
  hora_fin: string;
  creado_en?: string;
}

@Injectable({ providedIn: 'root' })
export class BloquesFijosService {
  private supabase = inject(SupabaseService);

  async getBloquesFijos(semanaInicio: string): Promise<BloqueFijo[]> {
    const { data, error } = await this.supabase.client
      .from('bloques_fijos')
      .select('*')
      .eq('semana_inicio', semanaInicio)
      .order('hora_inicio', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createBloqueFijo(b: Omit<BloqueFijo, 'id' | 'usuario_id' | 'creado_en'>): Promise<void> {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');
    const { error } = await this.supabase.client.from('bloques_fijos').insert({ ...b, usuario_id: user.id });
    if (error) throw error;
  }

  async updateBloqueFijo(id: string, cambios: Partial<Omit<BloqueFijo, 'id' | 'usuario_id' | 'creado_en'>>): Promise<void> {
    const { error } = await this.supabase.client.from('bloques_fijos').update(cambios).eq('id', id);
    if (error) throw error;
  }

  async deleteBloqueFijo(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('bloques_fijos').delete().eq('id', id);
    if (error) throw error;
  }
}
