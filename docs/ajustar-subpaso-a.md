Ajuste al sub-paso A antes de construir: agregué la columna orden_sin_hora (integer) a la tabla tarjetas en Supabase, y actualicé docs/database-schema.md — te paso el contenido actualizado en el siguiente mensaje, reemplázalo.

Cambio de alcance: las tarjetas SIN hora_inicio van a poder reordenarse manualmente (arrastrar para definir si una va antes o después de otra), usando ese campo orden_sin_hora. Esto es la única excepción a "sub-paso A es solo lectura" — el resto de la vista (tarjetas con hora, bloques fijos) sigue siendo de solo lectura en este sub-paso, sin drag & drop todavía.

Ajusta tu plan:
1. getTarjetas debe traer también orden_sin_hora, y las tarjetas sin hora_inicio deben venir ordenadas por ese campo (ascendente) al consultarlas.
2. La sección "sin hora" de cada columna de día (opción A de las que vimos: una franja separada arriba de la grilla horaria, dentro de cada columna) permite drag & drop SOLO entre las tarjetas de esa misma sección — no se pueden arrastrar hacia la grilla de horas ni entre columnas de días distintos en este sub-paso.
3. Al reordenar, actualiza updateTarjeta con el nuevo orden_sin_hora de las tarjetas afectadas (probablemente más de una si se inserta en medio de la lista).
4. El resto del plan (grilla 7:00-22:00 fija, colores por estado, bloques fijos sin chip de estado) se mantiene igual.

Dame el plan corto actualizado antes de tocar código.
