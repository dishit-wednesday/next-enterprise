"use client"

// Player store — cross-tree state shared between SongCard (page) and MiniPlayer (layout)
// wednesday-dev: PascalCase types, camelCase actions, boolean vars prefixed is/has

import { create } from "zustand"

import { shuffleArray } from "lib/itunes/utils"
import type { ItunesTrack } from "lib/itunes/types"

type PlayerState = {
  currentTrack: ItunesTrack | null
  isPlaying: boolean
  volume: number
  queue: ItunesTrack[] // Explicit user queue (Next Up)
  contextQueue: ItunesTrack[] // Original context (Album/Playlist)
  originalContextTracks: ItunesTrack[] // Full context in original order
  history: ItunesTrack[]
  isShuffled: boolean
  isRepeat: boolean
  playbackContext: "search" | "library" | "album" | null
}

type PlayerActions = {
  playTrack: (track: ItunesTrack, context?: "search" | "library" | "album" | null) => void
  playContext: (tracks: ItunesTrack[], startIndex: number, context?: "search" | "library" | "album" | null) => void
  playNext: () => void
  playPrevious: () => void
  addToQueue: (track: ItunesTrack) => void
  togglePlay: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  stop: () => void
  setVolume: (volume: number) => void
}

type PlayerStore = PlayerState & PlayerActions

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 1,
  queue: [],
  contextQueue: [],
  originalContextTracks: [],
  history: [],
  isShuffled: false,
  isRepeat: false,
  playbackContext: null,

  playTrack: (track, context = null) => set({
    currentTrack: track,
    isPlaying: true,
    contextQueue: [], // Reset context when jumping to a specific track
    queue: [], // Clear user queue for single track playback
    playbackContext: context
  }),

  playContext: (tracks, startIndex, context = null) => {
    const track = tracks[startIndex]
    if (!track) return

    const remainingTracks = tracks.slice(startIndex + 1)
    const store = usePlayerStore.getState()

    set({
      currentTrack: track,
      isPlaying: true,
      originalContextTracks: tracks,
      contextQueue: store.isShuffled ? shuffleArray(remainingTracks) : remainingTracks,
      history: tracks.slice(0, startIndex),
      queue: [], // Clear user queue when starting a new context
      playbackContext: context
    })
  },

  playNext: () => set((state) => {
    let nextTrack: ItunesTrack | undefined
    let newQueue = state.queue
    let newContextQueue = state.contextQueue

    // 1. Try User Queue first (Explicit 'Add to Queue' items)
    if (newQueue.length > 0) {
      [nextTrack, ...newQueue] = newQueue
    }
    // 2. Fallback to Context Queue
    else if (newContextQueue.length > 0) {
      [nextTrack, ...newContextQueue] = newContextQueue
    }

    if (!nextTrack) {
      // Loop back if we have history
      if (state.history.length > 0) {
        const fullHistory = [...state.history, state.currentTrack].filter(Boolean) as ItunesTrack[]
        const [first, ...rest] = fullHistory
        return {
          currentTrack: first,
          contextQueue: rest,
          queue: [],
          history: [],
          isPlaying: true
        }
      }
      return { isPlaying: false }
    }

    const newHistory = state.currentTrack
      ? [...state.history, state.currentTrack]
      : state.history

    return {
      currentTrack: nextTrack,
      queue: newQueue,
      contextQueue: newContextQueue,
      history: newHistory,
      isPlaying: true
    }
  }),

  playPrevious: () => set((state) => {
    if (state.history.length === 0) {
      // Loop to end context
      if (state.contextQueue.length > 0 || state.queue.length > 0) {
        const fullFuture = [state.currentTrack, ...state.queue, ...state.contextQueue].filter(Boolean) as ItunesTrack[]
        const last = fullFuture[fullFuture.length - 1]
        const rest = fullFuture.slice(0, -1)
        return {
          currentTrack: last,
          history: rest,
          queue: [],
          contextQueue: [],
          isPlaying: true
        }
      }
      return state
    }

    const previousTrack = state.history[state.history.length - 1]
    const newHistory = state.history.slice(0, -1)

    // Put current track back to the START of upcoming content
    // We prioritize the context queue for returning tracks unless we want them back in explicit queue.
    // For simplicity, we'll put it at the start of contextQueue to resume flow.
    const newContextQueue = state.currentTrack
      ? [state.currentTrack, ...state.contextQueue]
      : state.contextQueue

    return {
      currentTrack: previousTrack,
      history: newHistory,
      contextQueue: newContextQueue,
      isPlaying: true
    }
  }),

  addToQueue: (track) => set((state) => ({
    // Append to User Queue so they play in order of addition (B, then C)
    // The playNext logic will pick from this array before checking contextQueue.
    queue: [...state.queue, track]
  })),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  toggleShuffle: () => set((state) => {
    const newIsShuffled = !state.isShuffled
    if (newIsShuffled) {
      // Shuffling: randomize only the contextQueue
      return {
        isShuffled: true,
        contextQueue: shuffleArray(state.contextQueue)
      }
    } else {
      // Unshuffling: restore original context order from current point
      if (!state.currentTrack) return { isShuffled: false }
      
      const currentIndex = state.originalContextTracks.findIndex(t => t.trackId === state.currentTrack?.trackId)
      const restoredQueue = currentIndex !== -1 
        ? state.originalContextTracks.slice(currentIndex + 1)
        : state.contextQueue

      return {
        isShuffled: false,
        contextQueue: restoredQueue
      }
    }
  }),

  toggleRepeat: () => set((state) => ({ isRepeat: !state.isRepeat })),

  stop: () => set({ currentTrack: null, isPlaying: false }),

  setVolume: (volume) => set({ volume }),
}))
