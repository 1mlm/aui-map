"use client"

import {
  Delete02Icon,
  Download01Icon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import { latLongToPosition } from "@/map/geo"

// one fix: [secondsSinceStart, lat, lng, accuracyM, altitudeM | null, altitudeAccuracyM | null]
type Fix = [number, number, number, number, number | null, number | null]
type Mark = {
  name: string
  at: number
  lat: number
  lng: number
  alt: number | null
}
type Walk = { name: string; startedAt: number; points: Fix[]; marks: Mark[] }

const STORAGE_KEY = "aui_walk_in_progress"
// a fix closer than this to the last one in time is skipped, phones can fire several a second
const MIN_GAP_SECONDS = 0.8

function load(): Walk | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
  } catch {
    return null
  }
}

function Btn({
  icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: HugeIcon
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl corner-squircle px-4 py-3 font-semibold text-sm disabled:opacity-40 ${
        primary ? "bg-primary text-primary-foreground" : "bg-foreground/10"
      }`}
    >
      <Icon icon={icon} className="size-5" />
      {label}
    </button>
  )
}

// walks round campus with the phone and keeps what the gps says: where, how sure it is, and the
// height it reports. Saved on the phone as it goes (a refresh or a dead tab loses nothing), then
// downloaded or sent to the server
export function WalkLogger() {
  const [walk, setWalk] = useState<Walk | null>(null)
  const [recording, setRecording] = useState(false)
  const [last, setLast] = useState<GeolocationCoordinates | null>(null)
  const [markName, setMarkName] = useState("")
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const watchId = useRef<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const walkRef = useRef<Walk | null>(null)

  useEffect(() => {
    const saved = load()
    walkRef.current = saved
    setWalk(saved)
  }, [])

  function commit(next: Walk | null) {
    walkRef.current = next
    setWalk(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      setError("The phone is out of storage, download or send the walk now.")
    }
  }

  async function start() {
    setError("")
    if (!navigator.geolocation) {
      setError("This browser has no location.")
      return
    }
    const current = walkRef.current ?? {
      name: `Walk ${new Date().toLocaleDateString()}`,
      startedAt: Date.now(),
      points: [],
      marks: [],
    }
    commit(current)
    try {
      wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null
    } catch {}
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const w = walkRef.current
        if (!w) return
        setLast(coords)
        const t = (timestamp - w.startedAt) / 1000
        const prev = w.points[w.points.length - 1]
        if (prev && t - prev[0] < MIN_GAP_SECONDS) return
        const r = (v: number, d: number) => Number(v.toFixed(d))
        commit({
          ...w,
          points: [
            ...w.points,
            [
              r(t, 1),
              r(coords.latitude, 7),
              r(coords.longitude, 7),
              r(coords.accuracy, 1),
              coords.altitude === null ? null : r(coords.altitude, 1),
              coords.altitudeAccuracy === null
                ? null
                : r(coords.altitudeAccuracy, 1),
            ],
          ],
        })
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    setRecording(true)
  }

  function pause() {
    if (watchId.current !== null)
      navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    void wakeLock.current?.release()
    wakeLock.current = null
    setRecording(false)
  }

  // the screen lock is dropped when the tab is hidden, take it back when it returns
  useEffect(() => {
    async function again() {
      if (document.visibilityState === "visible" && watchId.current !== null)
        try {
          wakeLock.current =
            (await navigator.wakeLock?.request("screen")) ?? null
        } catch {}
    }
    document.addEventListener("visibilitychange", again)
    return () => document.removeEventListener("visibilitychange", again)
  }, [])

  function mark() {
    const w = walkRef.current
    const p = w?.points[w.points.length - 1]
    if (!w || !p) return
    commit({
      ...w,
      marks: [
        ...w.marks,
        {
          name: markName.trim() || `Point ${w.marks.length + 1}`,
          at: p[0],
          lat: p[1],
          lng: p[2],
          alt: p[4],
        },
      ],
    })
    setMarkName("")
  }

  function download() {
    if (!walk) return
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(walk)], { type: "application/json" }),
    )
    const a = document.createElement("a")
    a.href = url
    a.download = `${walk.name.replace(/[^a-z0-9]+/gi, "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function send() {
    if (!walk) return
    setStatus("Sending...")
    try {
      const res = await fetch("/api/admin/walk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(walk),
      })
      if (!res.ok) throw new Error(String(res.status))
      setStatus("Sent. Safe to clear it from the phone.")
    } catch {
      setStatus("Could not send. Download it instead, nothing is lost.")
    }
  }

  function clear() {
    pause()
    commit(null)
    setLast(null)
    setStatus("")
  }

  const points = walk?.points ?? []
  const heights = points.map((p) => p[4]).filter((h): h is number => h !== null)
  const lastFix = points[points.length - 1]
  const trace = points.map((p) => latLongToPosition(p[1], p[2]))

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl corner-squircle bg-foreground/5 p-3">
          <div className="font-semibold text-2xl tabular-nums">
            {points.length}
          </div>
          <div className="text-muted-foreground text-xs">points</div>
        </div>
        <div className="rounded-2xl corner-squircle bg-foreground/5 p-3">
          <div className="font-semibold text-2xl tabular-nums">
            {last ? `±${Math.round(last.accuracy)}m` : "..."}
          </div>
          <div className="text-muted-foreground text-xs">position</div>
        </div>
        <div className="rounded-2xl corner-squircle bg-foreground/5 p-3">
          <div className="font-semibold text-2xl tabular-nums">
            {last?.altitude != null ? `${Math.round(last.altitude)}m` : "none"}
          </div>
          <div className="text-muted-foreground text-xs">
            height
            {last?.altitudeAccuracy != null
              ? ` ±${Math.round(last.altitudeAccuracy)}m`
              : ""}
          </div>
        </div>
      </div>

      {recording ? (
        <Btn icon={PauseIcon} label="Pause" onClick={pause} />
      ) : (
        <Btn
          icon={PlayIcon}
          label={points.length ? "Continue" : "Start"}
          onClick={start}
          primary
        />
      )}

      <div className="flex gap-2">
        <input
          value={markName}
          onChange={(e) => setMarkName(e.target.value)}
          placeholder="Name this spot (corner of B8B...)"
          className="min-w-0 flex-1 rounded-2xl corner-squircle border bg-background px-3 py-2 text-sm"
        />
        <Btn
          icon={MapPinIcon}
          label="Mark"
          onClick={mark}
          disabled={!lastFix}
        />
      </div>

      {walk && walk.marks.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {walk.marks.map((m, i) => (
            <li
              key={`${m.at}-${i}`}
              className="rounded-xl corner-squircle bg-foreground/10 px-2.5 py-1 text-xs"
            >
              {m.name}
            </li>
          ))}
        </ul>
      )}

      {trace.length > 1 && (
        <svg
          viewBox="0 0 1 1"
          className="aspect-square w-full rounded-2xl bg-neutral-900"
        >
          <title>Where you walked</title>
          <image href="/auimap-640.avif" width="1" height="1" opacity="0.8" />
          <polyline
            points={trace.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.004"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {walk?.marks.map((m, i) => {
            const [x, y] = latLongToPosition(m.lat, m.lng)
            return (
              <circle
                key={`${m.at}-${i}`}
                cx={x}
                cy={y}
                r="0.006"
                fill="#f59e0b"
              />
            )
          })}
        </svg>
      )}

      {heights.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Heights so far: {Math.round(Math.min(...heights))} to{" "}
          {Math.round(Math.max(...heights))} m. A phone's GPS height is rough,
          it can be off by 10 m or more.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Btn
          icon={Upload01Icon}
          label="Send"
          onClick={send}
          disabled={!points.length}
        />
        <Btn
          icon={Download01Icon}
          label="Download"
          onClick={download}
          disabled={!points.length}
        />
      </div>
      <Btn
        icon={Delete02Icon}
        label="Clear from phone"
        onClick={clear}
        disabled={!walk}
      />
      {status && <p className="text-center text-sm">{status}</p>}
      {error && <p className="text-center text-destructive text-sm">{error}</p>}
      <p className="text-center text-muted-foreground text-xs">
        Keep the screen on and walk slowly along the edges. Stop for a few
        seconds at corners.
      </p>
    </div>
  )
}
