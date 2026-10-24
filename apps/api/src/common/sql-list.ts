// Builds the value list of a portable CHECK expression from an enum, e.g.
// `sensor_color IN (${sqlList(SensorColor)})` → `sensor_color IN ('mono', 'color')`.
// Single quotes are doubled because that is the one string escape every SQL
// database shares.
export function sqlList(enum_object: Record<string, string>): string {
  return Object.values(enum_object)
    .map((value) => `'${value.replaceAll("'", "''")}'`)
    .join(', ');
}
