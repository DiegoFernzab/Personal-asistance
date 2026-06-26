# Esquema de Base de Datos — Supabase

Proyecto de un solo usuario. Se incluye `usuario_id` y RLS por buena práctica, aprovechando que Supabase Auth lo maneja nativamente.

## Tablas

### `tarjetas`
Las tareas/pendientes del tablero — equivalente a una tarjeta de Trello, pero con horario.

```sql
create table tarjetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) not null,
  titulo text not null,
  dia_semana text not null check (dia_semana in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  semana_inicio date not null,          -- fecha del lunes de la semana a la que pertenece esta tarjeta
  hora_inicio time,                     -- null si no se asignó bloque de hora
  hora_fin time,                        -- null si no se asignó bloque de hora
  orden_sin_hora integer,               -- solo se usa cuando hora_inicio es null; define el orden manual entre tarjetas sin hora del mismo día
  estado text not null default 'no_empezado' check (estado in ('no_empezado', 'en_proceso', 'completado')),
  creado_en timestamptz default now()
);

create index idx_tarjetas_usuario_semana on tarjetas(usuario_id, semana_inicio, dia_semana);
```

🔸 Nota sobre `orden_sin_hora`: solo tiene valor cuando `hora_inicio` es `null` — define la posición manual de la tarjeta dentro de la sección "sin hora" de su día (Diego puede reordenarlas arrastrando). Cuando una tarjeta sin hora se mueve, se reasignan los números de orden de las tarjetas afectadas en esa columna. Si `hora_inicio` tiene valor, `orden_sin_hora` se ignora (queda en `null`).

🔸 Nota sobre `semana_inicio`: identifica a qué semana pertenece la tarjeta (el lunes de esa semana, como fecha). Esto permite que la vista semanal muestre siempre la semana correcta y que el drag & drop entre días no tenga ambigüedad sobre "cuál lunes". Cuando Diego arrastra una tarjeta a otro día, solo cambia `dia_semana`/`hora_inicio`/`hora_fin`; si la mueve a la semana siguiente, también se actualiza `semana_inicio`.

### `bloques_fijos`
Actividades fijas de la semana (clases, tenis, etc.) — se agregan manualmente cada semana, sin recurrencia automática.

```sql
create table bloques_fijos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) not null,
  titulo text not null,                 -- ej. "Tenis", "Clase de inglés"
  dia_semana text not null check (dia_semana in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  semana_inicio date not null,
  hora_inicio time not null,
  hora_fin time not null,
  creado_en timestamptz default now()
);

create index idx_bloques_fijos_usuario_semana on bloques_fijos(usuario_id, semana_inicio, dia_semana);
```

🔸 Nota: `bloques_fijos` es una tabla separada de `tarjetas` porque conceptualmente son distintos — un bloque fijo no tiene `estado` (no se "completa", simplemente ocupa tiempo). Si en el futuro Diego decide que sí quiere recurrencia automática, esta tabla se puede extender con una columna `recurrente boolean` sin romper nada existente.

### `habitos`
Hábitos recurrentes con seguimiento de cumplimiento.

```sql
create table habitos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) not null,
  titulo text not null,
  recurrencia text not null check (recurrencia in ('diaria', 'dias_especificos')),
  dias_semana text[],                   -- ej. ['lunes','miercoles'], null si es diaria
  activo boolean default true,
  creado_en timestamptz default now()
);
```

### `registros_habito`
Marca si un hábito se cumplió o no en un día puntual.

```sql
create table registros_habito (
  id uuid primary key default gen_random_uuid(),
  habito_id uuid references habitos(id) not null,
  fecha date not null,
  cumplido boolean not null default true,
  creado_en timestamptz default now(),
  unique(habito_id, fecha)
);

create index idx_registros_habito_fecha on registros_habito(habito_id, fecha);
```

### `correos_enviados`
Log simple de correos diarios enviados.

```sql
create table correos_enviados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) not null,
  fecha date not null,
  estado text not null check (estado in ('enviado', 'fallido')),
  detalle_error text,
  creado_en timestamptz default now(),
  unique(usuario_id, fecha)
);
```

## Cálculo de racha (streak)

Igual que en el diseño anterior: se calcula dinámicamente desde `registros_habito`, considerando solo los días en que el hábito aplica según `recurrencia`/`dias_semana`. Se recomienda calcularlo en el frontend (Angular), no con una función SQL, dado el bajo volumen de datos de un solo usuario.

## Row Level Security (RLS)

Activar en las 5 tablas (`tarjetas`, `bloques_fijos`, `habitos`, `registros_habito`, `correos_enviados`):

```sql
alter table tarjetas enable row level security;

create policy "usuario_solo_sus_tarjetas"
on tarjetas
for all
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);
```

(Repetir la misma política, con su nombre correspondiente, para las demás tablas.)

🔸 Nota: la función `/api/enviar-correo` usa la `service_role key`, que se salta RLS por diseño — correcto porque corre sin sesión de usuario activa.

## Relación entre tablas

```
habitos (1) ──> (muchos) registros_habito
```

`tarjetas` y `bloques_fijos` son independientes entre sí y de `habitos` — no hay claves foráneas cruzadas entre ellas. Cada una vive en su propia tabla porque tienen campos y comportamiento distintos (estado vs. sin estado, recurrencia vs. semana específica).
