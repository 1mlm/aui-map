import {
  type CampusShapes,
  type Point,
  rectToPolygon,
  roundedPolygon,
} from "./campusShapes";

// a building or sports area, boiled down to what the map needs to paint it in a pin's colour and
// write the pin's name along it: its outline, its middle, which way it points and how big it is.
// Worked out on the server so the phone only gets a few numbers per place
export type Area = {
  d: string;
  // outline corners, to tell which pins stand inside
  pts: Point[];
  c: Point;
  // degrees, kept upright so text never reads upside down
  ang: number;
  len: number;
  thick: number;
};

const round = (n: number) => Math.round(n * 10) / 10;

function toArea(pts: Point[], radius: number): Area | null {
  if (pts.length < 3) return null;
  // the longest side says which way the place points
  let best = 0;
  let ang = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) {
      best = l;
      ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, y] of pts) {
    const u = x * ux + y * uy;
    const v = -x * uy + y * ux;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const mu = (minU + maxU) / 2;
  const mv = (minV + maxV) / 2;
  let deg = (ang * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg <= -90) deg += 180;
  return {
    d: radius
      ? roundedPolygon(pts, radius)
      : `M${pts.map((q) => q.join(" ")).join("L")}Z`,
    pts: pts.map(([x, y]) => [round(x), round(y)] as Point),
    c: [round(mu * ux - mv * uy), round(mu * uy + mv * ux)],
    ang: round(deg),
    len: round(maxU - minU),
    thick: round(maxV - minV),
  };
}

export function buildAreas(shapes: CampusShapes): Area[] {
  const out: Area[] = [];
  for (const b of shapes.buildings) {
    const area = toArea(b.r ? rectToPolygon(b.r) : (b.p ?? []), 2.4);
    if (area) out.push(area);
  }
  for (const z of shapes.zones) {
    if (z.kind === "walk") continue;
    const area = toArea(z.p, 0);
    if (area) out.push(area);
  }
  return out;
}
