import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { TarjetasService, Tarjeta, DiaSemana, EstadoTarjeta } from '../core/services/tarjetas.service';
import { BloquesFijosService, BloqueFijo } from '../core/services/bloques-fijos.service';
import { FormTarjeta, FormTarjetaPayload } from './form-tarjeta/form-tarjeta';

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const HORA_INICIO_GRILLA = 7;
const HORA_FIN_GRILLA = 22;
const PX_POR_HORA = 64;
const MIN_ALTO_TARJETA = 32;
const ALTO_GRILLA_TOTAL = (HORA_FIN_GRILLA - HORA_INICIO_GRILLA) * PX_POR_HORA; // 960px

export interface TarjetaConPosicion {
  tarjeta: Tarjeta;
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
}

export interface BloqueConPosicion {
  bloque: BloqueFijo;
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
}

export interface ColumnaDia {
  dia: DiaSemana;
  fecha: Date;
  etiqueta: string;
  sinHora: Tarjeta[];
  conHora: TarjetaConPosicion[];
  bloques: BloqueConPosicion[];
}

// ── Helpers ────────────────────────────────────────────────

function lunes(fecha: Date): Date {
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

function minutosAHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ── Algoritmo de posicionamiento con clusters ──────────────
// Tarjetas y bloques fijos que se solapan en el tiempo forman un cluster;
// dentro del cluster cada item recibe 1/N del ancho de la columna.

type ItemUnificado =
  | { tipo: 'tarjeta'; id: string; inicio: number; fin: number; data: Tarjeta }
  | { tipo: 'bloque';  id: string; inicio: number; fin: number; data: BloqueFijo };

function calcularPosiciones(
  tarjetas: Tarjeta[],
  bloques: BloqueFijo[],
): { conHora: TarjetaConPosicion[]; bloques: BloqueConPosicion[] } {
  const items: ItemUnificado[] = [
    ...tarjetas.map(t => ({
      tipo: 'tarjeta' as const,
      id: t.id,
      inicio: horaAMinutos(t.hora_inicio!),
      fin:    horaAMinutos(t.hora_fin!),
      data:   t,
    })),
    ...bloques.map(b => ({
      tipo: 'bloque' as const,
      id: b.id,
      inicio: horaAMinutos(b.hora_inicio),
      fin:    horaAMinutos(b.hora_fin),
      data:   b,
    })),
  ];

  if (items.length === 0) return { conHora: [], bloques: [] };

  items.sort((a, b) => a.inicio - b.inicio);

  const clusters: ItemUnificado[][] = [];
  for (const item of items) {
    const ultimo = clusters[clusters.length - 1];
    if (!ultimo) { clusters.push([item]); continue; }
    const finCluster = Math.max(...ultimo.map(i => i.fin));
    if (item.inicio < finCluster) { ultimo.push(item); }
    else { clusters.push([item]); }
  }

  const conHora: TarjetaConPosicion[] = [];
  const bloquesResult: BloqueConPosicion[] = [];

  for (const cluster of clusters) {
    const n = cluster.length;
    cluster.forEach((item, i) => {
      const topPx    = ((item.inicio - HORA_INICIO_GRILLA * 60) / 60) * PX_POR_HORA;
      const heightPx = Math.max(MIN_ALTO_TARJETA, ((item.fin - item.inicio) / 60) * PX_POR_HORA);
      const leftPct  = (i / n) * 100;
      const widthPct = (1 / n) * 100;

      if (item.tipo === 'tarjeta') {
        conHora.push({ tarjeta: item.data, topPx, heightPx, leftPct, widthPct });
      } else {
        bloquesResult.push({ bloque: item.data, topPx, heightPx, leftPct, widthPct });
      }
    });
  }

  return { conHora, bloques: bloquesResult };
}

// ── Componente ─────────────────────────────────────────────

@Component({
  selector: 'app-semana',
  standalone: true,
  imports: [DragDropModule, FormTarjeta],
  templateUrl: './semana.html',
  styleUrl: './semana.scss',
})
export class Semana implements OnInit {
  private tarjetasSvc = inject(TarjetasService);
  private bloquesSvc  = inject(BloquesFijosService);

  semanaInicio = signal<Date>(lunes(new Date()));
  private tarjetas = signal<Tarjeta[]>([]);
  private bloques  = signal<BloqueFijo[]>([]);
  cargando = signal(true);
  error    = signal<string | null>(null);

  formularioAbierto   = signal(false);
  contextoFormulario  = signal<{ dia: DiaSemana | null; hora: number | null }>({ dia: null, hora: null });
  semanaInicioISO     = computed(() => toISO(this.semanaInicio()));

  tarjetaEnModoBorrado = signal<string | null>(null);
  private presionTimer: ReturnType<typeof setTimeout> | null = null;
  private borradoAutoTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Gestión de bloques fijos ───────────────────────────────
  gestionBloquesAbierta = signal(false);
  formBloqueNombre      = signal('');
  formBloqueDia         = signal<DiaSemana>('lunes');
  formBloqueInicio      = signal('');
  formBloqueFin         = signal('');
  formBloqueGuardando   = signal(false);

  bloquesOrdenados = computed(() => {
    const orden: Record<DiaSemana, number> = {
      lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6,
    };
    return [...this.bloques()].sort(
      (a, b) => orden[a.dia_semana] - orden[b.dia_semana] || a.hora_inicio.localeCompare(b.hora_inicio)
    );
  });

  readonly nombresDia: Record<DiaSemana, string> = {
    lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
    jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
  };

  columnas = computed<ColumnaDia[]>(() => {
    const inicio        = this.semanaInicio();
    const todasTarjetas = this.tarjetas();
    const todosBloques  = this.bloques();

    return DIAS.map((dia, i) => {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);

      const tarjetasDia = todasTarjetas.filter(t => t.dia_semana === dia);
      const bloquesDia  = todosBloques.filter(b => b.dia_semana === dia);

      const sinHora = tarjetasDia
        .filter(t => t.hora_inicio === null)
        .sort((a, b) => (a.orden_sin_hora ?? 0) - (b.orden_sin_hora ?? 0));

      const conHoraTarjetas = tarjetasDia.filter(t => t.hora_inicio !== null);
      const { conHora, bloques } = calcularPosiciones(conHoraTarjetas, bloquesDia);

      const nombreDia = fecha.toLocaleDateString('es-MX', { weekday: 'short' });
      const numeroDia = fecha.getDate();
      const etiqueta  = `${nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1, 3)} ${numeroDia}`;

      return { dia, fecha, etiqueta, sinHora, conHora, bloques };
    });
  });

  semanaLabel = computed(() => {
    const inicio = this.semanaInicio();
    const fin    = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${inicio.toLocaleDateString('es-MX', opts)} – ${fin.toLocaleDateString('es-MX', opts)}`;
  });

  readonly horasGrilla = Array.from(
    { length: HORA_FIN_GRILLA - HORA_INICIO_GRILLA },
    (_, i) => HORA_INICIO_GRILLA + i
  );

  readonly pxPorHora       = PX_POR_HORA;
  readonly horaInicioGrilla = HORA_INICIO_GRILLA;
  readonly altoGrillaTotal  = ALTO_GRILLA_TOTAL;

  async ngOnInit() { await this.cargarSemana(); }

  async irSemana(delta: number) {
    const nueva = new Date(this.semanaInicio());
    nueva.setDate(nueva.getDate() + delta * 7);
    this.semanaInicio.set(nueva);
    await this.cargarSemana();
  }

  private async cargarSemana() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const iso = toISO(this.semanaInicio());
      const [tarjetas, bloques] = await Promise.all([
        this.tarjetasSvc.getTarjetas(iso),
        this.bloquesSvc.getBloquesFijos(iso),
      ]);
      this.tarjetas.set(tarjetas);
      this.bloques.set(bloques);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al cargar la semana');
    } finally {
      this.cargando.set(false);
    }
  }

  // ── Drag & drop ────────────────────────────────────────────

  async alSoltarSinHora(event: CdkDragDrop<any>, columna: ColumnaDia) {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      const lista = [...columna.sinHora];
      moveItemInArray(lista, event.previousIndex, event.currentIndex);

      this.tarjetas.update(todas =>
        todas.map(t => {
          const idx = lista.findIndex(l => l.id === t.id);
          return idx !== -1 ? { ...t, orden_sin_hora: idx } : t;
        })
      );

      try {
        await this.tarjetasSvc.reordenarSinHora(lista.map((t, i) => ({ id: t.id, orden_sin_hora: i })));
      } catch (e: any) {
        this.error.set(e?.message ?? 'Error al guardar el orden');
        await this.cargarSemana();
      }
    } else {
      // Cross-container: viene de otra sección sin-hora (Array) o de una grilla (string DiaSemana)
      const tarjeta   = event.item.data as Tarjeta;
      const diaDestino = columna.dia;
      const insertIdx  = Math.min(event.currentIndex, columna.sinHora.length);

      const destSinHora = [...columna.sinHora];
      destSinHora.splice(insertIdx, 0, tarjeta);
      const destUpdates = destSinHora.map((t, i) => ({ id: t.id, orden_sin_hora: i }));

      let srcUpdates: { id: string; orden_sin_hora: number }[] = [];
      if (Array.isArray(event.previousContainer.data)) {
        const srcCol = this.columnas().find(c => c.dia === tarjeta.dia_semana);
        if (srcCol) {
          srcUpdates = srcCol.sinHora
            .filter(t => t.id !== tarjeta.id)
            .map((t, i) => ({ id: t.id, orden_sin_hora: i }));
        }
      }

      this.tarjetas.update(todas =>
        todas.map(t => {
          if (t.id === tarjeta.id) {
            return { ...t, dia_semana: diaDestino, hora_inicio: null, hora_fin: null, orden_sin_hora: insertIdx };
          }
          const dest = destUpdates.find(d => d.id === t.id);
          if (dest) return { ...t, orden_sin_hora: dest.orden_sin_hora };
          const src = srcUpdates.find(s => s.id === t.id);
          if (src) return { ...t, orden_sin_hora: src.orden_sin_hora };
          return t;
        })
      );

      try {
        await this.tarjetasSvc.updateTarjeta(tarjeta.id, {
          dia_semana: diaDestino,
          hora_inicio: null,
          hora_fin: null,
          orden_sin_hora: insertIdx,
        });
        const renumber = [...srcUpdates, ...destUpdates.filter(d => d.id !== tarjeta.id)];
        if (renumber.length > 0) await this.tarjetasSvc.reordenarSinHora(renumber);
      } catch (e: any) {
        this.error.set(e?.message ?? 'Error al mover la tarjeta');
        await this.cargarSemana();
      }
    }
  }

  async alSoltarEnGrilla(event: CdkDragDrop<DiaSemana>, diaDestino: DiaSemana) {
    const tarjeta = event.item.data as Tarjeta;

    // Calcular hora destino desde la coordenada Y del drop relativa al grid
    const rect      = event.container.element.nativeElement.getBoundingClientRect();
    const relativeY = event.dropPoint.y - rect.top;
    const horaDestino = Math.max(
      HORA_INICIO_GRILLA,
      Math.min(HORA_FIN_GRILLA - 1, HORA_INICIO_GRILLA + Math.floor(relativeY / PX_POR_HORA))
    );

    // Preservar duración original; default 60 min si venía de sin-hora
    const duracionMin = (tarjeta.hora_inicio && tarjeta.hora_fin)
      ? horaAMinutos(tarjeta.hora_fin) - horaAMinutos(tarjeta.hora_inicio)
      : 60;

    const nuevoInicioMin = horaDestino * 60;
    const cambios: Partial<Omit<Tarjeta, 'id' | 'usuario_id' | 'creado_en'>> = {
      dia_semana:    diaDestino,
      hora_inicio:   minutosAHora(nuevoInicioMin),
      hora_fin:      minutosAHora(nuevoInicioMin + duracionMin),
      orden_sin_hora: null,
    };

    this.tarjetas.update(todas =>
      todas.map(t => t.id === tarjeta.id ? { ...t, ...cambios } : t)
    );

    try {
      await this.tarjetasSvc.updateTarjeta(tarjeta.id, cambios);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al mover la tarjeta');
      await this.cargarSemana();
    }
  }

  // ── Bloques fijos: CRUD desde la UI ───────────────────────

  abrirGestionBloques() {
    const diasJS: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    this.formBloqueNombre.set('');
    this.formBloqueDia.set(diasJS[new Date().getDay()]);
    this.formBloqueInicio.set('');
    this.formBloqueFin.set('');
    this.gestionBloquesAbierta.set(true);
  }

  cerrarGestionBloques() { this.gestionBloquesAbierta.set(false); }

  alCambiarBloqueInicio(valor: string) {
    this.formBloqueInicio.set(valor);
    if (!valor) { this.formBloqueFin.set(''); return; }
    if (!this.formBloqueFin() || this.formBloqueFin() <= valor) {
      const h = parseInt(valor.split(':')[0], 10);
      this.formBloqueFin.set(`${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`);
    }
  }

  async crearBloque() {
    const titulo = this.formBloqueNombre().trim();
    const inicio = this.formBloqueInicio();
    const fin    = this.formBloqueFin();
    if (!titulo || !inicio || !fin) return;
    if (fin <= inicio) {
      this.error.set('La hora de fin debe ser posterior a la de inicio');
      return;
    }
    if (this.formBloqueGuardando()) return;

    this.formBloqueGuardando.set(true);
    try {
      await this.bloquesSvc.createBloqueFijo({
        titulo,
        dia_semana:    this.formBloqueDia(),
        semana_inicio: toISO(this.semanaInicio()),
        hora_inicio:   inicio + ':00',
        hora_fin:      fin    + ':00',
      });
      const bloques = await this.bloquesSvc.getBloquesFijos(toISO(this.semanaInicio()));
      this.bloques.set(bloques);
      this.formBloqueNombre.set('');
      this.formBloqueInicio.set('');
      this.formBloqueFin.set('');
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al crear el bloque');
    } finally {
      this.formBloqueGuardando.set(false);
    }
  }

  async eliminarBloque(id: string) {
    this.bloques.update(bs => bs.filter(b => b.id !== id));
    try {
      await this.bloquesSvc.deleteBloqueFijo(id);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al eliminar el bloque');
      const bloques = await this.bloquesSvc.getBloquesFijos(toISO(this.semanaInicio()));
      this.bloques.set(bloques);
    }
  }

  // ── Formulario de tarjetas ─────────────────────────────────

  alPresionar(id: string) {
    if (this.tarjetaEnModoBorrado() === id) {
      this.cancelarModoBorrado();
      return;
    }
    this.cancelarModoBorrado();
    this.presionTimer = setTimeout(() => this.activarModoBorrado(id), 500);
  }

  alSoltarPresion() {
    if (this.presionTimer) {
      clearTimeout(this.presionTimer);
      this.presionTimer = null;
    }
  }

  private activarModoBorrado(id: string) {
    this.tarjetaEnModoBorrado.set(id);
    this.borradoAutoTimer = setTimeout(() => this.cancelarModoBorrado(), 4500);
  }

  cancelarModoBorrado() {
    this.tarjetaEnModoBorrado.set(null);
    if (this.borradoAutoTimer) {
      clearTimeout(this.borradoAutoTimer);
      this.borradoAutoTimer = null;
    }
  }

  async confirmarBorrado(id: string, event: Event) {
    event.stopPropagation();
    this.cancelarModoBorrado();
    this.tarjetas.update(ts => ts.filter(t => t.id !== id));
    try {
      await this.tarjetasSvc.deleteTarjeta(id);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al eliminar la tarjeta');
      await this.cargarSemana();
    }
  }

  abrirFormularioPorClick(event: MouseEvent, dia: DiaSemana, grillaEl: HTMLElement) {
    this.cancelarModoBorrado();
    const rect      = grillaEl.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const hora = Math.max(
      HORA_INICIO_GRILLA,
      Math.min(HORA_FIN_GRILLA - 1, HORA_INICIO_GRILLA + Math.floor(relativeY / PX_POR_HORA))
    );
    this.abrirFormulario(dia, hora);
  }

  abrirFormulario(dia?: DiaSemana, hora?: number) {
    this.contextoFormulario.set({ dia: dia ?? null, hora: hora ?? null });
    this.formularioAbierto.set(true);
  }

  cerrarFormulario() { this.formularioAbierto.set(false); }

  async alGuardar(payload: FormTarjetaPayload) {
    try {
      let orden_sin_hora: number | null = null;
      if (!payload.hora_inicio) {
        const sinHoraDelDia = this.tarjetas()
          .filter(t => t.dia_semana === payload.dia_semana && t.hora_inicio === null);
        orden_sin_hora = sinHoraDelDia.length > 0
          ? Math.max(...sinHoraDelDia.map(t => t.orden_sin_hora ?? 0)) + 1
          : 0;
      }
      const nueva = await this.tarjetasSvc.createTarjeta({
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        dia_semana: payload.dia_semana,
        hora_inicio: payload.hora_inicio,
        hora_fin: payload.hora_fin,
        semana_inicio: toISO(this.semanaInicio()),
        estado: 'no_empezado',
        orden_sin_hora,
      });
      this.tarjetas.update(ts => [...ts, nueva]);
      this.formularioAbierto.set(false);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al guardar la tarjeta');
      this.formularioAbierto.set(false);
    }
  }

  // ── Estado y utilidades ────────────────────────────────────

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

  limpiarError() { this.error.set(null); }

  formatoHora(h: number): string { return `${h}:00`; }

  esHoy(fecha: Date): boolean {
    const hoy = new Date();
    return (
      fecha.getDate()     === hoy.getDate()  &&
      fecha.getMonth()    === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
    );
  }
}
