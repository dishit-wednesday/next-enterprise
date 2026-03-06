"use client"

// FloatingNotes — musical notation symbols floating OVER the entire app
// + wavy ribbon trail of musical notes that follows the mouse path
// wednesday-design: framer-motion, primary palette, pointer-events-none overlay
// wednesday-dev: useRef for mouse, requestAnimationFrame for trail rendering

import { useEffect, useRef, useState } from "react"

import { motion } from "framer-motion"

// --- Musical SVG paths (viewBox="0 0 24 24") ---

const TREBLE_CLEF =
  "M12 2C12 2 9.5 5 9.5 8.5C9.5 10.5 10.5 12 12 13C12 13 10 14 10 16.5C10 19 12 21 14 21C16 21 17.5 19.5 17.5 17.5C17.5 15.5 16 14 14 14C13.5 14 13 14.2 13 14.2L13 8C13 8 15 6.5 15 4.5C15 2.5 13.5 2 12 2Z"

const QUARTER_NOTE =
  "M9 3L9 18C9 18 6 17 5 18.5C4 20 5.5 22 8 22C10.5 22 12 20 12 18.5C12 17.5 11 17 11 17L11 7L17 5.5L17 15C17 15 14 14 13 15.5C12 17 13.5 19 16 19C18.5 19 20 17 20 15.5C20 14.5 19 14 19 14L19 3L9 3Z"

const EIGHTH_NOTE =
  "M10 3L10 18C10 18 7 17 6 18.5C5 20 6.5 22 9 22C11.5 22 13 20 13 18.5C13 17.5 12 17 12 17L12 5L18 3C18 3 17 8 14 11"

const BEAMED_NOTES =
  "M5 4L5 18C5 18 3 17 2 18.5C1 20 2.5 22 5 22C7 22 8.5 20.5 8.5 19C8.5 17.5 7 17 7 17L7 7L19 4L19 15C19 15 17 14 16 15.5C15 17 16.5 19 19 19C21 19 22.5 17.5 22.5 16C22.5 14.5 21 14 21 14L21 2L5 4Z"

const SHARP_SIGN =
  "M8 2L8 7L6 7.7L6 10.2L8 9.5L8 14.5L6 15.2L6 17.7L8 17L8 22L10 22L10 16.3L14 14.9L14 19.9L12 20.6L12 23L14 22.3L14 22L16 22L16 14.2L18 13.5L18 11L16 11.7L16 6.7L18 6L18 3.5L16 4.2L16 2L14 2L14 4.9L10 6.3L10 2L8 2ZM10 8.8L14 7.4L14 12.4L10 13.8L10 8.8Z"

const FLAT_SIGN =
  "M8 2L8 22L10 22L10 16C10 16 14 14 14 11C14 8 10 8 10 8L10 2L8 2ZM10 10C10 10 12 10.5 12 12C12 13.5 10 14.5 10 14.5L10 10Z"

const WHOLE_NOTE =
  "M12 7C8.5 7 6 9.5 6 12C6 14.5 8.5 17 12 17C15.5 17 18 14.5 18 12C18 9.5 15.5 7 12 7ZM12 9.5C14 9.5 15.5 10.5 15.5 12C15.5 13.5 14 14.5 12 14.5C10 14.5 8.5 13.5 8.5 12C8.5 10.5 10 9.5 12 9.5Z"

const HALF_NOTE =
  "M10 3L10 17C10 17 7 16 6 17.5C5 19 6.5 21 9 21C11.5 21 13 19 13 17.5C13 16.5 12 16 12 16L12 3L10 3ZM9 17.5C9 17.5 7.5 18 7.5 19C7.5 20 9 20.5 9.5 19.5C10 18.5 9 17.5 9 17.5Z"

const MUSIC_SYMBOLS = [
  { path: TREBLE_CLEF, scale: 1.3 },
  { path: QUARTER_NOTE, scale: 1 },
  { path: EIGHTH_NOTE, scale: 1 },
  { path: BEAMED_NOTES, scale: 1.1 },
  { path: SHARP_SIGN, scale: 0.85 },
  { path: FLAT_SIGN, scale: 0.85 },
  { path: WHOLE_NOTE, scale: 0.9 },
  { path: HALF_NOTE, scale: 1 },
]

// --- Ambient floating notes ---

const AMBIENT_COUNT = 16

interface AmbientConfig {
  symbol: (typeof MUSIC_SYMBOLS)[number]
  x: number
  y: number
  size: number
  opacity: number
  duration: number
  delay: number
  driftX: number
  driftY: number
  rotation: number
}

function generateAmbientConfigs(): AmbientConfig[] {
  return Array.from({ length: AMBIENT_COUNT }, () => {
    const symbol = MUSIC_SYMBOLS[Math.floor(Math.random() * MUSIC_SYMBOLS.length)]!
    return {
      symbol,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 20 + Math.random() * 28,
      opacity: 0.12 + Math.random() * 0.14,
      duration: 16 + Math.random() * 14,
      delay: Math.random() * -20,
      driftX: (Math.random() - 0.5) * 80,
      driftY: (Math.random() - 0.5) * 50,
      rotation: (Math.random() - 0.5) * 40,
    }
  })
}

// --- Wavy mouse trail ---

// Each point on the trail stores the cursor position + a pre-assigned symbol
interface TrailPoint {
  x: number
  y: number
  symbol: (typeof MUSIC_SYMBOLS)[number]
  size: number
}

const TRAIL_LENGTH = 18 // number of notes in the ribbon
const WAVE_AMPLITUDE = 18 // px — how far the wave swings perpendicular to movement
const WAVE_FREQUENCY = 0.35 // how tight the wave oscillation is
const TRAIL_NOTE_SIZE_MIN = 10
const TRAIL_NOTE_SIZE_MAX = 18
const SAMPLE_DISTANCE = 12 // min px between trail points (avoids clumping)

// Pre-generate which symbol each trail slot gets (stable across renders)
function generateTrailSymbols() {
  return Array.from({ length: TRAIL_LENGTH }, () => ({
    symbol: MUSIC_SYMBOLS[Math.floor(Math.random() * MUSIC_SYMBOLS.length)]!,
    size: TRAIL_NOTE_SIZE_MIN + Math.random() * (TRAIL_NOTE_SIZE_MAX - TRAIL_NOTE_SIZE_MIN),
  }))
}

// --- Main component ---

export function FloatingNotes() {
  const [ambientConfigs] = useState(generateAmbientConfigs)

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Ambient floating notes */}
      {ambientConfigs.map((config, i) => (
        <AmbientNote key={i} config={config} />
      ))}

      {/* Wavy mouse trail */}
      <MouseTrail />
    </div>
  )
}

// --- Ambient note (unchanged) ---

function AmbientNote({ config }: { config: AmbientConfig }) {
  const { symbol, x, y, size, opacity, duration, delay, driftX, driftY, rotation } = config
  const actualSize = size * symbol.scale

  return (
    <motion.div
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{
        x: [0, driftX, -driftX * 0.5, driftX * 0.3, 0],
        y: [0, driftY, -driftY * 0.6, driftY * 0.4, 0],
        rotate: [0, rotation, -rotation * 0.5, rotation * 0.3, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg
        width={actualSize}
        height={actualSize}
        viewBox="0 0 24 24"
        fill="none"
        className="text-primary"
      >
        <path d={symbol.path} fill="currentColor" fillOpacity={opacity} />
      </svg>
    </motion.div>
  )
}

// --- Wavy mouse ribbon trail ---
// Stores a rolling buffer of mouse positions, renders a note at each
// with a sine-wave offset perpendicular to movement direction.

function MouseTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<TrailPoint[]>([])
  const [trailSymbols] = useState(generateTrailSymbols)
  const mouseRef = useRef({ x: -200, y: -200 })
  const rafRef = useRef(0)

  // Listen to mouse moves on window
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMouseMove)
    return () => window.removeEventListener("mousemove", onMouseMove)
  }, [])

  // Render loop — update trail buffer + draw to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Resize canvas to match viewport
    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    // SVG path drawing cache — pre-render each symbol to an offscreen canvas
    const symbolCanvases: Map<string, HTMLCanvasElement> = new Map()

    function getSymbolCanvas(symbol: (typeof MUSIC_SYMBOLS)[number], size: number, opacity: number) {
      const key = `${symbol.path}-${Math.round(size)}-${Math.round(opacity * 100)}`
      if (symbolCanvases.has(key)) return symbolCanvases.get(key)!

      const s = size * symbol.scale
      const off = document.createElement("canvas")
      off.width = Math.ceil(s) + 2
      off.height = Math.ceil(s) + 2
      const offCtx = off.getContext("2d")!

      const path2d = new Path2D(symbol.path)
      offCtx.save()
      offCtx.scale(s / 24, s / 24)
      offCtx.fillStyle = `rgba(74, 222, 128, ${opacity})`
      offCtx.fill(path2d)
      offCtx.restore()

      symbolCanvases.set(key, off)
      return off
    }

    let time = 0

    function tick() {
      if (!canvas || !ctx) return
      time += 0.016 // ~60fps

      const { x: mx, y: my } = mouseRef.current
      const trail = trailRef.current

      // Add new point if moved far enough from last point
      const last = trail[trail.length - 1]
      if (!last || Math.hypot(mx - last.x, my - last.y) > SAMPLE_DISTANCE) {
        const slot = trailSymbols[trail.length % TRAIL_LENGTH]!
        trail.push({ x: mx, y: my, symbol: slot.symbol, size: slot.size })
      }

      // Keep only the latest TRAIL_LENGTH points
      while (trail.length > TRAIL_LENGTH) {
        trail.shift()
      }

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw each trail note with wavy offset
      for (let i = 0; i < trail.length; i++) {
        const point = trail[i]!
        const t = i / (trail.length - 1 || 1) // 0 = oldest, 1 = newest

        // Compute direction perpendicular to movement at this point
        let perpX = 0
        let perpY = -1
        if (i < trail.length - 1) {
          const next = trail[i + 1]!
          const dx = next.x - point.x
          const dy = next.y - point.y
          const len = Math.hypot(dx, dy) || 1
          // Perpendicular = rotate 90 degrees
          perpX = -dy / len
          perpY = dx / len
        } else if (i > 0) {
          const prev = trail[i - 1]!
          const dx = point.x - prev.x
          const dy = point.y - prev.y
          const len = Math.hypot(dx, dy) || 1
          perpX = -dy / len
          perpY = dx / len
        }

        // Sine wave offset along the perpendicular
        const wavePhase = i * WAVE_FREQUENCY + time * 2
        const waveOffset = Math.sin(wavePhase) * WAVE_AMPLITUDE * (0.3 + t * 0.7)

        const drawX = point.x + perpX * waveOffset
        const drawY = point.y + perpY * waveOffset

        // Opacity: fade out older notes, newest is brightest
        const opacity = 0.15 + t * 0.45
        // Size: slightly smaller for older notes
        const size = point.size * (0.6 + t * 0.4)

        const symCanvas = getSymbolCanvas(point.symbol, size, opacity)
        const s = size * point.symbol.scale
        ctx.drawImage(symCanvas, drawX - s / 2, drawY - s / 2)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [trailSymbols])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
    />
  )
}
