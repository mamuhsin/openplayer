import { Music2, Plus, Heart, Play, Search } from 'lucide-react'
export default function OnlineSearch({ query, setQuery, results, busy, error, playTrack, toggleLike, likedIds, onAdd, setPage }) {
  const liked=new Set(likedIds)
  return <div className="min-h-full p-4 md:p-6">
    <h1 className="text-2xl font-bold mb-2">{query ? `Results for “${query}”` : 'Find your next favorite'}</h1>
    <p className="text-sm text-[#b3b3b3] mb-5">Search songs, artists, or genres</p>
    <div className="flex flex-wrap gap-2 mb-6">{['Malayalam','Guitar','Acoustic','Pop','Electronic','Chill'].map(q=><button key={q} onClick={()=>setQuery(q)} className="rounded-full px-4 py-2 bg-[#282828] text-sm hover:bg-[#444]">{q}</button>)}</div>
    {busy && <p role="status" className="animate-pulse py-8">Searching music…</p>}
    {error && <p role="alert" className="bg-red-950/50 p-4 rounded mb-4">{error}</p>}
    {!busy && !error && !results.length && <div className="text-center py-16"><Search size={40} className="mx-auto mb-4"/><h2 className="text-xl font-bold">No playable tracks found</h2><p className="text-[#b3b3b3] mt-2">Try another song name or artist. This catalog differs from Spotify.</p></div>}
    <div className="space-y-1">{!busy && results.map((t,i)=><div key={t.id} className="search-track-row flex items-center gap-3 p-2 rounded group hover:bg-white/10">
      <button onClick={()=>playTrack(t)} aria-label={`Play ${t.title}`} className="relative shrink-0 w-12 h-12 rounded overflow-hidden bg-[#282828]">{t.artwork||t.thumbnail?<img src={t.thumbnail||t.artwork} width="48" height="48" loading={i<3?'eager':'lazy'} decoding="async" alt="" onError={e=>{e.currentTarget.style.visibility='hidden'}} className="w-full h-full object-cover"/>:<Music2 className="m-3"/>}<Play className="absolute inset-0 m-auto drop-shadow-lg" size={22} fill="white"/></button>
      <div className="min-w-0 flex-1"><button onClick={()=>playTrack(t)} className="block text-left truncate w-full font-medium">{t.title}</button><button onClick={()=>setPage({type:'artist',track:t})} className="text-sm text-[#b3b3b3] hover:underline truncate max-w-full">{t.artist}</button></div>
      <button onClick={()=>toggleLike(t.id)} aria-label={`Like ${t.title}`} className={liked.has(t.id)?'text-[#1ed760]':'text-[#b3b3b3]'}><Heart size={19} fill={liked.has(t.id)?'currentColor':'none'}/></button>
      <button onClick={()=>onAdd(t)} aria-label={`Add ${t.title} to playlist`} title="Add to playlist" className="p-2 text-[#b3b3b3] hover:text-white"><Plus size={20}/></button>
      <span className="hidden sm:block text-sm text-[#b3b3b3]">{Math.floor(t.duration/60)}:{String(t.duration%60).padStart(2,'0')}</span>
    </div>)}</div>
  </div>
}
