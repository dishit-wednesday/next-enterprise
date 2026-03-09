"use client"

// PlaylistsView — acts as the main SPA container when activeView === "playlists"
// wednesday-dev: uses Zustand store to fetch and hold the list

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { PlaylistIcon, SpinnerIcon } from "components/icons"
import { getPlaylists } from "lib/api/playlists"
import { usePlaylistStore } from "store/usePlaylistStore"
import { CreatePlaylistModal } from "components/CreatePlaylistModal/CreatePlaylistModal"
import { PlaylistDetail } from "components/PlaylistDetail/PlaylistDetail"

export function PlaylistsView() {
  const { getToken } = useAuth()
  const { playlists, setPlaylists, isLoading, setIsLoading } = usePlaylistStore()
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    async function fetchAllPlaylists() {
      setIsLoading(true)
      try {
        const token = await getToken()
        const res = await getPlaylists(token)
        if (res.data) {
          setPlaylists(res.data)
        }
      } catch (err) {
        console.error("Failed to load user playlists", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAllPlaylists()
  }, [getToken, setPlaylists, setIsLoading])

  if (selectedPlaylistId) {
    return (
      <PlaylistDetail 
        playlistId={selectedPlaylistId} 
        onBack={() => setSelectedPlaylistId(null)} 
      />
    )
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight m-0">Your Playlists</h1>
          <p className="text-muted mt-2 m-0">Create and manage your music collections.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-5 py-2.5 rounded-full border-0 bg-primary font-bold text-black text-sm cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-glow-sm"
        >
          New Playlist
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <SpinnerIcon className="animate-spin text-primary" width={32} height={32} />
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-20 bg-surface-elevated rounded-2xl border border-[#27272a] border-dashed">
          <PlaylistIcon width={48} height={48} className="text-[#3f3f46] mx-auto mb-4" />
          <p className="text-lg text-white font-medium m-0">No playlists found</p>
          <p className="text-sm text-[#71717a] mt-2 m-0">Click 'New Playlist' to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {playlists.map((playlist, i) => (
            <div
              key={playlist.id}
              onClick={() => setSelectedPlaylistId(playlist.id)}
              className="bg-surface-elevated border border-[#27272a] rounded-xl p-5 cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all duration-200 group active:scale-95"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="size-16 rounded-lg bg-[#111111] flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors shadow-glow-sm">
                <PlaylistIcon width={24} height={24} className="text-muted group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-white font-bold truncate text-lg m-0">{playlist.name}</h3>
              <p className="text-sm text-muted mt-1 truncate m-0">
                {playlist.tracks?.length || 0} track{playlist.tracks?.length !== 1 && "s"}
              </p>
            </div>
          ))}
        </div>
      )}

      {isCreating && <CreatePlaylistModal onClose={() => setIsCreating(false)} />}
    </div>
  )
}
