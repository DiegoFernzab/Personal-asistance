import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HabitosService, Habito, RegistroHabito } from './habitos.service';

// Índice JS: 0=domingo, 1=lunes, … 6=sábado
const DIAS_JS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function aplicaEnFecha(habito: Habito, fecha: Date): boolean {
  if (habito.recurrencia === 'diaria') return true;
  const dia = DIAS_JS[fecha.getDay()];
  return habito.dias_semana?.includes(dia) ?? false;
}

// Racha estricta: si hoy aplica y no está marcado, la racha es 0.
function calcularRacha(habito: Habito, registros: RegistroHabito[]): number {
  const mapa = new Map(registros.map(r => [r.fecha, r.cumplido]));
  let racha = 0;
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);

  for (let i = 0; i < 400; i++) {
    const iso = toISO(fecha);
    if (aplicaEnFecha(habito, fecha)) {
      if (mapa.get(iso) === true) {
        racha++;
      } else {
        break; // aplica hoy/ayer y no está marcado → corta aquí
      }
    }
    fecha.setDate(fecha.getDate() - 1);
  }
  return racha;
}

interface HabitoConEstado {
  habito: Habito;
  aplicaHoy: boolean;
  cumplidoHoy: boolean;
  racha: number;
}

@Component({
  selector: 'app-habitos',
  standalone: true,
  imports: [],
  templateUrl: './habitos.html',
  styleUrl: './habitos.scss',
})
export class Habitos implements OnInit {
  private habitosSvc = inject(HabitosService);

  private habitos   = signal<Habito[]>([]);
  private registros = signal<RegistroHabito[]>([]);
  cargando  = signal(true);
  guardando = signal(false);
  error     = signal<string | null>(null);

  formularioAbierto  = signal(false);
  formNombre         = signal('');
  formRecurrencia    = signal<'diaria' | 'dias_especificos'>('diaria');
  formDias           = signal<string[]>([]);
  formHoraInicio     = signal('');
  formHoraFin        = signal('');

  readonly hoyISO = toISO(new Date());

  readonly diasSemana = [
    { valor: 'lunes',     etiqueta: 'Lu' },
    { valor: 'martes',    etiqueta: 'Ma' },
    { valor: 'miercoles', etiqueta: 'Mi' },
    { valor: 'jueves',    etiqueta: 'Ju' },
    { valor: 'viernes',   etiqueta: 'Vi' },
    { valor: 'sabado',    etiqueta: 'Sá' },
    { valor: 'domingo',   etiqueta: 'Do' },
  ];

  habitosConEstado = computed<HabitoConEstado[]>(() => {
    const hoy  = new Date();
    const regs = this.registros();
    return this.habitos().map(h => {
      const regsHabito  = regs.filter(r => r.habito_id === h.id);
      const aplicaHoy   = aplicaEnFecha(h, hoy);
      const cumplidoHoy = regsHabito.some(r => r.fecha === this.hoyISO && r.cumplido);
      const racha       = calcularRacha(h, regsHabito);
      return { habito: h, aplicaHoy, cumplidoHoy, racha };
    });
  });

  async ngOnInit() { await this.cargar(); }

  private async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [habitos, registros] = await Promise.all([
        this.habitosSvc.getHabitos(),
        this.habitosSvc.getRegistrosTodos(),
      ]);
      this.habitos.set(habitos);
      this.registros.set(registros);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al cargar los hábitos');
    } finally {
      this.cargando.set(false);
    }
  }

  async toggleCumplido(hce: HabitoConEstado) {
    if (!hce.aplicaHoy) return;
    const nuevoCumplido = !hce.cumplidoHoy;

    // Optimistic update
    this.registros.update(rs => {
      const idx = rs.findIndex(r => r.habito_id === hce.habito.id && r.fecha === this.hoyISO);
      if (idx !== -1) {
        const copia = [...rs];
        copia[idx] = { ...rs[idx], cumplido: nuevoCumplido };
        return copia;
      }
      return [...rs, { id: crypto.randomUUID(), habito_id: hce.habito.id, fecha: this.hoyISO, cumplido: nuevoCumplido }];
    });

    try {
      await this.habitosSvc.marcarCumplido(hce.habito.id, this.hoyISO, nuevoCumplido);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al marcar el hábito');
      const registros = await this.habitosSvc.getRegistrosTodos();
      this.registros.set(registros);
    }
  }

  abrirFormulario() {
    this.formNombre.set('');
    this.formRecurrencia.set('diaria');
    this.formDias.set([]);
    this.formHoraInicio.set('');
    this.formHoraFin.set('');
    this.formularioAbierto.set(true);
  }

  cerrarFormulario() { this.formularioAbierto.set(false); }

  toggleDia(dia: string) {
    this.formDias.update(ds => ds.includes(dia) ? ds.filter(d => d !== dia) : [...ds, dia]);
  }

  async crearHabito() {
    const titulo = this.formNombre().trim();
    if (!titulo) return;
    if (this.formRecurrencia() === 'dias_especificos' && this.formDias().length === 0) return;
    if (this.guardando()) return;

    this.guardando.set(true);
    try {
      const horaInicio = this.formHoraInicio().trim() || null;
      await this.habitosSvc.createHabito({
        titulo,
        recurrencia: this.formRecurrencia(),
        dias_semana: this.formRecurrencia() === 'dias_especificos' ? [...this.formDias()] : null,
        activo: true,
        hora_inicio: horaInicio,
        hora_fin: (horaInicio && this.formHoraFin().trim()) ? this.formHoraFin().trim() : null,
      });
      const habitos = await this.habitosSvc.getHabitos();
      this.habitos.set(habitos);
      this.cerrarFormulario();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al crear el hábito');
    } finally {
      this.guardando.set(false);
    }
  }

  limpiarError() { this.error.set(null); }
}
