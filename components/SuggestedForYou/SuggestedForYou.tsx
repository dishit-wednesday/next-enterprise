"use client"

// SuggestedForYou — AI-powered recommendations
// Always visible. Uses liked songs for personalization when available, otherwise suggests popular artists.

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { SparklesIcon } from "components/icons"
import { Skeleton } from "components/Skeleton/Skeleton"
import { SongCard } from "components/SongCard/SongCard"
import { fetchTracksByIds, searchSongs } from "lib/itunes/api"
import type { ItunesTrack } from "lib/itunes/types"
import { useLikeStore } from "store/useLikeStore"

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 min

// Module-level cache so it persists across views
let cachedTracks: ItunesTrack[] | null = null
let cachedPersonalized = false
let cacheTimestamp = 0

export function SuggestedForYou() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const { likedIds, fetchLikes, isLoading: isLoadingLikes } = useLikeStore()

  const [tracks, setTracks] = useState<ItunesTrack[]>(cachedTracks ?? [])
  const [isLoading, setIsLoading] = useState(!cachedTracks)
  const [error, setError] = useState<string | null>(null)
  const [isPersonalized, setIsPersonalized] = useState(cachedPersonalized)

  const fetchedRef = useRef(!!cachedTracks)

  // 1. Initial fetch of likes for signed-in users
  useEffect(() => {
    if (!isSignedIn || !isLoaded) return
    async function init() {
      const token = await getToken()
      await fetchLikes(token)
    }
    init()
  }, [isSignedIn, isLoaded, getToken, fetchLikes])

  // 2. Build recommendations once auth and likes state are settled
  useEffect(() => {
    // Wait until Clerk is loaded
    if (!isLoaded) return

    // If signed in, wait until likes are at least ATTEMPTED
    // If they are still loading, wait.
    if (isSignedIn && isLoadingLikes && !fetchedRef.current) return

    // Prevent double-fetch if already success or already in progress
    if (fetchedRef.current && (tracks.length > 0 || isLoading)) return

    // If we have a fresh cache, use it and stop
    if (cachedTracks && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      setTracks(cachedTracks)
      setIsPersonalized(cachedPersonalized)
      setIsLoading(false)
      fetchedRef.current = true
      return
    }

    fetchedRef.current = true
    buildRecommendations()

    async function buildRecommendations() {
      setIsLoading(true)
      setError(null)

      try {
        let artists: string[] = []
        let genres: string[] = []
        let personalized = false

        // Extract context if available
        if (isSignedIn && likedIds.size > 0) {
          const likedIdArray = Array.from(likedIds)
          const likedTrackData = await fetchTracksByIds(likedIdArray)

          if (likedTrackData.length > 0) {
            const allArtists = likedTrackData.map((t) => t.artistName)
            artists = allArtists.filter((a, i) => allArtists.indexOf(a) === i).slice(0, 10)

            const allGenres = likedTrackData.map((t) => t.primaryGenreName)
            genres = allGenres.filter((g, i) => allGenres.indexOf(g) === i)
            personalized = true
          }
        }

        // Call Groq API route
        const aiRes = await fetch("/api/ai/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artists, genres }),
        })

        if (!aiRes.ok) throw new Error("AI request failed")
        const aiData = await aiRes.json() as { artists: string[] }
        const suggestedArtists = aiData.artists

        // Parallel search on iTunes
        const searchResults = await Promise.allSettled(
          suggestedArtists.slice(0, 8).map((name) => searchSongs(name))
        )

        const likedSet = new Set(Array.from(likedIds).map(Number))
        const allTracks: ItunesTrack[] = []
        for (const r of searchResults) {
          if (r.status === "fulfilled") {
            // Take 2 songs from each artist
            allTracks.push(...r.value.slice(0, 2))
          }
        }

        const seen = new Set<number>()
        const deduped = allTracks.filter((t) => {
          if (!t?.previewUrl) return false
          if (likedSet.has(t.trackId)) return false
          if (seen.has(t.trackId)) return false
          seen.add(t.trackId)
          return true
        })

        // Shuffle picks
        for (let i = deduped.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          const tmp = deduped[i]!
          deduped[i] = deduped[j]!
          deduped[j] = tmp
        }

        const result = deduped.slice(0, 15) // Show up to 15

        // Update cache
        cachedTracks = result
        cachedPersonalized = personalized
        cacheTimestamp = Date.now()

        setTracks(result)
        setIsPersonalized(personalized)
      } catch (err) {
        console.error("[SuggestedForYou] failed:", err)
        setError("Couldn't refresh recommendations right now.")
      } finally {
        setIsLoading(false)
      }
    }
  }, [isLoaded, isSignedIn, isLoadingLikes, likedIds.size, fetchLikes, getToken, tracks.length, isLoading])

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <SparklesIcon width={24} height={24} />

          <h1 className="text-3xl md:text-4xl font-black text-primary tracking-tight m-0">
            Suggested

          </h1>
        </div>
        <p className="text-sm md:text-base text-muted m-0 font-medium">
          {isPersonalized
            ? "AI-crafted recommendations based on your unique taste"
            : "AI-curated trending artists you might discover today"}
        </p>
      </div>

      {/* Grid of Results */}
      {isLoading ? (
        <div className="flex flex-col gap-1 max-w-5xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="size-12 rounded-lg shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-3 w-10 hidden sm:block" />
            </div>
          ))}
        </div>
      ) : error && tracks.length === 0 ? (
        <p className="text-sm text-muted italic">{error}</p>
      ) : tracks.length === 0 ? (
        <p className="text-sm text-muted italic">Looking for the right tunes...</p>
      ) : (
        <div className="flex flex-col gap-1 w-full max-w-5xl">
          {tracks.map((track, i) => (
            <SongCard
              key={track.trackId}
              track={track}
              context={tracks}
              contextIndex={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}
