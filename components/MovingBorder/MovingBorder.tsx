"use client"

import { useEffect, useRef } from "react"

import { cn } from "lib/cn"

interface MovingBorderProps {
  children: React.ReactNode
  className?: string
  containerClassName?: string
  borderRadius?: string
  /** Animation duration in ms */
  duration?: number
}

export function MovingBorder({
  children,
  className,
  containerClassName,
  borderRadius = "14px",
  duration = 3000,
}: MovingBorderProps) {
  const borderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = borderRef.current
    if (!el) return

    let start: number | null = null
    let frameId: number

    function animate(time: number) {
      if (!start) start = time
      const progress = ((time - start) % duration) / duration
      const angle = progress * 360
      if (el) {
        el.style.background = `conic-gradient(from ${angle}deg at 50% 50%, rgba(251, 191, 36, 0.9) 0%, rgba(217, 119, 6, 0.5) 8%, transparent 20%, transparent 80%, rgba(217, 119, 6, 0.3) 92%, rgba(251, 191, 36, 0.9) 100%)`
      }
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [duration])

  return (
    <div
      className={cn("relative p-[1.5px]", containerClassName)}
      style={{ borderRadius }}
    >
      {/* Animated gradient border */}
      <div
        ref={borderRef}
        className="absolute inset-0"
        style={{ borderRadius }}
      />
      {/* Inner content */}
      <div
        className={cn("relative z-10", className)}
        style={{ borderRadius }}
      >
        {children}
      </div>
    </div>
  )
}
