"use client"

// MiniPlayer — floating glass player for 30-second iTunes previews
// Full redesign: theme-aware colors, working controls, clean layout

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import {
  ChevronDownIcon,
  ChevronUpIcon,
  MaximizeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
} from "components/icons"
import { LikeButton } from "components/LikeButton/LikeButton"
import { ScrollingText } from "components/ScrollingText/ScrollingText"
import { TrackContextMenu } from "components/TrackContextMenu/TrackContextMenu"
import { cn } from "lib/cn"
import { searchSongs } from "lib/itunes/api"
import type { ItunesTrack } from "lib/itunes/types"
import { formatDuration } from "lib/itunes/utils"
import { useAppStore } from "store/useAppStore"
import { usePlayerStore } from "store/usePlayerStore"

export function MiniPlayer() {
  const { 
    currentTrack, isPlaying, togglePlay, volume, setVolume, 
    playNext, playPrevious, isShuffled, toggleShuffle, isRepeat, toggleRepeat 
  } = usePlayerStore()
  const { isSidebarCollapsed, isFullPagePlayerOpen, setFullPagePlayerOpen } = useAppStore()
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging] = useState(false)

  // Pop-out mini player state
  const [isPopped, setIsPopped] = useState(false)
  const [popPos, setPopPos] = useState({ x: 20, y: 80 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const isDraggingRef = useRef(isDragging)
  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  // Load and play new track when currentTrack changes
  useEffect(() => {
    if (!currentTrack?.previewUrl) return
    
    // Always create a new audio element to guarantee a clean slate and avoid Safari/Chrome media race conditions
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
    
    const audio = new Audio()
    // Important: crossOrigin allows properly tracking media events sometimes blocked otherwise
    audio.crossOrigin = "anonymous" 
    audioRef.current = audio

    audio.src = currentTrack.previewUrl
    audio.volume = volume

    // Playback starting logic
    audio.play().catch((e) => {
      console.error("[MiniPlayer] Autoplay failed:", e)
    })
    
    setProgress(0)
    setCurrentTime(0)
    
  }, [currentTrack?.previewUrl])

  // Sync play/pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.play().catch(() => { })
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Attach ended listener (separating from currentTrack changes so it stays stable)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    const onEnded = async () => {
      const store = usePlayerStore.getState()
      
      if (isRepeat) {
        audio.currentTime = 0
        audio.play().catch(() => { })
      } else {
        // Check if there's anything upcoming in either queue
        if (store.queue.length > 0 || store.contextQueue.length > 0) {
          store.playNext()
        } else if (store.currentTrack) {
          // Fallback handled in discovery useEffect primarily, 
          // but we keep this as a safety net.
          store.stop()
        } else {
          store.stop()
        }
      }
    }
    
    audio.addEventListener("ended", onEnded)
    return () => audio.removeEventListener("ended", onEnded)
  }, [isRepeat, currentTrack])

  // ─────── DISCOVERY / AI AUTOPLAY ───────
  const { playbackContext } = usePlayerStore()
  const [isFetchingDiscovery, setIsFetchingDiscovery] = useState(false)

  useEffect(() => {
    const store = usePlayerStore.getState()
    if (!currentTrack || playbackContext !== "search") return
    
    // Only fetch if queue is actually empty (discovery mode)
    if (store.queue.length > 0 || store.contextQueue.length > 0) return
    if (isFetchingDiscovery) return

    async function triggerDiscovery() {
      if (!currentTrack) return
      setIsFetchingDiscovery(true)
      console.info(`[Discovery] Triggering for: ${currentTrack.trackName} (${currentTrack.primaryGenreName})`)

      try {
        const res = await fetch("/api/ai/autoplay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ genre: currentTrack.primaryGenreName || "Music" })
        })

        if (!res.ok) throw new Error("Discovery API failed")
        const { suggestions } = await res.json() as { suggestions: string[] }
        console.info(`[Discovery] Received AI Suggestions:`, suggestions)

        // Fetch top songs for these suggestions
        console.info(`[Discovery] Searching iTunes for related tracks...`)
        const tracksResults = await Promise.allSettled(
          suggestions.slice(0, 3).map(s => {
            console.info(`[Discovery] -> Fetching for suggestion: "${s}"`)
            return searchSongs(s)
          })
        )

        const discoveryTracks: ItunesTrack[] = []
        for (const r of tracksResults) {
          if (r.status === "fulfilled") {
            // Take 2 tracks per suggestion
            discoveryTracks.push(...r.value.slice(0, 2))
          }
        }

        if (discoveryTracks.length > 0) {
          console.info(`[Discovery] Injected ${discoveryTracks.length} tracks into queue`)
          // Update store's contextQueue directly
          usePlayerStore.setState({ contextQueue: discoveryTracks })
        }
      } catch (err) {
        console.error("[Discovery] Failed:", err)
      } finally {
        setIsFetchingDiscovery(false)
      }
    }

    triggerDiscovery()
  }, [currentTrack?.trackId, playbackContext])

  // Butter-smooth progress updates via rAF
  useEffect(() => {
    let rafId: number
    const update = () => {
      const audio = audioRef.current
      if (audio && !audio.paused && !isDraggingRef.current) {
        if (audio.duration) {
          setProgress(audio.currentTime / audio.duration)
          setCurrentTime(audio.currentTime * 1000)
          setDuration(audio.duration * 1000)
        }
      }
      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Cleanup
  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  // ─────── KEYBOARD SHORTCUTS ───────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, etc.
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return
      }

      switch (e.code) {
        case "Space":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowRight":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            handleNextTrack()
          }
          break
        case "ArrowLeft":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            handlePrevTrack()
          }
          break
        case "KeyM":
          e.preventDefault()
          setVolume(volume === 0 ? 0.5 : 0)
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [togglePlay, handleNextTrack, handlePrevTrack, volume, setVolume])

  if (!currentTrack) return null

  const artworkUrl = currentTrack.artworkUrl100.replace("100x100", "300x300")
  const fullArtworkUrl = currentTrack.artworkUrl100.replace("100x100", "800x800")

  // ─────── Seek helpers ───────
  function getRatioFromMouseEvent(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function seekTo(ratio: number) {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    seekTo(getRatioFromMouseEvent(e))
  }

  function handlePrevTrack() {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
    } else {
      playPrevious()
    }
  }

  function handleNextTrack() {
    playNext()
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVolume(parseFloat(e.target.value))
  }

  // ─────── Pop-out drag ───────
  function startDrag(e: React.MouseEvent<HTMLDivElement>) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: popPos.x, origY: popPos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setPopPos({
        x: Math.max(0, dragRef.current.origX + ev.clientX - dragRef.current.startX),
        y: Math.max(0, dragRef.current.origY + ev.clientY - dragRef.current.startY),
      })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  // ─────── FULL PAGE PLAYER ───────
  const fullPagePlayerNode = isFullPagePlayerOpen ? (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black animate-fade-in overflow-hidden">
      {/* Blurred art background */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={fullArtworkUrl}
          alt=""
          fill
          className="object-cover blur-[120px] scale-150 opacity-40 select-none pointer-events-none"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Thin progress bar — very top edge */}
      <div
        className="absolute top-0 left-0 w-full h-1 bg-white/10 cursor-pointer group z-10"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-white relative"
          style={{ width: `${progress * 100}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 size-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow" />
        </div>
      </div>

      {/* Close button */}
      <div className="relative z-10 flex justify-between items-center px-8 pt-8 pb-4">
        <button
          onClick={() => setFullPagePlayerOpen(false)}
          className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronDownIcon width={22} height={22} />
        </button>
        <span className="text-white/60 text-sm font-medium tracking-widest uppercase">Now Playing</span>
        <div className="flex items-center gap-2">
          <LikeButton trackId={currentTrack.trackId} size={22} className="text-white/60 hover:text-white" />
          <TrackContextMenu track={currentTrack} variant="dark" />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center flex-1 px-8 pb-12 gap-6 justify-center max-w-md mx-auto w-full">
        {/* Artwork */}
        <div className={cn(
          "w-72 h-72 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-2xl border border-white/10",
          isPlaying && "animate-pulse-scale"
        )}>
          <Image
            src={fullArtworkUrl}
            alt={currentTrack.collectionName}
            width={800}
            height={800}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track info */}
        <div className="w-full flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-white truncate">{currentTrack.trackName}</h1>
          <button
            className="text-white/60 text-lg truncate text-left hover:text-white transition-colors"
            onClick={() => {
              setFullPagePlayerOpen(false)
              router.push(`/?view=artist_detail&id=${currentTrack.artistId}`, { scroll: false })
            }}
          >
            {currentTrack.artistName}
          </button>
        </div>

        {/* Seekbar */}
        <div className="w-full flex flex-col gap-2">
          <div
            className="w-full h-1 bg-white/20 rounded-full relative cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="absolute top-0 left-0 h-full bg-white rounded-full"
              style={{ width: `${progress * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 size-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-white/50 tabular-nums">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full flex items-center justify-between">
          <button
            onClick={toggleShuffle}
            className={cn(
              "size-10 flex items-center justify-center rounded-full transition-colors",
              isShuffled ? "text-white bg-white/20" : "text-white/40 hover:text-white"
            )}
            title="Shuffle"
          >
            <ShuffleIcon width={22} height={22} />
          </button>

          <button
            onClick={toggleRepeat}
            className={cn(
              "size-10 flex items-center justify-center rounded-full transition-colors",
              isRepeat ? "text-white bg-white/20" : "text-white/40 hover:text-white"
            )}
            title="Repeat"
          >
            <RepeatIcon width={22} height={22} />
          </button>

          <button
            onClick={handlePrevTrack}
            className="size-12 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
            title="Previous track"
          >
            <SkipBackIcon width={28} height={28} />
          </button>

          <button
            onClick={togglePlay}
            className="size-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl"
          >
            {isPlaying
              ? <PauseIcon width={28} height={28} />
              : <PlayIcon width={28} height={28} className="ml-1" />
            }
          </button>

          <button
            onClick={handleNextTrack}
            className="size-12 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
            title="Next track"
          >
            <SkipForwardIcon width={28} height={28} />
          </button>

          <div className="size-10" /> {/* spacer to balance repeat */}
        </div>

        {/* Volume */}
        <div className="w-full flex items-center gap-3">
          <VolumeIcon className="text-white/40 shrink-0" width={18} height={18} />
          <input
            type="range"
            min="0" max="1" step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 accent-white rounded-full cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
    : null

  // ─────── POP-OUT MINI PLAYER ───────
  const poppedNode = isPopped ? (
    <div
      className="fixed z-[150] w-64 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
      style={{ left: popPos.x, top: popPos.y }}
    >
      {/* Drag handle */}
      <div
        className="h-6 bg-surface-elevated cursor-grab active:cursor-grabbing flex items-center justify-between px-3"
        onMouseDown={startDrag}
      >
        <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Now Playing</span>
        <button
          className="text-muted hover:text-primary transition-colors"
          onClick={() => setIsPopped(false)}
        >
          ✕
        </button>
      </div>

      {/* Thin progress bar */}
      <div
        className="w-full h-[3px] bg-surface-elevated cursor-pointer"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-primary"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="p-3 flex items-center gap-3">
        <div className={cn(
          "size-10 rounded-lg overflow-hidden shrink-0 border border-border",
          isPlaying && "animate-pulse-scale"
        )}>
          <Image src={artworkUrl} alt={currentTrack.trackName} width={40} height={40} className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-primary truncate">{currentTrack.trackName}</span>
          <span className="text-[10px] text-muted truncate">{currentTrack.artistName}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 pb-3 gap-1">
        <button onClick={handlePrevTrack} className="size-8 flex items-center justify-center rounded-full text-muted hover:text-primary transition-colors">
          <SkipBackIcon width={16} height={16} />
        </button>
        <button
          onClick={togglePlay}
          className="size-9 bg-primary text-bg rounded-full flex items-center justify-center hover:opacity-90 transition-all"
        >
          {isPlaying ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} className="ml-0.5" />}
        </button>
        <button onClick={handleNextTrack} className="size-8 flex items-center justify-center rounded-full text-muted hover:text-primary transition-colors">
          <SkipForwardIcon width={16} height={16} />
        </button>
        <div className="flex items-center gap-1 flex-1 ml-1">
          <VolumeIcon className="text-muted shrink-0" width={12} height={12} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-surface-elevated accent-primary cursor-pointer rounded-full"
          />
        </div>
      </div>
    </div>
  )
    : null

  // ─────── MAIN MINI PLAYER BAR ───────
  return (
    <>
      {fullPagePlayerNode}
      {poppedNode}
      <footer
        role="region"
        aria-label="Now playing"
        className={cn(
          "fixed bottom-5 z-50 bg-surface border border-border backdrop-blur-2xl shadow-card transition-all duration-300 animate-slide-up",
          "rounded-2xl",
          "left-1/2 -translate-x-1/2 w-[92%] max-w-5xl",
          "md:left-auto md:translate-x-0 md:right-5 md:max-w-none",
          isSidebarCollapsed ? "md:w-[calc(100%-120px)]" : "md:w-[calc(100%-320px)]"
        )}
      >
        {/* ── Main row ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 md:px-5">

          {/* Left — artwork + info */}
          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none md:w-[28%]">
            <div className={cn(
              "size-9 md:size-10 rounded-lg overflow-hidden border border-border shrink-0",
              isPlaying && "animate-pulse-scale"
            )}>
              <Image
                src={artworkUrl}
                alt={currentTrack.collectionName}
                width={48} height={48}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <div className="text-xs md:text-sm font-semibold text-primary min-w-0 flex-1 overflow-hidden">
                  <ScrollingText text={currentTrack.trackName} />
                </div>
                {isPlaying && (
                  <span className="flex items-end gap-[1.5px] h-3 shrink-0">
                    <span className="w-[2px] bg-primary animate-eq-bar-1 rounded-full" />
                    <span className="w-[2px] bg-primary animate-eq-bar-2 rounded-full" />
                    <span className="w-[2px] bg-primary animate-eq-bar-3 rounded-full" />
                  </span>
                )}
              </div>
              <button
                className="text-[11px] text-muted truncate text-left hover:text-primary transition-colors"
                onClick={() => router.push(`/?view=artist_detail&id=${currentTrack.artistId}`, { scroll: false })}
              >
                {currentTrack.artistName}
              </button>
            </div>
            <LikeButton trackId={currentTrack.trackId} size={18} className="ml-1 hidden md:block" />
          </div>

          {/* Center — transport & progress (hidden on mobile) */}
          <div className="hidden md:flex flex-col items-center justify-center gap-1.5 flex-1 max-w-[40%]">
            <div className="flex items-center gap-4">
              {/* Previous */}
              <button
                onClick={handlePrevTrack}
                title="Previous track"
                className="size-8 flex items-center justify-center rounded-full text-muted hover:text-primary hover:bg-surface-elevated transition-colors"
              >
                <SkipBackIcon width={18} height={18} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="size-10 bg-primary text-bg rounded-full flex items-center justify-center hover:opacity-80 transition-all shadow-sm"
              >
                {isPlaying
                  ? <PauseIcon width={14} height={14} />
                  : <PlayIcon width={14} height={14} className="ml-0.5" />
                }
              </button>

              {/* Next */}
              <button
                onClick={handleNextTrack}
                title="Next track"
                className="size-8 flex items-center justify-center rounded-full text-muted hover:text-primary hover:bg-surface-elevated transition-colors"
              >
                <SkipForwardIcon width={18} height={18} />
              </button>

              {/* Shuffle */}
              <button
                onClick={toggleShuffle}
                title={isShuffled ? "Shuffle: On" : "Shuffle: Off"}
                className={cn(
                  "size-8 flex items-center justify-center rounded-full transition-colors",
                  isShuffled ? "text-primary bg-primary/10" : "text-muted hover:text-primary hover:bg-surface-elevated"
                )}
              >
                <ShuffleIcon width={16} height={16} />
              </button>

              {/* Repeat */}
              <button
                onClick={toggleRepeat}
                title={isRepeat ? "Repeat: On" : "Repeat: Off"}
                className={cn(
                  "size-8 flex items-center justify-center rounded-full transition-colors",
                  isRepeat ? "text-primary bg-primary/10" : "text-muted hover:text-primary hover:bg-surface-elevated"
                )}
              >
                <RepeatIcon width={16} height={16} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-3 w-full">
              <span className="text-[10px] text-muted tabular-nums">{formatDuration(currentTime)}</span>
              <div
                className="flex-1 h-1.5 bg-surface-elevated rounded-full relative cursor-pointer group"
                onClick={handleSeek}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-primary rounded-full"
                  style={{ width: `${progress * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 size-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
                </div>
              </div>
              <span className="text-[10px] text-muted tabular-nums">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Mobile — play only */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            <button
              onClick={togglePlay}
              className="size-9 bg-primary text-bg rounded-full flex items-center justify-center"
            >
              {isPlaying ? <PauseIcon width={12} height={12} /> : <PlayIcon width={12} height={12} className="ml-0.5" />}
            </button>
          </div>

          {/* Right — volume + utilities */}
          <div className="hidden md:flex items-center gap-2 md:w-[28%] justify-end">
            {/* 3-dot context menu */}
            <TrackContextMenu track={currentTrack} />

            {/* Volume */}
            <div className="flex items-center gap-1.5 w-24 group">
              <VolumeIcon className="text-muted group-hover:text-primary shrink-0 transition-colors" width={14} height={14} />
              <input
                type="range" min="0" max="1" step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1 accent-primary cursor-pointer rounded-full opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Pop out */}
            <button
              onClick={() => setIsPopped(true)}
              title="Pop out player"
              className="size-7 flex items-center justify-center rounded-md text-muted hover:text-primary hover:bg-surface-elevated transition-colors"
            >
              <MaximizeIcon width={15} height={15} />
            </button>

            {/* Expand to full page */}
            <button
              onClick={() => setFullPagePlayerOpen(true)}
              title="Full page player"
              className="size-7 flex items-center justify-center rounded-md text-muted hover:text-primary hover:bg-surface-elevated transition-colors"
            >
              <ChevronUpIcon width={15} height={15} />
            </button>
          </div>
        </div>
      </footer>
    </>
  )
}
