import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TarjetasService, Tarjeta, DiaSemana } from '../core/services/tarjetas.service';
import { HabitosService, Habito, RegistroHabito } from '../habitos/habitos.service';
import { NotasDiaService, NotaDia } from '../core/services/notas-dia.service';

// ── Tipos internos ───────────────────────────────────────
interface ResumenTarjetas {
  total: number;
  completadas: number;
  porcentaje: number;
  incompletas: string[];
}

interface ResumenHabito {
  habito: Habito;
  aplicables: number;
  cumplidos: number;
  porcentaje: number;
}

type BotonRapido = 'semana' | 'semana_pasada' | 'mes' | '7dias';

// ── Helpers de fecha ─────────────────────────────────────
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function lunesDe(d: Date): string {
  const fecha = new Date(d);
  fecha.setHours(0, 0, 0, 0);
  const dow = fecha.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  fecha.setDate(fecha.getDate() + diff);
  return toISO(fecha);
}

function primerDiaMes(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

function rangoPara(boton: BotonRapido): [string, string] {
  const hoy = hoyISO();
  const lunesActual = lunesDe(new Date());
  switch (boton) {
    case 'semana':
      return [lunesActual, hoy];
    case 'semana_pasada': {
      const lunesAnt = addDias(lunesActual, -7);
      return [lunesAnt, addDias(lunesAnt, 6)];
    }
    case 'mes':
      return [primerDiaMes(hoy), hoy];
    case '7dias':
      return [addDias(hoy, -6), hoy];
  }
}

// ── Cálculo de cumplimiento ──────────────────────────────
const DIAS_JS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function calcularCumplimientoEnRango(
  habito: Habito,
  registros: RegistroHabito[],
  desde: string,
  hasta: string
): { aplicables: number; cumplidos: number } {
  const mapa = new Map(
    registros.filter(r => r.habito_id === habito.id).map(r => [r.fecha, r.cumplido])
  );
  let aplicables = 0;
  let cumplidos = 0;
  const d = new Date(desde + 'T00:00:00');
  const fin = new Date(hasta + 'T00:00:00');
  while (d <= fin) {
    const iso = toISO(d);
    const dia = DIAS_JS[d.getDay()];
    const aplica = habito.recurrencia === 'diaria' || (habito.dias_semana?.includes(dia) ?? false);
    if (aplica) {
      aplicables++;
      if (mapa.get(iso) === true) cumplidos++;
    }
    d.setDate(d.getDate() + 1);
  }
  return { aplicables, cumplidos };
}

// ── Fecha real de una tarjeta ────────────────────────────
const DIA_OFFSET: Record<DiaSemana, number> = {
  lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6,
};

function fechaDeTarjeta(t: Tarjeta): string {
  const d = new Date(t.semana_inicio + 'T00:00:00');
  d.setDate(d.getDate() + DIA_OFFSET[t.dia_semana]);
  return toISO(d);
}

// ── Componente ───────────────────────────────────────────
@Component({
  selector: 'app-reporte',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './reporte.html',
  styleUrl: './reporte.scss',
})
export class Reporte implements OnInit {
  private tarjetasSvc = inject(TarjetasService);
  private habitosSvc = inject(HabitosService);
  private notasSvc = inject(NotasDiaService);

  rangoDesde    = signal('');
  rangoHasta    = signal('');
  botonActivo   = signal<BotonRapido | null>(null);
  cargando      = signal(false);
  error         = signal<string | null>(null);

  private tarjetas  = signal<Tarjeta[]>([]);
  private habitos   = signal<Habito[]>([]);
  private registros = signal<RegistroHabito[]>([]);
  notas = signal<NotaDia[]>([]);

  resumenTarjetas = computed<ResumenTarjetas>(() => {
    const desde = this.rangoDesde();
    const hasta = this.rangoHasta();
    if (!desde || !hasta) return { total: 0, completadas: 0, porcentaje: 0, incompletas: [] };

    const efectivoHasta = hasta < hoyISO() ? hasta : hoyISO();
    const tarjetas = this.tarjetas().filter(t => {
      const f = fechaDeTarjeta(t);
      return f >= desde && f <= efectivoHasta;
    });
    const total = tarjetas.length;
    const completadas = tarjetas.filter(t => t.estado === 'completado').length;
    const porcentaje = total === 0 ? 0 : Math.round(completadas / total * 100);
    const incompletas = tarjetas
      .filter(t => t.estado !== 'completado')
      .map(t => t.titulo);
    return { total, completadas, porcentaje, incompletas };
  });

  resumenHabitos = computed<ResumenHabito[]>(() => {
    const desde = this.rangoDesde();
    const hasta = this.rangoHasta();
    if (!desde || !hasta) return [];

    const efectivoHasta = hasta < hoyISO() ? hasta : hoyISO();
    return this.habitos()
      .map(h => {
        const { aplicables, cumplidos } = calcularCumplimientoEnRango(
          h, this.registros(), desde, efectivoHasta
        );
        const porcentaje = aplicables === 0 ? 0 : Math.round(cumplidos / aplicables * 100);
        return { habito: h, aplicables, cumplidos, porcentaje };
      })
      .filter(r => r.aplicables > 0)
      .sort((a, b) => b.porcentaje - a.porcentaje);
  });

  ngOnInit() {
    this.seleccionar('semana');
  }

  seleccionar(boton: BotonRapido) {
    const [desde, hasta] = rangoPara(boton);
    this.rangoDesde.set(desde);
    this.rangoHasta.set(hasta);
    this.botonActivo.set(boton);
    this.cargar();
  }

  onDesdeChange(valor: string) {
    this.rangoDesde.set(valor);
    this.botonActivo.set(null);
    if (valor && this.rangoHasta()) this.cargar();
  }

  onHastaChange(valor: string) {
    this.rangoHasta.set(valor);
    this.botonActivo.set(null);
    if (this.rangoDesde() && valor) this.cargar();
  }

  private async cargar() {
    const desde = this.rangoDesde();
    const hasta = this.rangoHasta();
    if (!desde || !hasta || desde > hasta) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      const efectivoHasta = hasta < hoyISO() ? hasta : hoyISO();
      const lunes1 = lunesDe(new Date(desde + 'T00:00:00'));
      const lunes2 = lunesDe(new Date(efectivoHasta + 'T00:00:00'));

      const [tarjetas, habitos, registros, notas] = await Promise.all([
        this.tarjetasSvc.getTarjetasEnRango(lunes1, lunes2),
        this.habitosSvc.getHabitos(),
        this.habitosSvc.getRegistrosEnRango(desde, efectivoHasta),
        this.notasSvc.getNotasEnRango(desde, hasta),
      ]);

      this.tarjetas.set(tarjetas);
      this.habitos.set(habitos);
      this.registros.set(registros);
      this.notas.set(notas);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error al cargar el reporte');
    } finally {
      this.cargando.set(false);
    }
  }

  formatFecha(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  limpiarError() { this.error.set(null); }
}
