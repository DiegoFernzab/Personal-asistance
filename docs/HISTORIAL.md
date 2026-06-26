# HISTORIAL.md

Este archivo lo mantiene Claude Code. Registra qué se construyó, qué decisiones de nombres/estructura se tomaron que no estaban explícitas en los documentos, y qué desajustes hay pendientes de resolver con Diego.

**Regla para Claude Code:** este archivo SÍ lo puedes editar libremente (agregar entradas). Los archivos en `docs/` (`product-requirements.md`, `architecture.md`, `database-schema.md`) y `CLAUDE.md` NUNCA los edites tú — si detectas algo que los contradice o que ellos no cubren, anótalo aquí en "Desajustes pendientes" y díselo a Diego en tu respuesta. Diego (o Claude en el chat) son quienes actualizan esos documentos.

---

## ⚠️ CAMBIO DE DISEÑO IMPORTANTE — 2026-06-22

Diego decidió **eliminar por completo la integración con IA** (Claude API) del proyecto, por costo y complejidad innecesaria frente al problema real que resuelve. El producto pasó de "captura libre por voz/texto interpretada por IA" a **"tablero estructurado tipo agenda, captura 100% manual"**.

`docs/product-requirements.md`, `docs/architecture.md` y `docs/database-schema.md` ya fueron reescritos para reflejar el nuevo diseño. `CLAUDE.md` también. **Lee los 4 documentos completos antes de seguir trabajando, incluso si ya los habías leído antes** — el contenido cambió de fondo, no es un ajuste menor.

### Qué quedó invalidado del trabajo anterior (debe limpiarse del código si todavía existe):
- `core/models/captura.types.ts` (tipos `ResultadoTarea`, `ResultadoHabito`, `ResultadoDisponibilidad`, `ResultadoInterpretacion`)
- `captura/` (módulo completo: pantalla de captura por texto/audio)
- `disponibilidad/` (módulo completo — el concepto de "disponibilidad" fue reemplazado por `bloques_fijos`, con modelo de datos distinto)
- `calendario/tareas.service.ts`, `habitos/habitos.service.ts` (versión vieja con tipos de IA) — revisar y adaptar al nuevo modelo, no necesariamente borrar si la lógica de Supabase sirve
- `core/services/interpretar.service.ts`
- `core/services/audio.service.ts` (con `MediaRecorder`)
- Cualquier función `/api/interpretar` o `/api/transcribir` si llegó a crearse
- Cualquier referencia a `CLAUDE_API_KEY`

### Qué sigue siendo válido sin cambios:
- Setup base de Angular (proyecto, sin SSR, standalone, mobile-first, tab bar)
- `core/services/supabase.service.ts` (cliente singleton)
- `src/environments/environment.ts` / `environment.development.ts` con `supabaseUrl`/`supabaseAnonKey`
- `angular.json` con `fileReplacements` para development

### Dato útil que queda registrado (no aplica al diseño actual, pero por si sirve después):
`MediaRecorder` fue probado y confirmado funcional en Safari iOS (el dispositivo real de Diego) durante el diseño anterior. Si en el futuro se retoma alguna idea de captura por audio, no hay que re-validar ese riesgo desde cero.

---

## Desajustes pendientes

*(ninguno activo)*

---

### D1 — RESUELTO (2026-06-23)
`CLAUDE.md` e `HISTORIAL.md` viven en `docs/` — decisión consciente de Diego. `architecture.md` ya refleja esto con nota explicativa en la sección de estructura de carpetas. No hay nada que mover ni corregir.

## Registro de cambios

### 2026-06-25 — Pantalla Reporte + Notas de fin de día

**Archivos nuevos:** `reporte/reporte.ts`, `reporte/reporte.html`, `reporte/reporte.scss`, `core/services/notas-dia.service.ts`.

**Archivos modificados:** `hoy.ts`, `hoy.html`, `hoy.scss`, `tarjetas.service.ts`, `habitos.service.ts`, `app.routes.ts`.

**Acceso:** botón de gráfico (ícono de barras) en el header de `/hoy`. Navega a `/reporte` (lazy-loaded, protegida con `authGuard`). No ocupa pestaña del tab bar.

**Notas de fin de día (`notas_dia`):** campo textarea al final de `/hoy`, auto-guardado con debounce de 800ms via `upsertNota`. Indicador de estado: "Guardando…" (ámbar), "Guardado ✓" (verde, desaparece a los 2 s), error (rojo). La nota del día actual se carga en `ngOnInit` junto con el resto de datos. `upsertNota` inyecta `usuario_id` explícitamente (patrón conocido de RLS). En `/reporte` las notas son de solo lectura.

**Reporte — selector de rango:** 4 botones rápidos ("Esta semana", "Sem. pasada", "Este mes", "Últ. 7 días") + dos `<input type="date">` para rango manual. Tocar un botón actualiza los inputs; editar los inputs deselecciona el botón activo. Carga automática al cambiar el rango (si ambas fechas son válidas). Arranque por defecto: "Esta semana".

**Reporte — contenido (3 secciones):**
1. Tarjetas: `completadas / total` + barra + %. Lista de títulos incompletos. Tarjetas de días futuros excluidas con `min(hasta, hoy)`.
2. Hábitos: función nueva `calcularCumplimientoEnRango` — itera día a día en el rango, cuenta `aplicables` (según `recurrencia`/`dias_semana`) y `cumplidos` (registros con `cumplido: true`). Ordenados por % desc. Los hábitos sin días aplicables en el rango se omiten.
3. Notas del día: lista de notas en el rango, fecha formateada + contenido completo. Solo lectura.

**Fetch de tarjetas en rango:** `getTarjetasEnRango(lunes1, lunes2)` — query por `semana_inicio` (resolución de semana). Filtro fino en computed: calcula fecha real de cada tarjeta (`semana_inicio` + offset de `dia_semana`) y compara con [desde, efectivoHasta].

**`hoy.ts` — `OnDestroy`:** limpia los dos timers de debounce (`notaDebounceTimer`, `notaGuardadaTimer`) al destruir el componente.

### 2026-06-25 — Hora opcional en hábitos (en curso → ✓)

**Archivos modificados:** `habitos/habitos.service.ts`, `habitos/habitos.ts`, `habitos/habitos.html`, `habitos/habitos.scss`, `hoy/hoy.ts`, `hoy/hoy.html`, `hoy/hoy.scss`.

**DB:** columnas `hora_inicio` y `hora_fin` (`time`, nullable) ya existían en `habitos` desde sesión anterior.

**Decisión de display (confirmada por Diego):** si `hora_fin` existe, mostrar rango `HH:MM–HH:MM`; si no, solo `hora_inicio`. Aplica igual a tarjetas y hábitos.

**Formulario de hábitos:** se añadieron dos `<input type="time">` opcionales (inicio y fin). `hora_fin` queda deshabilitada si `hora_inicio` está vacío. Al crear, se envía `null` si no se llenaron.

**Vista `/hoy` — nueva estructura de 3 secciones:**
1. **"Programado"** — lista mezclada `conHoraMixto`: tarjetas con hora + hábitos con hora, ordenados cronológicamente por `hora_inicio`. Diferenciados visualmente: tarjeta = punto de color (chip-estado), hábito = ↻ gris (se vuelve verde al marcar).
2. **"Sin hora"** — solo tarjetas sin hora (sin cambio respecto a antes).
3. **"Hábitos"** — solo hábitos sin `hora_inicio`.

Los hábitos con hora NO aparecen en la grilla semanal (decidido); solo afectan `/hoy`.

**Tipo `ItemConHora`:** unión discriminada `{ tipo: 'tarjeta'; tarjeta: Tarjeta } | { tipo: 'habito'; habito: Habito; cumplido: boolean }`. Permite un solo `@for` con `@if` interno en el template sin perder type safety.

**`toggleHabito`** sigue tomando `HabitoHoy`. Desde el template de la lista mezclada se pasa `{ habito: item.habito, cumplido: item.cumplido }` — mismo shape que `HabitoHoy`, sin necesidad de overload.

### 2026-06-25 — Paso 10: bloques fijos desde la interfaz (crear + eliminar)

**Archivos modificados:** `semana.ts`, `semana.html`, `semana.scss`.

Botón `⊞` en la cabecera de semana abre un bottom sheet con: (1) lista de bloques de la semana actual ordenados por día y hora, con botón `✕` para eliminar sin confirmación; (2) formulario de creación con título, selector de día (etiquetas de la semana en curso), y campos `<input type="time">` con auto-ajuste de hora_fin (igual que `form-tarjeta`). Eliminación optimista con rollback si falla la llamada al servicio.

El bug de RLS en `createBloqueFijo` fue corregido preventivamente antes de construir esta UI (ver entrada anterior sobre `getUser()`).

**Desajuste pendiente D2:** `deleteTarjeta(id)` existe en `tarjetas.service.ts` pero no tiene UI. Sin botón de eliminar en `semana.html` ni `hoy.html`. Pendiente para el paso 14 (edición/eliminación en Fase 2).

### 2026-06-25 — Fix RLS: createHabito + createBloqueFijo no inyectaban usuario_id

Causa: `insert()` sin `usuario_id` explícito viola la política de RLS en INSERT (que requiere `usuario_id = auth.uid()`). Fix aplicado a `habitos.service.ts → createHabito` y `bloques-fijos.service.ts → createBloqueFijo`. `tarjetas.service.ts → createTarjeta` ya tenía el fix. `marcarCumplido` (upsert en `registros_habito`) no necesita el fix — esa tabla no tiene `usuario_id` directamente.

**Regla para no repetir:** cualquier `insert()` en una tabla con RLS que tenga columna `usuario_id` debe llamar `supabase.auth.getUser()` primero y pasar `usuario_id: user.id` en el payload.

### 2026-06-25 — Paso 9: vista de hábitos completa

**Archivos nuevos/modificados:** `habitos/habitos.ts` (reescritura), `habitos/habitos.html` (nuevo), `habitos/habitos.scss` (nuevo), `habitos/habitos.service.ts` (agregado `getRegistrosTodos`).

**Tabla usada:** `registros_habito` (consistente entre servicio y schema).

**Lógica de racha:** función `calcularRacha` itera hacia atrás desde hoy. Si el día de hoy aplica al hábito y no está marcado como cumplido, la racha es 0 inmediatamente (sin gracia). Solo se incrementa la racha si `cumplido: true` en `registros_habito`; el primer día aplicable sin registro rompe el conteo.

**Carga de datos:** `getRegistrosTodos()` — una sola query sin filtros, con los resultados filtrados por `habito_id` en el cliente dentro de `habitosConEstado` computed. Evita N+1 queries al cargar la vista.

**Toggle optimista:** `toggleCumplido` actualiza `registros` signal inmediatamente (con `crypto.randomUUID()` como id temporal si el registro no existe), llama al servicio, y solo hace rollback si la llamada falla.

**Formulario:** inline en el componente (no subcomponente). Campo nombre + radio diaria/días específicos + chips de días (Lun–Dom) condicionales. Botón Guardar deshabilitado si nombre vacío, o si `dias_especificos` sin ningún día seleccionado.

**Hábitos que no aplican hoy:** visibles en la lista pero con 50% opacidad y botón de check deshabilitado. Se muestra el chip "hoy no" en lugar de la racha.

### 2026-06-25 — CIERRE: ciclo de bugs visuales de la vista semanal ✓

La vista semanal (`/semana`) está completa y aprobada visualmente por Diego. Probados: tarjetas de distinta duración, solapamiento tarjeta-bloque fijo (división de ancho por cluster), drag & drop entre columnas, drag & drop de sin-hora a grilla y viceversa.

**El ciclo completo:** se intentaron tres rondas de fixes incrementales sobre el sistema de franjas (`cdkDropList` por hora) — altura incorrecta para tarjetas multi-hora, texto roto letra por letra, franjas desalineadas entre columnas, sección sin-hora desalineada — antes de concluir que el diseño de base era el problema. Ver entradas del 2026-06-24 más abajo para el detalle de cada parche.

**Solución final:** reescritura a patrón tipo Google Calendar: grilla de altura fija (`960px`, 64px/hora, 7–22h), tarjetas y bloques fijos posicionados con `position: absolute` calculado desde duración en minutos, CSS Grid de 3 filas para alinear sin-hora automáticamente, algoritmo de clusters combinado (tarjetas + bloques comparten ancho si se solapan en el tiempo). Sub-paso C (drag & drop completo) cerrado.

---

### 2026-06-24 — Reescritura arquitectónica: posicionamiento absoluto en vista semanal

**Problema raíz:** el sistema de franjas (una `cdkDropList` por hora) acumulaba bugs de altura, desalineación y elipsis que no tenían solución incremental limpia. Cada fix generaba un nuevo caso roto.

**Decisión:** reescritura completa de `semana.ts`, `semana.html` y `semana.scss` usando el patrón estándar de calendarios:

1. **CSS Grid de 3 filas** en `.grilla-dias` (`grid-template-rows: 40px auto 960px`): las 3 filas (cabeceras, sin-hora, grilla horaria) comparten columnas de CSS Grid → la fila `auto` iguala las alturas de sin-hora sin medición ni signals.

2. **Posición absoluta** para tarjetas y bloques fijos dentro de `.grilla-horaria` (`position: relative; height: 960px; overflow: hidden`). `topPx` y `heightPx` se calculan a partir de la duración en minutos × `PX_POR_HORA/60`. Sin min-height manual, sin segunda pasada de normalización.

3. **Algoritmo de clusters combinado** (`calcularPosiciones` en `semana.ts`): tarjetas y bloques fijos del mismo día se unifican en un array, se ordenan por `hora_inicio`, se agrupan en clusters por solapamiento. Dentro de cada cluster de N items, cada uno recibe `leftPct = i/N*100` y `widthPct = 1/N*100`. Los resultados se separan de nuevo en `TarjetaConPosicion[]` y `BloqueConPosicion[]`.

4. **Drop en grilla** (`alSoltarEnGrilla`): reemplaza `alSoltarEnFranja`. La hora destino se calcula desde `event.dropPoint.y - rect.top` (coordenada relativa a la grilla). Preserva la duración original de la tarjeta.

5. **Click para crear** (`abrirFormularioPorClick`): el `<div class="grilla-horaria">` es clickeable; la hora se calcula igual que en el drop. `$event.stopPropagation()` en tarjetas/bloques impide que el click se propague a la grilla.

**Lo que se elimina:** `afterRender`, `ViewChildren`, `QueryList`, `ElementRef` (de rendering), `alturaEspacioSinHoraPx`, `alturaSinHoraGlobal`, `Franja` interface, `FranjaDropData` interface, `itemAlturaPx`, `alturaTarjetaPx`, `alturaBloquePx`, `alSoltarEnFranja`, `.franjas`, `.franja`, `.franja-vacia`, `.col-dia` wrapper, `.col-horas` wrapper (reemplazado por 3 celdas sticky individuales), segunda pasada de normalización.

**Lo que se conserva sin cambios:** lógica de `alSoltarSinHora` (solo cambia la detección de "viene de grilla": `Array.isArray(previousContainer.data)` = false cuando es DiaSemana string), `cambiarEstado`, `alGuardar`, `irSemana`, `esHoy`, FAB, overlay, error banner, CDK drag animations.

### 2026-06-24 — Bug fix: elipsis agresivo + sección sin-hora desalineada entre columnas

**Elipsis single-line → line-clamp (semana.scss):** el fix anterior usaba `white-space: nowrap` que colapsaba el título a una sola línea aunque la tarjeta tuviera espacio vertical. Reemplazado por `-webkit-line-clamp: 3; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden` — permite hasta 3 líneas con wrap por palabra, elipsis solo si excede las 3 líneas.

**Sección sin-hora desalineada (semana.ts + semana.html):** la sección "sin hora" de cada columna crecía con su contenido de forma independiente. Si una columna tenía más tarjetas sin hora que otra, la grilla de horas debajo empezaba en posiciones Y distintas → escalón.

Fix: `afterRender` + `@ViewChildren('sinHoraRef')` mide el `scrollHeight - 6` de cada `.sin-hora` en tiempo de ejecución después de cada render, toma el máximo entre las 7 columnas y lo asigna como `min-height` compartido mediante el signal `_sinHoraGlobal`. Converge en 2 ciclos de render con el guard `if (max !== signal)`. La columna de etiquetas de hora (`.sin-hora-espacio`) recibe el mismo valor `+7` (`height`, no `min-height`) para compensar la diferencia de overhead CSS entre los dos elementos.

**Valor frágil — `+7` en `alturaEspacioSinHoraPx`:** constante derivada de:
- `.sin-hora` overhead = padding-top(3) + padding-bottom(3) + border-bottom(2) = **8px**
- `.sin-hora-espacio` overhead = 0px padding + border-bottom(1) = **1px**
- Diferencia = **7**

Si cambias el `padding` o `border-bottom` de `.sin-hora` o `.sin-hora-espacio` en `semana.scss`, recalcula este valor en `semana.ts → alturaEspacioSinHoraPx`. Está documentado con comentario en el código.

### 2026-06-24 — Bug fix: texto roto letra por letra + franjas desalineadas entre columnas

**Texto roto (semana.scss):** `.tarjeta--con-hora` con `flex:1; min-width:0` permitía que la tarjeta se encogiese hasta ~10px de ancho cuando había varias side-by-side, haciendo que `word-break: break-word` en `.tarjeta-titulo` rompiera carácter por carácter. Fix: dentro de `.tarjeta--con-hora`, sobreescribir `.tarjeta-titulo` con `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. El comportamiento base de `.tarjeta-titulo` (wrap por palabra) se conserva para `.tarjeta--sin-hora`.

**Franjas desalineadas (semana.ts):** `alturaPx` se calculaba por columna de forma aislada dentro del `DIAS.map`. Si el miércoles tenía una tarjeta de 1.5h a las 08:00, su franja-8 quedaba en 96px pero las demás columnas en 64px → escalón visual. Fix: segunda pasada después del `DIAS.map` que normaliza `alturaPx` por hora tomando el MAX de las 7 columnas. La lógica por columna se conserva intacta; solo se agrega el loop de normalización.

**Decisión registrada:** `columnas` pasa de `return DIAS.map(...)` a capturar en `cols`, aplicar normalización, y retornar `cols`. El objeto `Franja` y su campo `alturaPx` no cambian de tipo; solo el valor final es global en vez de local.

### 2026-06-24 — Bug fix: altura visual incorrecta para tarjetas de duración > 1 hora

**Síntoma:** Una tarjeta con `hora_inicio: 08:00` / `hora_fin: 09:30` se guardaba correctamente en Supabase pero se veía aplastada a 64px en la grilla, sin extenderse visualmente las 1.5 horas que debería ocupar.

**Causa raíz:** En `columnas` computed, la altura de cada franja se calculaba como `items × PX_POR_HORA` (cantidad de tarjetas × 64px). Esto solo manejaba el caso de N tarjetas apiladas de 1 hora cada una, sin considerar la duración individual.

**Fix (3 archivos):**
- `semana.ts`: nueva función de módulo `itemAlturaPx(horaInicio, horaFin)` que calcula duración real en px (mínimo 32px). En `columnas`, `alturaPx` de cada franja pasa a ser `MAX(PX_POR_HORA, ...alturas individuales)`. Dos métodos públicos nuevos `alturaTarjetaPx(t)` y `alturaBloquePx(b)` para el template.
- `semana.html`: `[style.min-height.px]` en `.tarjeta--con-hora` y `.bloque-fijo`.
- `semana.scss`: `.franja` cambia de `flex-direction: column` a `flex-direction: row; align-items: flex-start`. `.tarjeta--con-hora` y `.bloque-fijo` pasan a `flex: 1; width: auto; min-width: 0`.

**Decisión registrada — MAX no SUM para franjas con múltiples items:** Cuando N tarjetas caen en la misma franja, la altura de la franja es el MÁXIMO de las alturas individuales (no la suma), porque las tarjetas están solapadas en el tiempo (no secuenciales). Con `flex-direction: row`, las tarjetas aparecen lado a lado; la más corta queda con espacio vacío debajo dentro de la misma franja. Cambia el comportamiento del sub-paso A (que usaba `N × 64px` y columna), pero es el correcto para representar duración real.

### 2026-06-23 — Paso 7: cambio de estado de tarjeta (CONSTRUIDO)
- `cambiarEstado(tarjeta)` en `semana.ts`: cicla `no_empezado → en_proceso → completado → no_empezado`. Optimistic update en la señal; si falla, revierte al estado anterior y muestra error. Sin cambios al servicio.
- `(click)="cambiarEstado(t); $event.stopPropagation()"` en `.chip-estado` de tarjetas sin-hora y con-hora. `$event.stopPropagation()` para no interferir con el drag.
- `cursor: pointer` en `.chip-estado` en el SCSS.
- **Decisión registrada — solo el chip es clickeable:** clic en el resto de la tarjeta no hace nada (aún), para no chocar con el drag & drop. Edición/eliminación van en Fase 2.

### 2026-06-23 — Paso 8: Vista de hoy (CONSTRUIDO)
- `getRegistrosDelDia(fecha)` añadido en `HabitosService`: query única sobre `registros_habito` filtrada por fecha; devuelve todos los registros del día para todos los hábitos.
- `hoy/hoy.ts` (nuevo): carga tarjetas de la semana actual filtradas al `dia_semana` de hoy + hábitos + registros del día en paralelo (`Promise.all`). `sinHora` y `conHora` computados igual que en `semana.ts`. `habitosHoy` filtra por recurrencia (`diaria` siempre; `dias_especificos` solo si includes el día de hoy). `cambiarEstado` idéntico al de `semana.ts`. `toggleHabito` hace optimistic update y llama `marcarCumplido`.
- `hoy/hoy.html` (nuevo): header con fecha formateada. Sección "Sin hora" (chips clicables). Sección "Programado" (ordenada por hora_inicio, con chip + hora). Separador. Sección "Hábitos" (dot-toggle: círculo vacío / relleno verde + tachado en cumplido).
- `hoy/hoy.scss` (nuevo): mismas variables de color de estado que semana.scss (redeclaradas, sin compartir archivo). Mobile-first, lista simple sin grilla ni drag.
- `app.routes.ts`: ruta `/hoy` con `authGuard` (lazy load).
- `app.html`: tercera pestaña "Hoy" en posición central (Semana | Hoy | Hábitos). Ícono: círculo exterior + punto interior (estilo "hoy").
- **Decisión registrada — sin drag en hoy:** la vista de hoy es de revisión rápida, no de reorganización. El drag queda solo en la vista semanal.
- **Decisión registrada — hábitos sin hora:** los hábitos del día no tienen hora_inicio/hora_fin por diseño (ver database-schema.md), así que no se mezclan con las tarjetas programadas.

### ⚠️ NOTA — 2026-06-23
Pasos 7 y 8 construidos sobre el sub-paso C **SIN haber sido probado en navegador por Diego todavía**. Riesgo aceptado conscientemente por Diego. Si al revisar C aparece un bug, revisar también el impacto en 7/8.

---

### 2026-06-23 — Sub-paso C: drag & drop completo entre horas y días

- `cdkDropListGroup` en `.grilla-dias`: auto-conecta los 112 cdkDropLists (7 sin-hora + 105 franjas) sin listar IDs a mano.
- Cada `.franja` es ahora `cdkDropList` con `[cdkDropListData]="{ dia, hora }"` y `[cdkDropListSortingDisabled]="true"` (evita animación de reorden dentro de la franja, que no aplica).
- Tarjetas con hora: añadido `cdkDrag [cdkDragData]="t"`. Tarjetas sin hora: añadido `[cdkDragData]="t"` (ya tenían `cdkDrag`).
- `alSoltarEnFranja(event, diaDestino, horaDestino)`: calcula `hora_inicio = HH:00`, preserva duración original (`hora_fin - hora_inicio`), default 60 min si venía de sin-hora. Actualiza `dia_semana`, limpia `orden_sin_hora`. Optimistic update + persist en Supabase; en error recarga.
- `alSoltarSinHora` extendido: detecta cross-container con `event.previousContainer !== event.container`. Si la fuente es otro sin-hora (`Array.isArray(event.previousContainer.data)`), renumera también la lista origen. Si es desde una franja, solo renumera la lista destino. Persist en Supabase: `updateTarjeta` para mover + `reordenarSinHora` para renumeraciones.
- SCSS: `cursor: grab` en `.tarjeta--con-hora` con preview/placeholder CDK. Highlight `.franja.cdk-drop-list-receiving` y `.sin-hora.cdk-drop-list-receiving` para feedback visual al arrastrar.
- **Decisión registrada — sin renumeración del origen al mover a franja:** cuando una tarjeta sin-hora pasa a una franja, las restantes del sin-hora origen conservan sus `orden_sin_hora` con posible hueco (ej. [0, 2]). El sort sigue siendo correcto, y el drag de reorden arregla los números cuando el usuario lo use. No se agrega complejidad de renumeración para este caso.

### 2026-06-23 — Sub-paso B cerrado: creación de tarjetas desde formulario + bug RLS

- Confirmado por Diego: el formulario (botón + y clic en franja) crea tarjetas sin error de RLS.
- Ver entrada anterior para el detalle del fix.

### 2026-06-23 — Bug fix: RLS violada al crear tarjetas
- `createTarjeta` en `tarjetas.service.ts` no incluía `usuario_id` en el payload del insert. La política RLS (`with check (auth.uid() = usuario_id)`) rechazaba la fila porque el campo llegaba vacío — Supabase no lo infiere automáticamente.
- Fix: se llama `supabase.auth.getUser()` antes del insert y se inyecta `usuario_id: user.id` en el objeto. Si no hay sesión activa, se lanza error explícito antes de intentar el insert.
- `getTarjetas`, `updateTarjeta` y `deleteTarjeta` no tenían este problema: RLS en SELECT/UPDATE/DELETE actúa como filtro (`using`), no valida el payload.

### 2026-06-23 — Sub-paso A cerrado: vista semanal de solo lectura + reorden "sin hora"
- `core/services/tarjetas.service.ts`: agregado campo `orden_sin_hora: number | null` al interface `Tarjeta`; `getTarjetas` devuelve sin orden forzado (el ordenamiento lo hace el componente); nuevo método `reordenarSinHora()` hace batch update paralelo en Supabase
- `semana/semana.ts`: reescritura completa del stub; componente standalone con señales; computed `columnas` organiza cada día en lista `sinHora` (ordenada por `orden_sin_hora`) + array de `franjas` 7:00–22:00 (cada franja estira `alturaPx` cuando hay más de un item apilado); `alSoltarSinHora()` actualiza señal localmente y persiste en Supabase, revierte recargando si falla
- `semana/semana.html` (nuevo): grilla 7 columnas × franjas horarias; sección "sin hora" con `cdkDropList`; tarjetas apiladas verticalmente por franja; bloques fijos visualmente distintos (borde índigo, sin chip de estado)
- `semana/semana.scss` (nuevo): scroll horizontal mobile-first, 64px/hora, colores por estado (azul/ámbar/verde), drag CDK con animación
- **Decisión registrada — ordenamiento en componente:** `getTarjetas` no ordena en el query; el computed `columnas` separa tarjetas con/sin hora y las ordena localmente. Razón: Supabase no permite ordenar por dos columnas con lógica condicional en una sola llamada sin RPC; hacerlo en el componente es más claro y no hay costo de perf con los volúmenes de un solo usuario.
- **Decisión registrada — franjas que se estiran:** cuando hay N items (tarjetas + bloques) en la misma franja de hora, `alturaPx = N × 64px`. Todas las tarjetas de esa franja se muestran a ancho completo, apiladas verticalmente.
- **Verificado con datos reales en Supabase:** tarjetas con hora en distintos días (incluyendo apiladas en la misma franja), tarjetas sin hora con reordenamiento por drag & drop, bloque fijo en día distinto — todo posicionado correctamente.
- **Ajuste post-verificación:** color `no_empezado` cambiado de gris (#e2e8f0 / #94a3b8) a azul (#dbeafe / #3b82f6) para que el esquema sea azul/ámbar/verde consistente.

### 2026-06-22 — Servicios Supabase conectados (paso 3)
- `core/services/tarjetas.service.ts`: CRUD real contra tabla `tarjetas`; `getTarjetas` filtra por `semana_inicio`; `updateTarjeta(id, cambios)` acepta parcial, lo usan tanto el drag & drop (`dia_semana`, `hora_inicio`, `hora_fin`, `semana_inicio`) como el cambio de estado (`estado`)
- `core/services/bloques-fijos.service.ts` (nuevo): CRUD contra `bloques_fijos`, mismo patrón
- `habitos/habitos.service.ts`: CRUD contra `habitos` + `registros_habito`; `marcarCumplido(habitoId, fecha, cumplido=true)` hace upsert — acepta `true` o `false` para marcar/desmarcar el día; `getRegistros` devuelve historial ordenado por fecha desc para que el componente calcule la racha
- **Decisión registrada — soft delete en hábitos:** `deleteHabito` marca `activo=false` en vez de borrar la fila. Razón: `registros_habito.habito_id` tiene FK sin `ON DELETE CASCADE`; un hard delete rompería el historial. `getHabitos` filtra por `activo=true` así que desaparece de la UI igual.

### 2026-06-22 — Login verificado en browser (paso 2 cerrado)
- Validado: sin sesión redirige a /login; credenciales correctas navegan a /semana; campos de email/password reales visibles; tab bar oculto en /login, visible post-login
- `app.ts`: `toSignal(router.events)` + `computed` para `mostrarTabBar`; corrige bug donde tab bar se mostraba en /login

### 2026-06-22 — Supabase conectado + login + guard
- Instalado `@supabase/supabase-js` v2.108.2
- `core/services/supabase.service.ts`: cliente real con `createClient(environment.supabaseUrl, environment.supabaseAnonKey)`
- `auth/login/login.ts`: formulario email + password, `signInWithPassword()`, navega a `/semana` en éxito o muestra error; sin registro de usuario (se crea desde Supabase dashboard)
- `auth/auth.guard.ts`: `CanActivateFn` async que awaita `getSession()` antes de decidir; redirige a `/login` si no hay sesión
- `app.routes.ts`: `canActivate: [authGuard]` en `semana` y `habitos`
- **Cómo verificar:** `ng serve` → ir a `/semana` → redirige a `/login` → ingresar credenciales del usuario creado en Supabase → llega a la vista stub de Semana

### 2026-06-22 — Limpieza del diseño anterior con IA
- Borrados: `captura/` (4 archivos), `disponibilidad/` (2 archivos), `core/models/captura.types.ts`, `core/services/audio.service.ts`, `core/services/interpretar.service.ts`, `docs/iniciar-limpieza.md`
- `calendario/` renombrado a `semana/`; el componente es `Semana` (stub "Próximamente")
- `calendario/tareas.service.ts` reemplazado por `core/services/tarjetas.service.ts` con tipos del nuevo schema (`Tarjeta`, `DiaSemana`, `EstadoTarjeta`) — métodos en stub, sin lógica Supabase todavía
- `habitos/habitos.service.ts` reescrito con tipos `Habito` y `RegistroHabito` del nuevo schema; añadido `marcarCumplido` y `getRegistros` para la racha
- `app.routes.ts`: eliminadas rutas `captura` y `disponibilidad`; `calendario` → `semana`; ruta `hoy` no agregada (es paso 8, se agrega cuando llegue)
- `app.html`: tab bar reducido a `Semana` y `Hábitos`; tab `hoy` se agrega en paso 8
- Desajuste D1 anotado (ver sección de desajustes pendientes)

### 2026-06-22 — Setup inicial del proyecto Angular
- Eliminado proyecto Spring Boot previo en el directorio (pom.xml, mvnw, src/, target/)
- Creado proyecto Angular (CLI 21.2.7, standalone, routing, sin SSR)
- Estructura de carpetas inicial y layout base con tab bar inferior, CSS mobile-first con safe-area-inset
- (Las carpetas de esta etapa fueron parcialmente invalidadas por el cambio de diseño — ver arriba)

### 2026-06-22 — Variables de entorno con método nativo de Angular
- `.env` manual borrado (no era leído por Angular)
- `environment.ts` (plantilla vacía, en git) + `environment.development.ts` (valores reales, gitignoreado)
- `angular.json` con `fileReplacements` para development
- Esta entrega sigue siendo válida sin cambios tras el rediseño

### 2026-06-22 — Pantalla de captura con IA (diseño descartado)
- Construida pantalla de texto + grabadora de audio (`MediaRecorder`), validada funcional en iPhone real
- Esta entrega queda invalidada por el cambio de diseño — ver sección de arriba

---

## Cómo usar este archivo (Claude Code)

Después de cada bloque de trabajo (no después de cada línea de código, sino al cerrar una tarea o feature), agrega una entrada nueva con:
1. Fecha y qué se hizo (lista corta)
2. Cualquier decisión de nombres, estructura, o comportamiento que no estaba explícita en `CLAUDE.md`/`docs/` y que tuviste que tomar por tu cuenta
3. Si esa decisión contradice algo de los docs, o si los docs simplemente no lo cubrían, anótalo en "Desajustes pendientes" arriba y avísale a Diego en tu respuesta — no edites los docs para "corregirlo" tú mismo
