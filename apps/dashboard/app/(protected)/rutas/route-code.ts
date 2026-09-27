// R-<YYYYMMDD>-<secuencia del día> — generado en el cliente a partir de las
// rutas ya cargadas para esa fecha, no en el backend (no hay una tabla de
// secuencias ni una constraint UNIQUE sobre `code` todavía). Evita que se
// escriba código a mano; el caso borde de dos admins creando al mismo
// segundo una ruta para el mismo día es un riesgo aceptado para el MVP de un
// solo administrador activo a la vez — si eso cambia, esto necesita moverse
// al backend.
//
// Vive en su propio archivo (no en page.tsx) porque "Crear ruta" y "Duplicar
// ruta" lo comparten y una page de Next solo puede exportar la página.
export function generateRouteCode(date: string, existingForDate: number): string {
  if (!date) return "";
  const compact = date.replaceAll("-", "");
  return `R-${compact}-${String(existingForDate + 1).padStart(2, "0")}`;
}
