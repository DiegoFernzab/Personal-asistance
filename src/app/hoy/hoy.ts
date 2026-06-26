import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TarjetasService, Tarjeta, DiaSemana, EstadoTarjeta } from '../core/services/tarjetas.service';
import { HabitosService, Habito, RegistroHabito } from '../habitos/habitos.service';
import { NotasDiaService } from '../core/services/notas-dia.service';

const DIAS_JS_A_SEMANA: DiaSemana[] = [
  'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado',
];

export interface HabitoHoy {
  habito: Habito;
  cumplido: boolean;
}

export type ItemConHora =
  | { tipo: 'tarjeta'; tarjeta: Tarjeta }
  | { tipo: 'habito'; habito: Habito; cumplido: boolean };

function lunesDeEstaFecha(fecha: Date): Date {
  const d = new Date(fecha);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

@Component({
  selector: 'app-hoy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hoy.html',
  styleUrl: './hoy.scss',
})
export class Hoy implements OnInit, OnDestroy {
  private tarjetasSvc = inject(TarjetasService);
  private habitosSvc = inject(HabitosService);
  private notasSvc = inject(NotasDiaService);

  private tarjetas = signal<Tarjeta[]>([]);
  private habitos = signal<Habito[]>([]);
  private registros = signal<RegistroHabito[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  notaContenido  = signal('');
  notaGuardando  = signal(false);
  notaGuardada   = signal(false);
  notaError      = signal<string | null>(null);

  private notaDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private notaGuardadaTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hoy = new Date();
  readonly diaHoy: DiaSemana = DIAS_JS_A_SEMANA[this.hoy.getDay()];
  readonly fechaHoyISO = toISO(this.hoy);
  readonly etiquetaFecha = this.hoy.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  private habitosHoyAll = computed<HabitoHoy[]>(() => {
    const diaHoy = this.diaHoy;
    const regs = this.registros();
    return this.habitos()
      .filter(h =>
        h.recurrencia === 'diaria' ||
        (h.recurrencia === 'dias_especificos' && h.dias_semana?.includes(diaHoy))
      )
      .map(h => ({
        habito: h,
        cumplido: regs.some(r => r.habito_id === h.id && r.cumplido),
      }));
  });

  sinHora = computed<Tarjeta[]>(() =>
    this.tarjetas()
      .filter(t => t.hora_inicio === null)
      .sort((a, b) => (a.orden_sin_hora ?? 0) - (b.orden_sin_hora ?? 0))
  );

  conHoraMixto = computed<ItemConHora[]>(() => {
    const items: ItemConHora[] = [
      ...this.tarjetas()
        .filter(t => t.hora_inicio !== null)
        .map(t => ({ tipo: 'tarjeta' as const, tarjeta: t })),
      ...this.habitosHoyAll()
        .filter(hh => hh.habito.hora_inicio !== null)
        .map(hh => ({ tipo: 'habito' as const, habito: hh.habito, cumplido: hh.cumplido })),
    ];
    return items.sort((a, b) => {
      const horaA = a.tipo === 'tarjeta' ? a.tarjeta.hora_inicio! : a.habito.hora_inicio!;
      const horaB = b.tipo === 'tarjeta' ? b.tarjeta.hora_inicio! : b.habito.hora_inicio!;
      return horaAMinutos(horaA) - horaAMinutos(horaB);
    });
  });

  habitosSinHora = computed<HabitoHoy[]>(() =>
    this.habitosHoyAll().filter(hh => hh.habito.hora_inicio === null)
  );

  async ngOnInit() {
    await this.cargar();
  }

  ngOnDestroy() {
    if (this.notaDebounceTimer) clearTimeout(this.notaDebounceTimer);
    if (this.notaGuardadaTimer) clearTimeout(this.notaGuardadaTimer);
  }

  private async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const semanaInicio = toISO(lunesDeEstaFecha(this.hoy));
      const [todasTarjetas, habitos, registros, nota] = await Promise.all([
        this.tarjetasSvc.getTarjetas(semanaInicio),
        this.habitosSvc.getHabitos(),
        this.habitosSvc.getRegistrosDelDia(this.fechaHoyISO),
        this.notasSvc.getNota(this.fechaHoyISO),
      ]);
      this.tarjetas.set(todasTarjetas.filter(t => t.dia_semana === this.diaHoy));
      this.habitos.set(habitos);
      this.registros.set(registros);
      this.notaContenido.set(nota?.contenido ?? '');
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al cargar el día');
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarRegistros() {
    const regs = await this.habitosSvc.getRegistrosDelDia(this.fechaHoyISO);
    this.registros.set(regs);
  }

  async borrarTarjeta(tarjeta: Tarjeta) {
    this.tarjetas.update(ts => ts.filter(t => t.id !== tarjeta.id));
    try {
      await this.tarjetasSvc.deleteTarjeta(tarjeta.id);
    } catch (e: any) {
      this.tarjetas.update(ts => [...ts, tarjeta]);
      this.error.set(e?.message ?? 'Error al eliminar la tarjeta');
    }
  }

  async cambiarEstado(tarjeta: Tarjeta) {
    const ciclo: EstadoTarjeta[] = ['no_empezado', 'en_proceso', 'completado'];
    const siguiente = ciclo[(ciclo.indexOf(tarjeta.estado) + 1) % ciclo.length];

    this.tarjetas.update(todas =>
      todas.map(t => t.id === tarjeta.id ? { ...t, estado: siguiente } : t)
    );

    try {
      await this.tarjetasSvc.updateTarjeta(tarjeta.id, { estado: siguiente });
    } catch (e: any) {
      this.tarjetas.update(todas =>
        todas.map(t => t.id === tarjeta.id ? { ...t, estado: tarjeta.estado } : t)
      );
      this.error.set(e?.message ?? 'Error al cambiar el estado');
    }
  }

  async toggleHabito(item: HabitoHoy) {
    const nuevoCumplido = !item.cumplido;

    this.registros.update(regs => {
      const idx = regs.findIndex(r => r.habito_id === item.habito.id);
      if (idx >= 0) {
        const updated = [...regs];
        updated[idx] = { ...regs[idx], cumplido: nuevoCumplido };
        return updated;
      }
      return [...regs, { id: '', habito_id: item.habito.id, fecha: this.fechaHoyISO, cumplido: nuevoCumplido }];
    });

    try {
      await this.habitosSvc.marcarCumplido(item.habito.id, this.fechaHoyISO, nuevoCumplido);
    } catch (e: any) {
      await this.cargarRegistros();
      this.error.set(e?.message ?? 'Error al actualizar el hábito');
    }
  }

  onNotaInput(valor: string) {
    this.notaContenido.set(valor);
    this.notaGuardada.set(false);
    this.notaError.set(null);
    if (this.notaDebounceTimer) clearTimeout(this.notaDebounceTimer);
    this.notaDebounceTimer = setTimeout(() => this.guardarNota(), 800);
  }

  private async guardarNota() {
    const contenido = this.notaContenido();
    this.notaGuardando.set(true);
    this.notaError.set(null);
    try {
      await this.notasSvc.upsertNota(this.fechaHoyISO, contenido);
      this.notaGuardada.set(true);
      if (this.notaGuardadaTimer) clearTimeout(this.notaGuardadaTimer);
      this.notaGuardadaTimer = setTimeout(() => this.notaGuardada.set(false), 2000);
    } catch (e: any) {
      this.notaError.set(e?.message ?? 'Error al guardar');
    } finally {
      this.notaGuardando.set(false);
    }
  }

  formatHoraRango(inicio: string, fin: string | null): string {
    const h = inicio.slice(0, 5);
    return fin ? `${h}–${fin.slice(0, 5)}` : h;
  }

  limpiarError() {
    this.error.set(null);
  }
}
