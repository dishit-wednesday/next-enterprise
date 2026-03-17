"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"

import { ChevronLeftIcon, PlayIcon, ShuffleIcon } from "components/icons"
import { Skeleton } from "components/Skeleton/Skeleton"
import { SongCard } from "components/SongCard/SongCard"

import { cn } from "lib/cn"
import { useRequireAuth } from "lib/hooks/useRequireAuth"
import { fetchArtistWithTopSongs } from "lib/itunes/api"
import type { ItunesArtist, ItunesTrack } from "lib/itunes/types"
import { usePlayerStore } from "store/usePlayerStore"

interface ArtistDetailViewProps {
  onBack: () => void
}

export function ArtistDetailView({ onBack }: ArtistDetailViewProps) {
  const searchParams = useSearchParams()
  const selectedArtistId = searchParams.get("id")
  const { playContext, isShuffled, toggleShuffle } = usePlayerStore()
  const { requireAuth } = useRequireAuth()
  
  const [artist, setArtist] = useState<ItunesArtist | null>(null)
  const [tracks, setTracks] = useState<ItunesTrack[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadArtist() {
      if (!selectedArtistId) return
      setIsLoading(true)
      try {
        const data = await fetchArtistWithTopSongs(selectedArtistId)
        if (data) {
          setArtist(data.artist)
          setTracks(data.tracks)
        }
      } catch (err) {
        console.error("Failed to load artist", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadArtist()
  }, [selectedArtistId])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex gap-6 items-end">
          <Skeleton className="w-[200px] h-[200px] rounded-full shrink-0" />
          <div className="flex flex-col gap-3 w-full max-w-md">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted">Artist not found</p>
        <button onClick={onBack} className="mt-4 text-primary hover:underline bg-transparent border-0 cursor-pointer">
          Go back
        </button>
      </div>
    )
  }

  const initials = artist.artistName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const firstPlayableTrack = tracks.find((t) => t.previewUrl)

  function handlePlayArtist() {
    if (!firstPlayableTrack) return
    requireAuth(() => {
      const startIndex = tracks.findIndex(t => t.trackId === firstPlayableTrack.trackId)
      playContext(tracks, startIndex >= 0 ? startIndex : 0)
    })
  }

  function handleShuffleArtist() {
    if (!firstPlayableTrack) return
    requireAuth(() => {
      if (!isShuffled) {
        toggleShuffle()
      }
      const startIndex = Math.floor(Math.random() * tracks.length)
      playContext(tracks, startIndex)
    })
  }

  return (
    <div className="flex flex-col gap-8 pb-10 fade-in">
      {/* Back button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors w-fit bg-transparent border-0 cursor-pointer p-0"
      >
        <ChevronLeftIcon width={16} height={16} />
        Back
      </button>

      {/* Header */}
      <header className="flex flex-col items-center md:items-end md:flex-row gap-6 text-center md:text-left">
        {artist.artworkUrl ? (
          <Image
            src={artist.artworkUrl}
            alt={artist.artistName}
            width={220}
            height={220}
            className="rounded-full shadow-2xl shrink-0 object-cover w-32 h-32 md:w-[220px] md:h-[220px]"
            priority
          />
        ) : (
          <div className="size-32 md:size-[220px] rounded-full bg-gradient-brand flex items-center justify-center shrink-0 shadow-2xl text-4xl md:text-6xl font-bold text-bg">
            {initials}
          </div>
        )}
        <div className="flex flex-col items-center md:items-start justify-end">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted mb-2">
            Artist
          </span>
          <h1 className="text-3xl md:text-7xl font-extrabold text-primary mb-3 tracking-tight balance-text line-clamp-2">
            {artist.artistName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-primary/70 mb-4">
            <span>{artist.primaryGenreName}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayArtist}
              disabled={!firstPlayableTrack}
              className={cn(
                "flex items-center justify-center size-12 md:size-14 rounded-full bg-primary text-bg hover:scale-105 transition-all shadow-glow-sm cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              <PlayIcon width={24} height={24} className="ml-1" />
            </button>
            <button
              onClick={handleShuffleArtist}
              disabled={!firstPlayableTrack}
              className={cn(
                "flex items-center justify-center size-10 md:size-12 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              title="Shuffle"
            >
              <ShuffleIcon width={20} height={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Tracklist */}
      <section className="flex flex-col gap-0.5 mt-4">
        <h2 className="text-xl font-bold text-primary tracking-[-0.01em] mb-3">Popular Tracks</h2>
        {tracks.map((track, i) => (
          <div key={track.trackId} className="flex items-center gap-1 md:gap-3">
            <span className="w-4 md:w-6 text-xs md:text-sm text-muted text-right tabular-nums shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <SongCard track={track} context={tracks} contextIndex={i} />
            </div>
          </div>
        ))}
        {tracks.length === 0 && (
          <p className="text-muted text-sm py-4">No top tracks available.</p>
        )}
      </section>
    </div>
  )
}
