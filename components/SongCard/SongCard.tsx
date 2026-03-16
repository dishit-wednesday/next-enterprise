"use client"

// SongCard — wednesday-design: dark surface card, green glow on active, hover lift
// wednesday-dev: formatDuration helper, handlePlay event handler

import Image from "next/image"

import { EqualizerIcon, PauseIcon, PlayIcon } from "components/icons"
import { LikeButton } from "components/LikeButton/LikeButton"
import { TrackContextMenu } from "components/TrackContextMenu/TrackContextMenu"
import { cn } from "lib/cn"
import { useRequireAuth } from "lib/hooks/useRequireAuth"
import type { ItunesTrack } from "lib/itunes/types"
import { formatDuration } from "lib/itunes/utils"
import { usePlayerStore } from "store/usePlayerStore"

interface SongCardProps {
  track: ItunesTrack
  context?: ItunesTrack[]
  contextIndex?: number
  playbackContext?: "search" | "library" | "album" | null
}

export function SongCard({ track, context, contextIndex, playbackContext }: SongCardProps) {
  const { currentTrack, isPlaying, playTrack, playContext, togglePlay } = usePlayerStore()
  const { requireAuth } = useRequireAuth()
  const isCurrentTrack = currentTrack?.trackId === track.trackId
  const isActiveAndPlaying = isCurrentTrack && isPlaying

  function handlePlay() {
    if (!track.previewUrl) return
    requireAuth(() => {
      if (isCurrentTrack) {
        togglePlay()
      } else {
        if (context && contextIndex !== undefined) {
          playContext(context, contextIndex, playbackContext)
        } else {
          playTrack(track, playbackContext)
        }
      }
    })
  }

  const artworkUrl = track.artworkUrl100.replace("100x100", "300x300")

  return (
    <div
      onClick={handlePlay}
      className={cn(
        "group flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-xl cursor-pointer transition-all duration-200 border active:scale-[0.98]",
        isCurrentTrack
          ? "bg-surface-elevated border-primary/20"
          : "border-transparent hover:bg-surface-elevated/80"
      )}
    >
      {/* Artwork — 40px on mobile, 48px on md+ */}
      <div className="relative shrink-0 size-10 md:size-12">
        <Image
          src={artworkUrl}
          alt={track.collectionName}
          fill
          className="rounded-lg block transition-transform duration-200 group-hover:scale-105 object-cover"
        />
        {isCurrentTrack ? (
          <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
            {isActiveAndPlaying ? (
              <EqualizerIcon />
            ) : (
              <PlayIcon width={14} height={14} className="text-primary" />
            )}
          </div>
        ) : (
          <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <PlayIcon width={14} height={14} className="text-primary" />
          </div>
        )}
      </div>

      {/* Track info — flex-1 min-w-0 ensures truncation works */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold truncate m-0 leading-snug", isCurrentTrack ? "text-primary" : "text-primary/90")}>
          {track.trackName}
        </p>
        <p className="text-[11px] text-muted truncate mt-0.5 m-0 uppercase tracking-wide">
          {track.artistName}
          <span className="hidden md:inline"> · {track.collectionName}</span>
        </p>
      </div>

      {/* Duration — hidden on mobile, visible on sm+ */}
      <span className="hidden md:block text-xs text-muted shrink-0 tabular-nums">
        {formatDuration(track.trackTimeMillis)}
      </span>

      {/* Actions container — fixed size to prevent shifting */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-auto mr-1">
        <LikeButton trackId={track.trackId} size={20} className="shrink-0" />
        
        <TrackContextMenu track={track} />

        {/* Play button — desktop only. Always occupies space to prevent heart shifting */}
        <button
          onClick={(e) => { e.stopPropagation(); handlePlay() }}
          disabled={!track.previewUrl}
          aria-label={isActiveAndPlaying ? "Pause" : "Play preview"}
          className={cn(
            "size-8 rounded-full border-0 items-center justify-center shrink-0 transition-opacity duration-200 hidden md:flex",
            isActiveAndPlaying
              ? "bg-gradient-brand shadow-glow-sm opacity-100"
              : "bg-surface-elevated opacity-0 group-hover:opacity-100",
            !track.previewUrl && "cursor-not-allowed !opacity-40"
          )}
        >
          {isActiveAndPlaying ? (
            <PauseIcon width={12} height={12} className="text-bg" />
          ) : (
            <PlayIcon width={12} height={12} className={isCurrentTrack ? "text-primary" : "text-muted"} />
          )}
        </button>
      </div>
    </div>
  )
}
