"use client"
import { create } from "zustand"

// TWO SOURCES of truth for personalization:
// 1. useLikeStore (liked songs) — PERSISTENT, from database, represents long-term taste
// 2. useDiscoveryStore (session listen history) — IN-MEMORY, resets on refresh, represents current mood

type ListenEvent = {
  trackId: number
  artistName: string
  genre: string
  listenRatio: number // 0.0 = instant skip, 1.0 = completed full preview
}

type DiscoveryStore = {
  sessionHistory: ListenEvent[]
  recordListen: (event: ListenEvent) => void
  getSkippedGenres: () => string[]
  getEngagedGenres: () => string[]
}

export const useDiscoveryStore = create<DiscoveryStore>((set, get) => ({
  sessionHistory: [],

  recordListen: (event) => {
    console.info(`[DiscoveryStore] Recording listen: ${event.artistName} - "${event.trackId}" (Ratio: ${event.listenRatio.toFixed(2)})`)
    set((state) => ({
      sessionHistory: [...state.sessionHistory.slice(-20), event], // keep last 20
    }))
  },

  getSkippedGenres: () => {
    // < 0.33 = listened to less than 1/3 of the 30s preview = skip signal
    const skipped = get().sessionHistory.filter((e) => e.listenRatio < 0.33)
    const genres = Array.from(new Set(skipped.map((e) => e.genre)))
    if (genres.length > 0) console.info(`[DiscoveryStore] Skipped genres (session):`, genres)
    return genres
  },

  getEngagedGenres: () => {
    // > 0.85 = listened to nearly all of the preview = strong positive signal
    // NOTE: Using 0.85 not 0.66 — auto-transitioning tracks can passively hit 0.66
    // without the user actually "choosing" to listen. 0.85 is a stronger intent signal.
    const engaged = get().sessionHistory.filter((e) => e.listenRatio > 0.85)
    const genres = Array.from(new Set(engaged.map((e) => e.genre)))
    if (genres.length > 0) console.info(`[DiscoveryStore] Engaged genres (session):`, genres)
    return genres
  },
}))
