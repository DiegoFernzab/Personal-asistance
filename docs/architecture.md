# Arquitectura Técnica — Tablero de Planificación Semanal y Hábitos

## 1. Visión general

```
┌─────────────────────────────────────────────┐
│              NAVEGADOR (Angular)             │
│  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Vista semanal│  │  Vista de hoy,        │ │
│  │ (drag & drop,│  │  hábitos, formulario   │ │
│  │ Angular CDK) │  │  de tarjetas           │ │
│  └──────────────┘  └───────────────────────┘ │
└─────────────────────┬─────────────────────────┘
                       │
              (CRUD directo, sin
               intermediario de IA)
                       │
                       ▼
              ┌──────────────────┐
              │     Supabase      │
              │  PostgreSQL +      │
              │  Auth              │
              └────────┬───────────┘
                       │
┌──────────────────────────────────────────────┐
│         PROCESO AUTOMÁTICO DIARIO (Fase 2)     │
│                                                  │
│  Vercel Cron (ej. 6:00am) → /api/enviar-correo  │
│       │                                          │
│       ├─► Lee tarjetas de hoy + hábitos de hoy  │
│       │    directo de Supabase (sin modificar    │
│       │    ni reprogramar nada)                  │
│       │                                          │
│       └─► Envía el correo del día vía Resend    │
└──────────────────────────────────────────────┘
```

**Principio clave:** no existe ninguna llamada a un proveedor de IA en este proyecto. Angular habla directo con Supabase para todo el CRUD (tarjetas, hábitos, bloques fijos). La única función serverless que existe es la del correo diario, y es puramente de lectura + envío — no toma decisiones ni reprograma nada.

## 2. Componentes

### 2.1 Frontend — Angular

**Mobile-first, iPhone.** Vista semanal y vista de hoy son las dos pantallas principales.

Módulos principales:
- `auth/` — login simple contra Supabase Auth
- `semana/` — vista semanal tipo agenda: columnas por día, bloques por hora, drag & drop con Angular CDK (`@angular/cdk/drag-drop`)
- `hoy/` — vista del día actual: lista de tarjetas de hoy + hábitos de hoy, cambio de estado rápido
- `habitos/` — gestión de hábitos, marcar cumplido, ver racha
- `core/services/`
  - `supabase.service.ts` — cliente único de Supabase (singleton)
  - `tarjetas.service.ts` — CRUD de tarjetas (tareas)
  - `habitos.service.ts` — CRUD de hábitos y registros de cumplimiento
  - `bloques-fijos.service.ts` — CRUD de bloques fijos de la semana

🔸 Nota: ya no existen `captura/`, `disponibilidad/`, ni los tipos `ResultadoInterpretacion`/`ResultadoTarea`/etc. de la versión anterior con IA — esos módulos y tipos deben eliminarse del código si ya se habían creado.

### 2.2 Drag & drop (Angular CDK)

Se usa `@angular/cdk/drag-drop` para permitir arrastrar tarjetas entre bloques de hora/día en la vista semanal. Al soltar una tarjeta:
1. Se calcula el nuevo `dia_semana` y `hora_inicio`/`hora_fin` según dónde se soltó.
2. Se actualiza directo en Supabase (`tarjetas.service.ts`), sin validación de choques — el usuario es responsable de no superponer tarjetas si no quiere.

### 2.3 Función serverless — Vercel

Solo existe **una** función en este proyecto:

**`/api/enviar-correo`**
- Disparada por **Vercel Cron** (ej. `0 6 * * *` para 6:00am).
- Pasos:
  1. Consulta en Supabase las tarjetas de "hoy" (por `dia_semana` + fecha de la semana actual) y los hábitos que aplican hoy.
  2. Construye el contenido del correo (lista de tarjetas con su estado actual + hábitos del día).
  3. Envía el correo vía Resend.
- Usa la `service_role key` de Supabase porque corre sin sesión de usuario activa.
- **No modifica nada** — es una función de solo lectura + envío.

### 2.4 Supabase

- **Auth:** login simple, un solo usuario.
- **Base de datos:** ver `database-schema.md`.
- **RLS:** activado en todas las tablas, política de "solo el usuario autenticado accede a sus propios datos".

## 3. Variables de entorno

**Angular (frontend, públicas):**
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

**Vercel (función serverless `/api/enviar-correo`):**
```
RESEND_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

🔸 Nota: ya no se necesita `CLAUDE_API_KEY` en ningún lugar del proyecto — la integración con IA fue eliminada del diseño.

## 4. Estructura de carpetas

```
Personal-asistance/
├── src/app/                   # proyecto Angular (en la raíz del repo)
│   ├── auth/
│   ├── semana/
│   ├── hoy/
│   ├── habitos/
│   └── core/
│       ├── services/
│       └── models/
├── api/
│   └── enviar-correo.ts       # única función serverless (Fase 2)
├── docs/
│   ├── product-requirements.md
│   ├── architecture.md
│   ├── database-schema.md
│   ├── CLAUDE.md
│   └── HISTORIAL.md
└── vercel.json
```

🔸 Nota: `CLAUDE.md` e `HISTORIAL.md` viven en `docs/`, no en la raíz del repo — esto difiere de la convención más común (donde `CLAUDE.md` suele estar en la raíz para que las herramientas lo detecten automáticamente), pero es donde realmente están en este proyecto y Claude Code ya los lee correctamente desde ahí. Decisión consciente de Diego: se quedan en `docs/`.

## 5. Por qué este stack

- Cero costo de API de IA — toda la captura es manual, sin interpretación de lenguaje natural.
- Cero backend Java, cero Railway.
- Un solo repo, un solo despliegue en Vercel.
- Supabase resuelve datos + auth en una sola herramienta.
- La única función serverless es simple: lee y envía, no decide nada — bajo riesgo de bugs comparado con la lógica de reprogramación automática que se había diseñado antes.
