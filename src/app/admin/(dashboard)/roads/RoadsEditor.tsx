// biome-ignore-all lint/suspicious/noArrayIndexKey: lines have no ids, their position is their identity
"use client";

import {
  Cancel01Icon,
  CircleIcon,
  Cursor02Icon,
  Delete02Icon,
  FloppyDiskIcon,
  Image01Icon,
  Pentagon01Icon,
  Redo02Icon,
  Road01Icon,
  Route01Icon,
  Scissor01Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { type HugeIcon, Icon } from "@/components/Icon";
import { Button } from "@/shadcn/ui/button";
import { Separator } from "@/shadcn/ui/separator";
import { Toggle } from "@/shadcn/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/shadcn/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip";
import {
  type CampusShapes,
  type Point,
  rectToPolygon,
  ROAD_WALK_BAND,
  smoothPath,
} from "@/map/campusShapes";
import { saveCampusLines } from "../map/actions";

const SIZE = 1312;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

type Layer = "roads" | "paths" | "zones" | "roundabouts";
type Tool = "select" | "area" | "road" | "ring" | "path";
type AreaKind = "walk" | "field" | "court" | "parking";
type PathKind = "walk" | "dirt" | "green";
type Sel = { layer: Layer; i: number; v?: number };
type View = { x: number; y: number; s: number };
type Drag =
  | { kind: "pan"; start: [number, number]; view: View; moved: boolean }
  | { kind: "vertex"; sel: Sel & { v: number } }
  | { kind: "move"; start: Point; orig: CampusShapes; sel: Sel }
  | { kind: "radius"; i: number };

const AREA_KINDS: { id: AreaKind; label: string; color: string }[] = [
  { id: "walk", label: "Walkway", color: "#f6eed9" },
  { id: "field", label: "Field", color: "#a9d18f" },
  { id: "court", label: "Court", color: "#d98a68" },
  { id: "parking", label: "Parking", color: "#c9ccd0" },
];
const PATH_KINDS: { id: PathKind; label: string; color: string }[] = [
  { id: "walk", label: "Paved", color: "#f6eed9" },
  { id: "dirt", label: "Dirt", color: "#d8bf92" },
  { id: "green", label: "Green", color: "#a6cf8d" },
];
// only three widths each, nobody needs a number
const WIDTHS = {
  road: [5, 7, 10],
  path: [2.5, 3.5, 5],
  ring: [5, 7, 10],
} as const;
const WIDTH_LABELS = ["S", "M", "L"] as const;
const PATH_COLOR = { walk: "#f6eed9", dirt: "#d8bf92", green: "#a6cf8d" };
const ZONE_FILL = {
  walk: "#f6eed9",
  field: "#a9d18f",
  court: "#d98a68",
  parking: "#c9ccd0",
};
const TOOLS: {
  id: Tool;
  label: string;
  key: string;
  icon: HugeIcon;
  hint: string;
}[] = [
  {
    id: "select",
    label: "Select",
    key: "V",
    icon: Cursor02Icon,
    hint: "Click anything to edit it, right click to draw again",
  },
  {
    id: "area",
    label: "Area",
    key: "A",
    icon: Pentagon01Icon,
    hint: "Click the corners, right click to finish",
  },
  {
    id: "road",
    label: "Road",
    key: "R",
    icon: Road01Icon,
    hint: "Click along the road, right click to finish",
  },
  {
    id: "ring",
    label: "Roundabout",
    key: "O",
    icon: CircleIcon,
    hint: "Click the middle, then the edge",
  },
  {
    id: "path",
    label: "Path",
    key: "P",
    icon: Route01Icon,
    hint: "Click along the path, right click to finish",
  },
];

function nearestOnCircle(p: Point, c: Point, r: number): Point {
  const d = dist(p, c) || 1;
  return [c[0] + ((p[0] - c[0]) / d) * r, c[1] + ((p[1] - c[1]) / d) * r];
}

const Hint = ({ label, keys }: { label: string; keys?: string }) => (
  <>
    {label}
    {keys && (
      <kbd className="ml-1.5 rounded bg-background/20 px-1 font-mono text-[0.7rem]">
        {keys}
      </kbd>
    )}
  </>
);

function IconAction({
  icon,
  label,
  keys,
  onClick,
  disabled,
}: {
  icon: HugeIcon;
  label: string;
  keys?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="bg-background/90 backdrop-blur"
        >
          <Icon icon={icon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <Hint {...{ label, keys }} />
      </TooltipContent>
    </Tooltip>
  );
}

// the choices for whatever is being drawn or is selected, one group each: what kind it is, how wide
function Options({
  kinds,
  kind,
  onKind,
  widths,
  width,
  onWidth,
}: {
  kinds?: { id: string; label: string; color: string }[];
  kind?: string;
  onKind: (id: string) => void;
  widths?: readonly number[];
  width?: number;
  onWidth: (index: number) => void;
}) {
  return (
    <>
      {kinds && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={kind}
          onValueChange={(value) => value && onKind(value)}
        >
          {kinds.map((k) => (
            <ToggleGroupItem key={k.id} value={k.id}>
              <span
                className="size-3 rounded-[0.25rem] ring-1 ring-black/20"
                style={{ background: k.color }}
              />
              {k.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {widths && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={String(widths.indexOf(width ?? Number.NaN))}
          onValueChange={(value) => value && onWidth(Number(value))}
        >
          {widths.map((w, i) => (
            <Tooltip key={w}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={String(i)}
                  aria-label={`Width ${WIDTH_LABELS[i]}`}
                >
                  {WIDTH_LABELS[i]}
                  <span className="ml-0.5 text-[0.65rem] text-muted-foreground">
                    {i + 1}
                  </span>
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                Width {WIDTH_LABELS[i]} (key {i + 1})
              </TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      )}
    </>
  );
}

export function RoadsEditor({ initial }: { initial: CampusShapes }) {
  const [shapes, setShapes] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(lines(initial)));
  const [tool, setTool] = useState<Tool>("select");
  // the drawing tool used last, so a right click on empty space brings it back
  const [lastDraw, setLastDraw] = useState<Tool>("road");
  const [areaKind, setAreaKind] = useState<AreaKind>("walk");
  const [pathKind, setPathKind] = useState<PathKind>("walk");
  // which of the three widths the next road, path or roundabout gets
  const [widthIdx, setWidthIdx] = useState(1);
  const [draft, setDraft] = useState<Point[]>([]);
  const [ringCenter, setRingCenter] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [view, setView] = useState<View>({ x: 180, y: 120, s: 940 });
  const [history, setHistory] = useState<CampusShapes[]>([]);
  const [future, setFuture] = useState<CampusShapes[]>([]);
  const [dimSatellite, setDimSatellite] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [pxWidth, setPxWidth] = useState(800);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const dirty = JSON.stringify(lines(shapes)) !== saved;
  const px = view.s / pxWidth;
  const handleR = px * 6;
  const drawing = tool !== "select";
  const satOpacity = dimSatellite ? 0.4 : 0.9;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setPxWidth(el.clientWidth || 800),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const at = toSvg(event);
      const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
      setView((v) => {
        const s = Math.min(SIZE * 1.2, Math.max(60, v.s * factor));
        const k = s / v.s;
        return {
          s,
          x: at[0] - (at[0] - v.x) * k,
          y: at[1] - (at[1] - v.y) * k,
        };
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // keys for everything, so the pointer can stay on the drawing: V A R O P pick a tool, 1 2 3 the
  // width, Tab the next kind, Enter finishes, Esc cancels
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (/INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement).tagName))
        return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.ctrlKey || event.metaKey || event.altKey) return;
      else if (event.key === "Escape") {
        if (drawing) cancelDraw();
        else setSel(null);
      } else if (event.key === "Enter" && drawing) finishDraw();
      else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (drawing && draft.length) setDraft((d) => d.slice(0, -1));
        else removeSelected();
      } else if (event.key === "Tab" && barKinds) {
        event.preventDefault();
        const ids: string[] = barKinds.map((k) => k.id);
        applyKind(ids[(ids.indexOf(barKind ?? "") + 1) % ids.length]);
      } else if (key === "s" && canSplit) splitSelected();
      else if (["1", "2", "3"].includes(event.key) && barWidths)
        applyWidth(Number(event.key) - 1);
      else {
        const tool = TOOLS.find((t) => t.key.toLowerCase() === key);
        if (tool) pickTool(tool.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function toSvg(event: { clientX: number; clientY: number }): Point {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return [0, 0];
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const p = point.matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }

  function remember() {
    setHistory((h) => [...h.slice(-59), clone(shapes)]);
    setFuture([]);
  }
  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setFuture((f) => [...f, clone(shapes)]);
    setHistory((h) => h.slice(0, -1));
    setShapes(last);
    setSel(null);
  }
  function redo() {
    const next = future[future.length - 1];
    if (!next) return;
    setHistory((h) => [...h, clone(shapes)]);
    setFuture((f) => f.slice(0, -1));
    setShapes(next);
    setSel(null);
  }
  function change(fn: (draft: CampusShapes) => void) {
    remember();
    setShapes((current) => {
      const next = clone(current);
      fn(next);
      return next;
    });
  }

  // a new point sticks to a nearby corner, road point, or the edge of a roundabout, so everything
  // that meets really meets. Alt skips it
  function snapPoint(raw: Point, free: boolean): Point {
    if (free) return raw;
    let best: Point | null = null;
    let bestD = px * 9;
    const all = [
      ...shapes.roads.flatMap((r) => r.p),
      ...shapes.paths.flatMap((r) => r.p),
      ...shapes.zones.flatMap((z) => z.p),
      ...shapes.buildings.flatMap((b) =>
        b.r ? rectToPolygon(b.r) : (b.p ?? []),
      ),
      ...draft,
    ];
    for (const q of all) {
      const d = dist(q, raw);
      if (d < bestD) {
        best = q;
        bestD = d;
      }
    }
    for (const ring of shapes.roundabouts) {
      const q = nearestOnCircle(raw, ring.c, ring.r);
      const d = dist(q, raw);
      if (d < bestD) {
        best = q;
        bestD = d;
      }
    }
    return best ? ([...best] as Point) : raw;
  }

  function pickTool(next: Tool) {
    setDraft([]);
    setRingCenter(null);
    // going back to Select keeps what was just drawn selected, so it can be adjusted at once
    if (next !== "select") {
      setSel(null);
      setLastDraw(next);
    }
    setTool(next);
  }
  function cancelDraw() {
    setDraft([]);
    setRingCenter(null);
    setTool("select");
  }
  function finishDraw() {
    const pts = draft.filter(
      (q, k) => k === 0 || dist(q, draft[k - 1]) > px * 2,
    );
    const need = tool === "area" ? 3 : 2;
    if (pts.length < need) {
      setDraft([]);
      return;
    }
    if (tool === "road") {
      change((d) => d.roads.push({ w: WIDTHS.road[widthIdx], p: pts }));
      setSel({ layer: "roads", i: shapes.roads.length });
    } else if (tool === "path") {
      change((d) =>
        d.paths.push({ w: WIDTHS.path[widthIdx], kind: pathKind, p: pts }),
      );
      setSel({ layer: "paths", i: shapes.paths.length });
    } else if (tool === "area") {
      change((d) => d.zones.push({ kind: areaKind, p: pts }));
      setSel({ layer: "zones", i: shapes.zones.length });
    }
    setDraft([]);
  }

  // right click anywhere does the next sensible thing: finish the line being drawn, then leave
  // drawing, then go back to the last drawing tool
  function rightClick() {
    if (drawing && (draft.length || ringCenter)) {
      if (tool === "ring") setRingCenter(null);
      else finishDraw();
    } else if (drawing) setTool("select");
    else pickTool(lastDraw);
  }

  function removeSelected() {
    if (!sel) return;
    if (sel.layer === "roundabouts") {
      change((d) => d.roundabouts.splice(sel.i, 1));
      setSel(null);
      return;
    }
    const entry = shapes[sel.layer][sel.i] as { p: Point[] } | undefined;
    if (!entry) return;
    const min = sel.layer === "zones" ? 3 : 2;
    if (sel.v !== undefined && entry.p.length > min) {
      change((d) =>
        (d[sel.layer][sel.i] as { p: Point[] }).p.splice(sel.v as number, 1),
      );
      setSel({ layer: sel.layer, i: sel.i });
      return;
    }
    change((d) => d[sel.layer].splice(sel.i, 1));
    setSel(null);
  }

  // cuts a road or path in two at the selected point: both halves keep the point, their kind and
  // their width, and can be moved, restyled or deleted on their own
  const canSplit = Boolean(
    sel &&
      (sel.layer === "roads" || sel.layer === "paths") &&
      sel.v !== undefined &&
      sel.v > 0 &&
      sel.v <
        ((shapes[sel.layer][sel.i] as { p: Point[] } | undefined)?.p.length ??
          0) -
          1,
  );
  function splitSelected() {
    if (!sel || !canSplit || sel.v === undefined) return;
    const { layer, i, v } = sel;
    change((d) => {
      const list = d[layer as "roads"] as { p: Point[] }[];
      const whole = list[i];
      const second = { ...clone(whole), p: whole.p.slice(v) };
      whole.p = whole.p.slice(0, v + 1);
      list.splice(i + 1, 0, second);
    });
    setSel({ layer, i });
  }

  // the kind and width of the selected shape, or what the next one gets when nothing is selected
  const selected = sel
    ? (shapes[sel.layer][sel.i] as unknown as
        | {
            p?: Point[];
            w?: number;
            r?: number;
            kind?: string;
          }
        | undefined)
    : undefined;
  const barTool: Tool | null = sel
    ? sel.layer === "zones"
      ? "area"
      : sel.layer === "roads"
        ? "road"
        : sel.layer === "paths"
          ? "path"
          : "ring"
    : drawing
      ? tool
      : null;
  const barKinds =
    barTool === "area"
      ? AREA_KINDS
      : barTool === "path"
        ? PATH_KINDS
        : undefined;
  const barKind =
    barTool === "area"
      ? sel?.layer === "zones"
        ? selected?.kind
        : areaKind
      : barTool === "path"
        ? sel?.layer === "paths"
          ? selected?.kind
          : pathKind
        : undefined;
  const barWidths =
    barTool === "road"
      ? WIDTHS.road
      : barTool === "path"
        ? WIDTHS.path
        : barTool === "ring"
          ? WIDTHS.ring
          : undefined;
  const barWidth = sel
    ? selected?.w
    : barWidths
      ? barWidths[widthIdx]
      : undefined;

  function applyKind(kind: string) {
    if (sel && (sel.layer === "zones" || sel.layer === "paths")) {
      const { layer, i } = sel;
      change((d) => {
        (d[layer][i] as { kind: string }).kind = kind;
      });
    }
    if (barTool === "area") setAreaKind(kind as AreaKind);
    if (barTool === "path") setPathKind(kind as PathKind);
  }
  function applyWidth(index: number) {
    if (!barWidths) return;
    setWidthIdx(index);
    if (sel && sel.layer !== "zones") {
      const { layer, i } = sel;
      change((d) => {
        (d[layer][i] as unknown as { w: number }).w = barWidths[index];
      });
    }
  }

  function startMove(event: React.PointerEvent, layer: Layer, i: number) {
    if (tool !== "select") return;
    event.stopPropagation();
    (svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId);
    remember();
    setSel({ layer, i });
    drag.current = {
      kind: "move",
      start: toSvg(event),
      orig: clone(shapes),
      sel: { layer, i },
    };
  }
  function startVertex(
    event: React.PointerEvent,
    layer: Layer,
    i: number,
    v: number,
  ) {
    event.stopPropagation();
    (svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId);
    remember();
    setSel({ layer, i, v });
    drag.current = { kind: "vertex", sel: { layer, i, v } };
  }
  function startRadius(event: React.PointerEvent, i: number) {
    event.stopPropagation();
    (svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId);
    remember();
    drag.current = { kind: "radius", i };
  }
  function onBackgroundDown(event: React.PointerEvent) {
    (svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId);
    drag.current = {
      kind: "pan",
      start: [event.clientX, event.clientY],
      view,
      moved: false,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    const raw = toSvg(event);
    if (drawing)
      setCursor(
        tool === "ring" && ringCenter ? raw : snapPoint(raw, event.altKey),
      );
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      const dx = event.clientX - d.start[0];
      const dy = event.clientY - d.start[1];
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      const scale = d.view.s / pxWidth;
      setView({
        ...d.view,
        x: d.view.x - dx * scale,
        y: d.view.y - dy * scale,
      });
    } else if (d.kind === "move") {
      const dx = raw[0] - d.start[0];
      const dy = raw[1] - d.start[1];
      setShapes(() => {
        const next = clone(d.orig);
        if (d.sel.layer === "roundabouts") {
          const ring = next.roundabouts[d.sel.i];
          ring.c = [ring.c[0] + dx, ring.c[1] + dy];
        } else {
          const entry = next[d.sel.layer][d.sel.i] as { p: Point[] };
          entry.p = entry.p.map(([x, y]) => [x + dx, y + dy] as Point);
        }
        return next;
      });
    } else if (d.kind === "vertex") {
      const at = snapPoint(raw, event.altKey);
      const { layer, i, v } = d.sel;
      setShapes((current) => {
        const next = clone(current);
        (next[layer as "roads"][i] as { p: Point[] }).p[v] = at;
        return next;
      });
    } else if (d.kind === "radius") {
      setShapes((current) => {
        const next = clone(current);
        const ring = next.roundabouts[d.i];
        ring.r = Math.max(4, dist(raw, ring.c));
        return next;
      });
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "pan" && !d.moved) {
      if (tool === "select") setSel(null);
      else if (tool === "ring") {
        const at = toSvg(event);
        if (!ringCenter) setRingCenter(at);
        else {
          change((s) =>
            s.roundabouts.push({
              c: ringCenter,
              r: Math.max(5, dist(at, ringCenter)),
              w: WIDTHS.ring[widthIdx],
            }),
          );
          setRingCenter(null);
          setSel({ layer: "roundabouts", i: shapes.roundabouts.length });
        }
      } else {
        const at = snapPoint(toSvg(event), event.altKey);
        if (draft.length >= 2 && dist(at, draft[draft.length - 1]) < px * 4)
          finishDraw();
        else if (
          tool === "area" &&
          draft.length >= 3 &&
          dist(at, draft[0]) < px * 10
        )
          finishDraw();
        else {
          if (!draft.length) setSel(null);
          setDraft((current) => [...current, at]);
        }
      }
    }
  }

  function addMidpoint(layer: Layer, i: number, after: number) {
    const entry = shapes[layer as "roads"][i] as { p: Point[] };
    const a = entry.p[after];
    const b = entry.p[(after + 1) % entry.p.length];
    change((d) => {
      (d[layer as "roads"][i] as { p: Point[] }).p.splice(after + 1, 0, [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      ]);
    });
    setSel({ layer, i, v: after + 1 });
  }

  async function save() {
    setSaving(true);
    setStatus("");
    const result = await saveCampusLines(lines(shapes));
    setSaving(false);
    if ("error" in result) setStatus(result.error);
    else {
      setSaved(JSON.stringify(lines(shapes)));
      setStatus("Saved");
    }
  }

  const draftPoints =
    cursor && drawing && tool !== "ring" ? [...draft, cursor] : draft;

  // where the little toolbar for the selected shape goes: right above it, so the pointer barely
  // has to move. Worked out from where the shape is on screen
  const anchor = (() => {
    const svg = svgRef.current;
    const box = boxRef.current;
    const ctm = svg?.getScreenCTM();
    if (drawing || !sel || !selected || !svg || !box || !ctm) return null;
    let at: Point;
    if (sel.layer === "roundabouts" && selected.r !== undefined) {
      const ring = shapes.roundabouts[sel.i];
      at = [ring.c[0], ring.c[1] - ring.r - ring.w];
    } else if (selected.p) {
      // a selected point gets the toolbar beside it, otherwise it sits above the whole shape
      const top =
        sel.v !== undefined && selected.p[sel.v]
          ? selected.p[sel.v]
          : selected.p.reduce((a, b) => (b[1] < a[1] ? b : a));
      at = [top[0], top[1]];
    } else return null;
    const rect = box.getBoundingClientRect();
    const x = ctm.a * at[0] + ctm.c * at[1] + ctm.e - rect.left;
    const y = ctm.b * at[0] + ctm.d * at[1] + ctm.f - rect.top;
    return {
      x: Math.min(rect.width - 150, Math.max(150, x)),
      y: Math.min(rect.height - 60, Math.max(70, y - 14)),
    };
  })();

  const activeTool = TOOLS.find((t) => t.id === tool);
  const hint = drawing
    ? (activeTool?.hint ?? "")
    : sel
      ? "Drag it to move. Drag a square to move a point, a small circle adds one"
      : "Click anything to edit it. Drag empty space to move around, scroll to zoom";

  function renderEditable(layer: Layer, i: number) {
    const sel1 = sel?.layer === layer && sel.i === i;
    if (layer === "roundabouts") {
      const ring = shapes.roundabouts[i];
      return (
        <g key={`ring-${i}`}>
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="none"
            stroke="#f6eed9"
            strokeWidth={ring.w + ROAD_WALK_BAND * 2}
            opacity={0.9}
            pointerEvents="none"
          />
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="none"
            stroke="#b8b3a4"
            strokeWidth={ring.w + 2.4}
            pointerEvents="none"
          />
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="none"
            stroke="#fffdf6"
            strokeWidth={ring.w}
            pointerEvents="none"
          />
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={Math.max(0, ring.r - ring.w / 2 - 0.6)}
            fill="#b9d9a3"
            pointerEvents="none"
          />
          {sel1 && (
            <circle
              cx={ring.c[0]}
              cy={ring.c[1]}
              r={ring.r}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={px * 1.5}
              strokeDasharray={`${px * 4} ${px * 3}`}
              pointerEvents="none"
            />
          )}
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="transparent"
            stroke="transparent"
            strokeWidth={Math.max(px * 14, ring.w + 6)}
            onPointerDown={(e) => startMove(e, "roundabouts", i)}
            pointerEvents={tool === "select" ? undefined : "none"}
            style={{ cursor: "move" }}
          />
          {sel1 && tool === "select" && (
            <rect
              x={ring.c[0] + ring.r - handleR}
              y={ring.c[1] - handleR}
              width={handleR * 2}
              height={handleR * 2}
              rx={handleR * 0.5}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={px * 1.5}
              style={{ cursor: "ew-resize" }}
              onPointerDown={(e) => startRadius(e, i)}
            />
          )}
        </g>
      );
    }
    const entry = shapes[layer][i] as { p: Point[]; w?: number; kind?: string };
    const closed = layer === "zones";
    const d = closed
      ? `M${entry.p.map((q) => q.join(" ")).join("L")}Z`
      : smoothPath(entry.p);
    return (
      <g key={`${layer}-${i}`}>
        {layer === "zones" ? (
          <path
            d={d}
            fill={ZONE_FILL[(entry.kind as AreaKind) ?? "walk"]}
            fillOpacity={0.65}
            stroke={sel1 ? "#fff" : "rgba(0,0,0,0.35)"}
            strokeWidth={px * (sel1 ? 2 : 1)}
            pointerEvents="none"
          />
        ) : layer === "roads" ? (
          <>
            <path
              d={d}
              fill="none"
              stroke="#f6eed9"
              strokeWidth={(entry.w ?? 7) + ROAD_WALK_BAND * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
              pointerEvents="none"
            />
            <path
              d={d}
              fill="none"
              stroke="#b8b3a4"
              strokeWidth={(entry.w ?? 7) + 2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            <path
              d={d}
              fill="none"
              stroke="#fffdf6"
              strokeWidth={entry.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          </>
        ) : (
          <path
            d={d}
            fill="none"
            stroke={PATH_COLOR[(entry.kind as PathKind) ?? "walk"]}
            strokeWidth={entry.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
        {sel1 && !closed && (
          <path
            d={d}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={px * 1.5}
            strokeDasharray={`${px * 4} ${px * 3}`}
            pointerEvents="none"
          />
        )}
        <path
          d={d}
          fill={closed ? "transparent" : "none"}
          stroke="transparent"
          strokeWidth={Math.max(px * 14, (entry.w ?? 0) + 4)}
          strokeLinecap="round"
          onPointerDown={(e) => startMove(e, layer, i)}
          pointerEvents={tool === "select" ? undefined : "none"}
          style={{ cursor: "move" }}
        />
        {sel1 &&
          tool === "select" &&
          entry.p.map((q, v) => {
            const next = entry.p[(v + 1) % entry.p.length];
            const last = v === entry.p.length - 1;
            return (
              <g key={`h-${v}`}>
                {(!last || closed) && (
                  <circle
                    cx={(q[0] + next[0]) / 2}
                    cy={(q[1] + next[1]) / 2}
                    r={handleR * 0.6}
                    fill="#fff"
                    fillOpacity={0.6}
                    stroke="#3b82f6"
                    strokeWidth={px}
                    style={{ cursor: "copy" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      addMidpoint(layer, i, v);
                    }}
                  />
                )}
                <rect
                  x={q[0] - handleR}
                  y={q[1] - handleR}
                  width={handleR * 2}
                  height={handleR * 2}
                  rx={handleR * 0.5}
                  fill={sel?.v === v ? "#3b82f6" : "#fff"}
                  stroke="#3b82f6"
                  strokeWidth={px * 1.5}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => startVertex(e, layer, i, v)}
                />
              </g>
            );
          })}
      </g>
    );
  }

  const optionProps = {
    kinds: barKinds,
    kind: barKind,
    onKind: applyKind,
    widths: barWidths,
    width: barWidth,
    onWidth: applyWidth,
  };
  const hasOptions = Boolean(barKinds || barWidths);

  return (
    <div ref={boxRef} className="relative h-full min-h-0 p-2">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`}
        className="size-full touch-none select-none rounded-2xl bg-neutral-900"
        style={{
          cursor: drawing ? "crosshair" : "default",
          userSelect: "none",
        }}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // right click: finish the line, then leave drawing, then back to the last tool
        onContextMenu={(e) => {
          e.preventDefault();
          rightClick();
        }}
        onDoubleClick={() => {
          if (drawing && tool !== "ring") finishDraw();
          else if (sel?.v !== undefined) removeSelected();
        }}
      >
        <title>Roads, paths and areas</title>
        <rect
          x={-2000}
          y={-2000}
          width={6000}
          height={6000}
          fill="transparent"
          onPointerDown={onBackgroundDown}
        />
        <image
          href="/auimap-1312.avif"
          width={SIZE}
          height={SIZE}
          opacity={satOpacity}
          pointerEvents="none"
        />

        {/* the buildings, to line things up with. Edited in the Buildings tab */}
        {shapes.buildings.map((b, i) => (
          <path
            key={`b-${i}`}
            d={`M${(b.r ? rectToPolygon(b.r) : (b.p ?? [])).map((q) => q.join(" ")).join("L")}Z`}
            fill="rgba(217,128,95,0.4)"
            stroke="rgba(156,79,56,0.85)"
            strokeWidth={px}
            pointerEvents="none"
          />
        ))}

        {shapes.zones.map((_, i) => renderEditable("zones", i))}
        {shapes.paths.map((_, i) => renderEditable("paths", i))}
        {shapes.roads.map((_, i) => renderEditable("roads", i))}
        {shapes.roundabouts.map((_, i) => renderEditable("roundabouts", i))}

        {drawing && tool !== "ring" && draftPoints.length > 0 && (
          <>
            <path
              d={`M${draftPoints.map((q) => q.join(" ")).join("L")}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={px * 2}
              strokeDasharray={`${px * 5} ${px * 3}`}
              pointerEvents="none"
            />
            {draft.map((q, k) => (
              <circle
                key={`d-${k}`}
                cx={q[0]}
                cy={q[1]}
                r={handleR * 0.7}
                fill="#3b82f6"
                pointerEvents="none"
              />
            ))}
          </>
        )}
        {tool === "ring" && ringCenter && cursor && (
          <circle
            cx={ringCenter[0]}
            cy={ringCenter[1]}
            r={dist(cursor, ringCenter)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={px * 2}
            strokeDasharray={`${px * 5} ${px * 3}`}
            pointerEvents="none"
          />
        )}
        {drawing && cursor && (
          <circle
            cx={cursor[0]}
            cy={cursor[1]}
            r={handleR * 0.5}
            fill="none"
            stroke="#fff"
            strokeWidth={px * 1.5}
            pointerEvents="none"
          />
        )}
      </svg>

      {/* the tools in a column, and what the picked tool offers right beside it */}
      <div className="absolute top-5 left-5 flex items-start gap-2">
        <div className="rounded-xl bg-background/90 p-1 shadow-md ring-1 ring-foreground/10 backdrop-blur">
          <ToggleGroup
            type="single"
            orientation="vertical"
            spacing={1}
            value={tool}
            onValueChange={(value) => value && pickTool(value as Tool)}
          >
            {TOOLS.map(({ id, label, key, icon }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={id}
                    aria-label={label}
                    className="h-auto w-16 flex-col gap-0.5 py-2 text-[0.7rem] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    <Icon icon={icon} className="size-5" />
                    {label}
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <Hint {...{ label }} keys={key} />
                </TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        </div>
        {drawing && hasOptions && (
          <div className="flex flex-col gap-1.5 rounded-xl bg-background/90 p-1.5 shadow-md ring-1 ring-foreground/10 backdrop-blur">
            <Options {...optionProps} />
          </div>
        )}
      </div>

      {/* the selected shape's own toolbar, above it */}
      {anchor && (
        <div
          className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-xl bg-background/95 p-1.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur"
          style={{ left: anchor.x, top: anchor.y }}
        >
          {hasOptions && <Options {...optionProps} />}
          {hasOptions && <Separator orientation="vertical" className="h-5" />}
          {canSplit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={splitSelected}
                >
                  <Icon icon={Scissor01Icon} />
                  Split
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <Hint label="Cut here into two" keys="S" />
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                onClick={removeSelected}
                className="text-destructive hover:text-destructive"
              >
                <Icon icon={Delete02Icon} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <Hint label="Delete" keys="Del" />
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* the actions, top right */}
      <div className="absolute top-5 right-5 flex items-center gap-1.5">
        {status && (
          <span className="rounded-md bg-background/90 px-2 py-1 text-muted-foreground text-xs">
            {status}
          </span>
        )}
        <IconAction
          icon={Undo02Icon}
          label="Undo"
          keys="Ctrl Z"
          disabled={!history.length}
          onClick={undo}
        />
        <IconAction
          icon={Redo02Icon}
          label="Redo"
          keys="Ctrl Shift Z"
          disabled={!future.length}
          onClick={redo}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              variant="outline"
              size="default"
              pressed={dimSatellite}
              onPressedChange={setDimSatellite}
              aria-label="Dim the satellite picture"
              className="bg-background/90 backdrop-blur"
            >
              <Icon icon={Image01Icon} />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Dim the satellite picture</TooltipContent>
        </Tooltip>
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          <Icon icon={FloppyDiskIcon} />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1.5 text-white text-xs">
        {hint}
      </p>
      {drawing && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={cancelDraw}
          aria-label="Stop drawing"
          className="absolute bottom-5 left-5"
        >
          <Icon icon={Cancel01Icon} />
        </Button>
      )}
    </div>
  );
}

// the parts of the drawing this view edits
function lines(s: CampusShapes) {
  return {
    roads: s.roads,
    paths: s.paths,
    zones: s.zones,
    roundabouts: s.roundabouts,
  };
}
