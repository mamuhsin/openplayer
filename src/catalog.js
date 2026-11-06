const ROOT = 'https://api.audius.co/v1'
import { createInvidiousClient } from './invidious.mjs'
export const invidious = import.meta.env.VITE_INVIDIOUS_INSTANCE
  ? createInvidiousClient(import.meta.env.VITE_INVIDIOUS_INSTANCE)
  : null
export function normalizeTrack(t) {
  return { id: `audius-${t.id}`, remoteId: t.id, title: t.title, artist: t.user?.name || 'Unknown artist', album: t.album_backlink?.playlist_name || t.genre || 'Audius', duration: t.duration || 0, artwork: t.artwork?.['480x480'], src: `${ROOT}/tracks/${encodeURIComponent(t.id)}/stream?app_name=OpenPlayer`, color: ['#164e63','#4c1d95'], sourceUrl: `https://audius.co${t.permalink}`, provider: 'Audius' }
}
export async function getMusic(query, signal) {
  if (invidious) return invidious.searchSongs(query || 'latest Malayalam music', { signal })
  const path = query ? `/tracks/search?query=${encodeURIComponent(query)}&limit=40` : '/tracks/trending?limit=24'
  const response = await fetch(`${ROOT}${path}&app_name=OpenPlayer`, { signal: AbortSignal.any([signal, AbortSignal.timeout(18000)]) })
  if (!response.ok) throw new Error('Music service is unavailable. Please try again.')
  const body = await response.json()
  return (body.data || []).filter(t => t.is_streamable && !t.is_stream_gated && t.is_available !== false).map(normalizeTrack)
}
