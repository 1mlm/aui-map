// builds public/campus-map.svg from src/map/campusShapes.json, the hand drawn campus (buildings as
// rotated rectangles, roads and paths as lines, zones as polygons) in the 1312px space of the
// satellite image. Run: node scripts/build-campus-svg.mjs
import { readFileSync, writeFileSync } from "node:fs"

const shapes = JSON.parse(readFileSync("src/map/campusShapes.json", "utf8"))
const n = (value) => Math.round(value * 10) / 10

// a smooth line through the hand placed points (Catmull-Rom turned into cubic beziers)
function smooth(points) {
  if (points.length < 3) return `M${points.map((p) => p.join(" ")).join("L")}`
  let d = `M${n(points[0][0])} ${n(points[0][1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`
  }
  return d
}

const polygon = (points) => `M${points.map((p) => `${n(p[0])} ${n(p[1])}`).join("L")}Z`
const rect = ([cx, cy, w, h, a]) =>
  `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="1.2" transform="translate(${n(cx)} ${n(cy)}) rotate(${n(a)})"/>`

// the colours live in css so the picture follows the phone's light or dark setting, even as an <img>
const style = `
:root{--ground:#d9e2c8;--field:#a9d18f;--court:#d98a68;--parking:#c9ccd0;--casing:#b8b3a4;--road:#fffdf6;--walk:#f6eed9;--dirt:#d8bf92;--roof:#d9805f;--roofline:#9c4f38;--aud:#c9a45b;--food:#d8636a;--sport:#6fb36b}
@media (prefers-color-scheme:dark){:root{--ground:#1c271f;--field:#2f4a2b;--court:#8a4a36;--parking:#363a3f;--casing:#171c18;--road:#3b403b;--walk:#4a4a42;--dirt:#5b4d36;--roof:#a85a40;--roofline:#6e3626;--aud:#8c7237;--food:#9c444a;--sport:#3f7a3d}}
.zf{fill:var(--field)}.zc{fill:var(--court)}.zp{fill:var(--parking)}
.rc{fill:none;stroke:var(--casing);stroke-linecap:round;stroke-linejoin:round}
.rr{fill:none;stroke:var(--road);stroke-linecap:round;stroke-linejoin:round}
.pw{fill:none;stroke:var(--walk);stroke-linecap:round;stroke-linejoin:round}
.pd{fill:none;stroke:var(--dirt);stroke-linecap:round;stroke-linejoin:round}
.b{fill:var(--roof);stroke:var(--roofline);stroke-width:.8}
.b-auditorium{fill:var(--aud)}.b-food{fill:var(--food)}.b-sports{fill:var(--sport)}
`.replace(/\n/g, "")

const zoneClass = { field: "zf", court: "zc", parking: "zp" }
let body = `<rect width="${shapes.size}" height="${shapes.size}" fill="var(--ground)"/>`
for (const zone of shapes.zones)
  body += `<path class="${zoneClass[zone.kind] ?? "zf"}" d="${polygon(zone.p)}"/>`
for (const path of shapes.paths) {
  const d = smooth(path.p)
  body += `<path class="${path.kind === "dirt" ? "pd" : "pw"}" stroke-width="${path.w}" d="${d}"/>`
}
for (const road of shapes.roads) {
  const d = smooth(road.p)
  body += `<path class="rc" stroke-width="${road.w + 2.4}" d="${d}"/><path class="rr" stroke-width="${road.w}" d="${d}"/>`
}
for (const building of shapes.buildings) {
  const cls = building.tag ? `b b-${building.tag}` : "b"
  body += `<g class="${cls}">${building.r.map(rect).join("")}</g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shapes.size} ${shapes.size}" width="${shapes.size}" height="${shapes.size}"><style>${style}</style>${body}</svg>\n`
writeFileSync("public/campus-map.svg", svg)
console.log(`public/campus-map.svg: ${Math.round(svg.length / 1024)} KB`)
