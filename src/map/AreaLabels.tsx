"use client";

import { triggerHaptic } from "@/utils/haptics";
import type { Area } from "./areas";
import { latLongToPosition } from "./geo";
import { type CrayonTuning, tagPinFillColor } from "./tagColor";
import type { MapItem } from "./types";

const SIZE = 1312;
// text narrower than this on screen is not worth reading, the pin does the job instead
export const MIN_TEXT_PX = 9;
const MAX_TEXT_PX = 15;

function inside(p: [number, number], pts: Area["pts"]) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    )
      hit = !hit;
  }
  return hit;
}

export type Block = { area: Area; item: MapItem; size: number };

// every building or area with exactly one place inside becomes a coloured block carrying the name,
// as long as the name fits at this zoom. Anything crowded, or too small to read, keeps its pins.
// Returns the blocks to paint
export function singlePlaceBlocks(
  areas: Area[],
  items: MapItem[],
  pxPerUnit: number,
): Block[] {
  if (!pxPerUnit) return [];
  const main = items.filter((item) => item.minZoom == null);
  const inAreas = new Map<number, MapItem[]>();
  for (const item of main) {
    const [x, y] = latLongToPosition(item.latitude, item.longitude);
    const at: [number, number] = [x * SIZE, y * SIZE];
    areas.forEach((area, i) => {
      if (inside(at, area.pts))
        inAreas.set(i, [...(inAreas.get(i) ?? []), item]);
    });
  }
  const blocks: Block[] = [];
  for (const [i, list] of inAreas) {
    if (list.length !== 1) continue;
    const area = areas[i];
    const item = list[0];
    const chars = Math.max(1, item.shortestName.length);
    const fit = Math.min(area.thick * 0.62, (area.len * 0.88) / (chars * 0.6));
    const size = Math.min(fit, MAX_TEXT_PX / pxPerUnit);
    if (size * pxPerUnit < MIN_TEXT_PX) continue;
    blocks.push({ area, item, size });
  }
  return blocks;
}

export function AreaLabels({
  blocks,
  selectedId,
  previewTagId,
  onSelect,
  tuning,
}: {
  blocks: Block[];
  selectedId: string | null;
  // the category being hovered in the filter, others fade
  previewTagId: string | null;
  onSelect: (id: string | null) => void;
  tuning?: CrayonTuning;
}) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="pointer-events-none absolute inset-0 size-full"
    >
      {blocks.map(({ area, item, size }) => {
        const fill = tagPinFillColor(item.tag.color, tuning);
        const picked = item.id === selectedId;
        const dim = previewTagId !== null && item.tag.id !== previewTagId;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a clickable shape on the map image, the same place has its own pin button elsewhere
          <g
            key={item.id}
            opacity={dim ? 0.2 : 1}
            className="pointer-events-auto cursor-pointer"
            role="button"
            tabIndex={-1}
            aria-label={item.title}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) return;
              e.stopPropagation();
              triggerHaptic();
              onSelect(picked ? null : item.id);
            }}
          >
            <path
              d={area.d}
              fill={fill}
              fillOpacity={0.93}
              stroke="white"
              strokeWidth={picked ? 1.6 : 0.8}
              strokeLinejoin="round"
            />
            <text
              x={area.c[0]}
              y={area.c[1]}
              transform={`rotate(${area.ang} ${area.c[0]} ${area.c[1]})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size}
              fontWeight={700}
              fill="white"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={size * 0.16}
              paintOrder="stroke fill"
              strokeLinejoin="round"
            >
              {item.shortestName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
