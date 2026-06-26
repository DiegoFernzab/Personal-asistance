# CLAUDE.md

Este archivo le da contexto a Claude Code sobre este proyecto. Léelo completo antes de escribir código.

## Qué es este proyecto

Tablero de planificación semanal tipo agenda (uso personal de Diego): vista semanal con tarjetas posicionadas por día/hora, drag & drop para reorganizar, 3 estados por tarjeta (no_empezado / en_proceso / completado), hábitos con racha, y un correo diario automático que informa el plan del día.

**Cambio importante de diseño (ver HISTORIAL.md para el contexto completo):** la versión original de este proyecto usaba Claude API para interpretar texto/voz en lenguaje natural. Esa idea **se descartó por completo**. Este proyecto NO usa ningún servicio de IA en producción. Si encuentras código o referencias a `captura/`, `disponibilidad/`, `interpretar.service.ts`, `audio.service.ts`, `captura.types.ts`, o cualquier función `/api/interpretar` o `/api/transcribir` de una sesión anterior, **bórralos** — son resabios del diseño descartado.

Documentación completa en `/docs`:
- `product-requirements.md` — qué se construye y por qué (incluye la sección 2 explicando el cambio de diseño)
- `architecture.md` — cómo está armado técnicamente
- `database-schema.md` — tablas de Supabase

**Lee estos 3 documentos antes de tocar código si es la primera vez que trabajas en este proyecto en la sesión.**

## Stack (no cambiar sin discutirlo primero)

- **Frontend:** Angular, mobile-first (Diego usa iPhone), con drag & drop vía Angular CDK (`@angular/cdk/drag-drop`)
- **Datos + Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Correo:** Resend (plan gratuito), disparado por `/api/enviar-correo`
- **Automatización diaria:** Vercel Cron — corre `/api/enviar-correo` cada mañana. Esta función SOLO lee y envía, nunca modifica ni reprograma nada.
- **Despliegue:** Vercel (frontend + función serverless), Supabase (datos)
- **Sin Spring Boot, sin Railway, sin ningún proveedor de IA (Claude API, OpenAI, etc.) en este proyecto.**

## Cómo quiero que trabajes (Diego)

- **Plan primero, código después.** Antes de escribir o modificar código, dime en 3-5 líneas qué vas a hacer y espera mi confirmación, salvo que te diga explícitamente "procede sin confirmar" para una tarea puntual.
- **Una feature a la vez.** No mezcles, por ejemplo, la vista semanal con la de hábitos en el mismo cambio.
- **Prompts cortos y directos de mi parte — respuestas igual de directas tuyas.**
- **Verificación incremental.** Después de cada feature chica, dime cómo probarla yo mismo antes de seguir a la siguiente.
- **SQL directo cuando haga falta.** Dame el SQL para correrlo yo en el SQL Editor de Supabase — no asumas que tienes acceso directo a la base de datos.
- **HISTORIAL.md es tuyo, los docs no.** Registra cada cambio relevante en `HISTORIAL.md`. Pero **nunca edites** `CLAUDE.md`, `docs/product-requirements.md`, `docs/architecture.md`, ni `docs/database-schema.md` directamente — si algo que hiciste contradice esos documentos o ellos no lo cubren, anótalo en "Desajustes pendientes" de `HISTORIAL.md` y dímelo explícitamente. Yo (o Claude en el chat) actualizamos esos archivos, no tú.

## Convenciones de código

- **Angular:** standalone components, señales (`signal`/`computed`) para estado simple.
- **Nombres:** en español para términos de dominio (tarjeta, habito, bloque_fijo, racha), en inglés para términos técnicos genéricos (service, component).
- **Estilos:** mobile-first siempre, 375px de ancho primero.
- **Drag & drop:** usar `cdkDropList`/`cdkDrag` de Angular CDK; al soltar, actualizar `dia_semana`/`hora_inicio`/`hora_fin`/`semana_inicio` directo en Supabase vía `tarjetas.service.ts`, sin validación de choques de horario (el usuario es responsable).

## Variables de entorno (no hardcodear nunca)

```
# Angular (frontend, públicas) — src/environments/environment.development.ts
supabaseUrl
supabaseAnonKey

# Vercel (función serverless /api/enviar-correo, server-side)
RESEND_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

🔸 Ya NO se necesita `CLAUDE_API_KEY` en ningún lugar de este proyecto.

## Qué NO hacer

- No agregar Spring Boot, Railway, ni ningún backend Java.
- No integrar Claude API, OpenAI, ni ningún servicio de IA — el diseño actual es 100% manual/estructurado, sin interpretación de lenguaje natural.
- No agregar autenticación compleja — login simple de un solo usuario.
- No hacer que `/api/enviar-correo` modifique o reprograme tarjetas — es de solo lectura + envío.
- No bloquear ni auto-resolver choques de horario en el drag & drop — el usuario decide.
- No usar la `SUPABASE_SERVICE_ROLE_KEY` en código que corra en el navegador — solo en la función serverless.

## Orden sugerido de construcción

### Fase 1
1. Limpiar restos del diseño anterior con IA (módulos `captura/`, `disponibilidad/`, tipos `ResultadoInterpretacion`, etc. si existen)
2. Setup de tablas en Supabase (con RLS) + login simple funcionando
3. Servicios: `tarjetas.service.ts`, `habitos.service.ts`, `bloques-fijos.service.ts`
4. Vista semanal: columnas por día, bloques por hora, lectura de tarjetas + bloques fijos
5. Crear tarjeta: formulario con botón "+" Y clic directo sobre bloque vacío
6. Drag & drop de tarjetas en la vista semanal (Angular CDK)
7. Cambio de estado de tarjeta (no_empezado / en_proceso / completado)
8. Vista de hoy: lista de tarjetas del día actual + hábitos del día, cambio de estado rápido
9. Hábitos: crear, marcar cumplido, cálculo de racha
10. Bloques fijos: agregar manualmente cada semana, mostrar en la vista semanal

### Fase 2
11. Función serverless `/api/enviar-correo`: lee tarjetas + hábitos de hoy, construye el contenido
12. Integrar Resend
13. Configurar Vercel Cron
14. Pulido: edición/eliminación de tarjetas, hábitos y bloques fijos, manejo de errores
