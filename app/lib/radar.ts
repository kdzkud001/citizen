/** Geometry for the wellness wheel radar chart. Spoke 0 points straight
 * up and the rest go clockwise at equal angles. `value` is 0-100. */

export interface Point {
  x: number;
  y: number;
}

export function radarPoint(index: number, count: number, value: number, radius: number, center: number): Point {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  const r = (radius * Math.min(100, Math.max(0, value))) / 100;
  return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
}

/** SVG `points` attribute string for a polygon through each spoke's value. */
export function radarPolygon(values: number[], radius: number, center: number): string {
  return values
    .map((v, i) => radarPoint(i, values.length, v, radius, center))
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}
