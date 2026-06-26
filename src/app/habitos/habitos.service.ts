import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../core/services/supabase.service';

export interface Habito {
  id: string;
  usuario_id: string;
  titulo: string;
  recurrencia: 'diaria' | 'dias_especificos';
  dias_semana: string[] | null;
  activo: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
  creado_en?: string;
}

export interface RegistroHabito {
  id: string;
  habito_id: string;
  fecha: string;
  cumplido: boolean;
}

@Injectable({ providedIn: 'root' })
export class HabitosService {
  private supabase = inject(SupabaseService);

  async getHabitos(): Promise<Habito[]> {
    const { data, error } = await this.supabase.client
      .from('habitos')
      .select('*')
      .eq('activo', true)
      .order('creado_en', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createHabito(h: Omit<Habito, 'id' | 'usuario_id' | 'creado_en'>): Promise<void> {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');
    const { error } = await this.supabase.client.from('habitos').insert({ ...h, usuario_id: user.id });
    if (error) throw error;
  }

  async updateHabito(id: string, cambios: Partial<Omit<Habito, 'id' | 'usuario_id' | 'creado_en'>>): Promise<void> {
    const { error } = await this.supabase.client.from('habitos').update(cambios).eq('id', id);
    if (error) throw error;
  }

  // ponytail: soft delete — registros_habito tiene FK sin ON DELETE CASCADE, borrar el hábito rompería el historial
  async deleteHabito(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('habitos').update({ activo: false }).eq('id', id);
    if (error) throw error;
  }

  async marcarCumplido(habitoId: string, fecha: string, cumplido = true): Promise<void> {
    const { error } = await this.supabase.client
      .from('registros_habito')
      .upsert({ habito_id: habitoId, fecha, cumplido }, { onConflict: 'habito_id,fecha' });
    if (error) throw error;
  }

  async getRegistros(habitoId: string): Promise<RegistroHabito[]> {
    const { data, error } = await this.supabase.client
      .from('registros_habito')
      .select('*')
      .eq('habito_id', habitoId)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getRegistrosDelDia(fecha: string): Promise<RegistroHabito[]> {
    const { data, error } = await this.supabase.client
      .from('registros_habito')
      .select('*')
      .eq('fecha', fecha);
    if (error) throw error;
    return data;
  }

  async getRegistrosTodos(): Promise<RegistroHabito[]> {
    const { data, error } = await this.supabase.client
      .from('registros_habito')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getRegistrosEnRango(desde: string, hasta: string): Promise<RegistroHabito[]> {
    const { data, error } = await this.supabase.client
      .from('registros_habito')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta);
    if (error) throw error;
    return data;
  }
}
