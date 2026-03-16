"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "lib/cn"

interface ScrollingTextProps {
  text: string
  className?: string
}

/**
 * ScrollingText — Smooth marquee that only activates when text overflows its container.
 * Pauses on hover. Uses a duplicate span trick for a seamless infinite loop.
 */
export function ScrollingText({ text, className }: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [duration, setDuration] = useState("12s")

  useEffect(() => {
    const checkOverflow = () => {
      if (!containerRef.current || !textRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      const textWidth = textRef.current.scrollWidth

      if (textWidth > containerWidth) {
        // Speed: ~40px per second looks comfortable
        const secs = Math.max(6, textWidth / 40)
        setDuration(`${secs.toFixed(1)}s`)
        setShouldScroll(true)
      } else {
        setShouldScroll(false)
      }
    }

    // Small delay so layout is stable before measuring
    const id = setTimeout(checkOverflow, 100)
    window.addEventListener("resize", checkOverflow)
    return () => {
      clearTimeout(id)
      window.removeEventListener("resize", checkOverflow)
    }
  }, [text])

  if (!shouldScroll) {
    // Static — just truncate with ellipsis
    return (
      <div className={cn("truncate min-w-0", className)}>
        {text}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden whitespace-nowrap min-w-0", className)}
    >
      {/* We render two copies side-by-side; animating the wrapper by -50% gives a perfect seamless loop */}
      <div
        className="inline-flex animate-marquee hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": duration } as React.CSSProperties}
      >
        <span ref={textRef} className="pr-16 shrink-0">
          {text}
        </span>
        <span className="pr-16 shrink-0" aria-hidden>
          {text}
        </span>
      </div>
    </div>
  )
}
