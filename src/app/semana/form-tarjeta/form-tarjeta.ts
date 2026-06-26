import { Component, OnInit, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiaSemana } from '../../core/services/tarjetas.service';

export interface FormTarjetaPayload {
  titulo: string;
  descripcion: string | null;
  dia_semana: DiaSemana;
  hora_inicio: string | null;
  hora_fin: string | null;
}

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function padHora(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

@Component({
  selector: 'app-form-tarjeta',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-tarjeta.html',
  styleUrl: './form-tarjeta.scss',
})
export class FormTarjeta implements OnInit {
  semanaInicio = input.required<string>();
  diaPreseleccionado = input<DiaSemana | null>(null);
  horaPreseleccionada = input<number | null>(null);

  guardado = output<FormTarjetaPayload>();
  cancelado = output<void>();

  titulo = '';
  descripcion = '';
  diaSemana: DiaSemana = 'lunes';
  horaInicio = '';
  horaFin = '';
  errorMsg: string | null = null;

  opcionesDias = computed(() => {
    const inicio = new Date(this.semanaInicio() + 'T00:00:00');
    return DIAS.map((dia, i) => {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      const raw = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
      return { valor: dia, etiqueta: raw.charAt(0).toUpperCase() + raw.slice(1) };
    });
  });

  ngOnInit() {
    this.diaSemana = this.diaPreseleccionado() ?? 'lunes';
    const h = this.horaPreseleccionada();
    if (h !== null) {
      this.horaInicio = padHora(h);
      this.horaFin = padHora(Math.min(h + 1, 23));
    }
  }

  alCambiarHoraInicio(valor: string) {
    this.horaInicio = valor;
    if (!valor) {
      this.horaFin = '';
      return;
    }
    // Auto-ajusta hora_fin si está vacía o ya no queda después de la nueva hora_inicio
    if (!this.horaFin || this.horaFin <= valor) {
      const h = parseInt(valor.split(':')[0], 10);
      this.horaFin = padHora(Math.min(h + 1, 23));
    }
  }

  guardar() {
    const titulo = this.titulo.trim();
    if (!titulo) {
      this.errorMsg = 'El título es obligatorio';
      return;
    }
    const hi = this.horaInicio || null;
    const hf = this.horaFin || null;
    if (hi && hf && hf <= hi) {
      this.errorMsg = 'La hora de fin debe ser posterior a la de inicio';
      return;
    }
    this.errorMsg = null;
    this.guardado.emit({
      titulo,
      descripcion: this.descripcion.trim() || null,
      dia_semana: this.diaSemana,
      hora_inicio: hi ? hi + ':00' : null,
      hora_fin: hf ? hf + ':00' : null,
    });
  }

  cancelar() {
    this.cancelado.emit();
  }
}
