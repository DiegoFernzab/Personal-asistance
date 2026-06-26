# PRD — Tablero de Planificación Semanal y Hábitos

**Organización:** JZSolutions
**Tipo:** Proyecto personal (uso individual, sin multiusuario)
**Plazo objetivo:** Fase 1 funcional en 4 días, fase 2 completa en 7 días
**Autor:** Diego

---

## 1. Problema

Diego quiere organizar su semana y su día en un tablero visual tipo agenda — algo similar a Trello pero pensado específicamente para planificación de tiempo (bloques de hora, no solo columnas), con seguimiento de hábitos y un correo diario automático con el plan del día.

## 2. Decisión de diseño clave (cambio de alcance respecto a versión anterior)

La versión original de este proyecto usaba IA (Claude API) para interpretar texto/voz en lenguaje natural y convertirlo en tareas estructuradas. **Esa idea se descartó.** Razón: el costo y la complejidad de integrar IA no se justifican frente a la fricción real que resuelve — llenar un formulario estructurado toma segundos, y el tablero ya da una estructura clara (días de la semana, bloques de hora) que hace innecesaria la interpretación automática de lenguaje libre.

**Resultado:** este proyecto NO usa Claude API, OpenAI, ni ningún servicio de IA en producción. Toda la captura es manual, a través de un formulario o clic directo sobre el tablero.

## 3. Objetivo

Una web personal donde Diego pueda:
1. Ver su semana completa en una vista tipo agenda (días en columnas, horas en filas, o similar).
2. Ver su día actual de forma simple, con las tarjetas de hoy y su estado.
3. Agregar tarjetas (tareas) de dos formas: con un botón "+" y formulario, o haciendo clic directo sobre un bloque de hora vacío en la vista semanal.
4. Mover tarjetas arrastrándolas (drag & drop) — entre horas, entre días, o entre estados.
5. Marcar cada tarjeta con uno de 3 estados: **No empezado**, **En proceso**, **Completado**.
6. Configurar hábitos y trackear su cumplimiento con racha (streak).
7. Reorganizar su día/semana manualmente, normalmente de noche, decidiendo qué pendiente se mueve y a dónde.
8. Recibir un correo automático cada mañana con el plan del día ya organizado (sin que el sistema reprograme nada por su cuenta — solo informa lo que Diego ya dejó listo).

## 4. Usuarios

Solo Diego. No hay multiusuario, no hay roles. Login simple con usuario/contraseña fijos vía Supabase Auth.

## 5. Flujo principal

```
[Diego agrega una tarjeta] 
   → botón "+" con formulario (título, día, hora_inicio, hora_fin)
   → o clic directo sobre un bloque vacío en la vista semanal
      ↓
[Tarjeta aparece en el tablero, estado = "No empezado"]
      ↓
[Durante el día: Diego cambia el estado a "En proceso" o "Completado"]
      ↓
[De noche: Diego revisa lo pendiente/en proceso y decide manualmente
 si lo arrastra a otro día/hora, o lo deja para retomar]
      ↓
[Mañana: correo automático con el plan del día tal como quedó organizado]
```

## 6. Features (alcance v1)

### 6.1 Vista semanal (planeación)
- [ ] Columnas por día (Lunes a Domingo), filas o bloques por hora
- [ ] Tarjetas posicionadas según su `hora_inicio`/`hora_fin`
- [ ] Clic sobre un bloque vacío abre formulario rápido para crear tarjeta ahí mismo (con día/hora prellenados)
- [ ] Botón "+" general también disponible, para crear sin necesidad de ubicar el bloque visualmente primero

### 6.2 Vista de hoy (ejecución)
- [ ] Lista simple de las tarjetas del día actual, ordenadas por hora
- [ ] Hábitos del día también visibles aquí
- [ ] Cambio de estado rápido (un tap/clic, sin abrir formulario completo)

### 6.3 Tarjetas y estados
- [ ] Cada tarjeta tiene: título, día, hora_inicio, hora_fin, estado
- [ ] 3 estados posibles: `no_empezado`, `en_proceso`, `completado`
- [ ] Cambiar de estado es una acción directa (ej. tap para ciclar entre los 3, o un menú corto)

### 6.4 Drag & drop
- [ ] Arrastrar una tarjeta para cambiar su día y/o hora en la vista semanal
- [ ] El usuario es responsable de evitar choques de horario — el sistema no bloquea ni reorganiza automáticamente, solo refleja dónde se soltó la tarjeta

### 6.5 Hábitos y seguimiento
- [ ] Crear hábitos con recurrencia (`diaria` o `dias_especificos`)
- [ ] Marcar cumplido/no cumplido por día
- [ ] Cálculo de racha (streak), respetando solo los días en que el hábito aplica

### 6.6 Bloques fijos de la semana (clases, tenis, etc.)
- [ ] Se agregan manualmente cada semana — NO hay configuración recurrente automática (decisión explícita de Diego: prefiere agregarlos a mano)
- [ ] Visualmente ocupan su espacio en la vista semanal igual que una tarjeta, pero se distinguen como "bloque fijo" (no tienen estado de completado/no completado)

### 6.7 Correo diario automático
- [ ] Cada mañana, a una hora fija, se envía un correo con el plan del día (tarjetas de hoy con su estado, + hábitos del día)
- [ ] El correo es puramente informativo — refleja lo que Diego ya organizó la noche anterior, no reprograma ni decide nada
- [ ] Implementado con Vercel Cron + Resend (plan gratuito)

## 7. Fuera de alcance v1

- Cualquier integración con Claude API, OpenAI, o servicio de IA — **eliminado del diseño**
- Captura por voz o texto libre interpretado automáticamente — **eliminado**
- Reprogramación automática de pendientes — ahora es 100% manual
- Bloques fijos recurrentes configurados una sola vez — se agregan a mano cada semana, por decisión de Diego
- Multiusuario / autenticación compleja
- Notificaciones push (fuera del correo diario)
- App móvil nativa
- Sincronización con Google Calendar
- Link de un clic desde el correo para marcar completado (puede revisarse en una iteración futura, no es parte de v1)

## 8. Stack final

- **Frontend:** Angular (mobile-first, iPhone), con drag & drop (Angular CDK)
- **Datos + Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Correo:** Resend (plan gratuito)
- **Automatización diaria:** Vercel Cron (solo dispara el envío del correo, sin lógica de reprogramación)
- **Despliegue:** Vercel (frontend + función serverless de correo) + Supabase (datos)
- **Sin IA en producción. Sin Spring Boot. Sin Railway.**

## 9. Fases de entrega

### Fase 1 — Día 1 a 4 (núcleo usable)
Vista semanal + vista de hoy + crear tarjetas (formulario y clic directo) + drag & drop + estados + hábitos con racha + bloques fijos manuales.

### Fase 2 — Día 5 a 7 (automatización del correo)
Función serverless de envío de correo + Vercel Cron + Resend, leyendo el estado actual del tablero cada mañana.

### Posibles mejoras futuras (no planeadas, solo anotadas)
- Link de un clic desde el correo para marcar completado
- Vista de mes además de semana
- Notificaciones

---

**Siguiente paso:** `architecture.md`, `database-schema.md` y `CLAUDE.md` reescritos con este alcance.
