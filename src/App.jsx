import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMusic, invidious } from './catalog'
import { createInvidiousClient } from './invidious.mjs'
import OnlineSearch from './OnlineSearch'
import UnifiedSearch, { VideoPlayer } from './UnifiedSearch'
import {
  Album, ArrowLeft, ArrowRight, Check, ChevronDown, CirclePlus, Clock3,
  Download, Ellipsis, FolderPlus, Heart, Home, Library, ListMusic, Maximize2,
  Menu, Mic2, MonitorSpeaker, MoreHorizontal, Music2, Pause, Play, Plus,
  Repeat, Repeat1, Search, Shuffle, SkipBack, SkipForward, Speaker,
  Upload, UserRound, Volume1, Volume2, VolumeX, X, Zap,
} from 'lucide-react'

const ACCENT = '#1ed760'

const seedTracks = [
  { id: 'midnight-drive', title: 'Midnight Drive', artist: 'Nova Lane', album: 'Neon Horizons', duration: 28, freq: 220, color: ['#7f1d1d','#ef4444'], glyph: 'N', wave: 'sine' },
  { id: 'paper-moons', title: 'Paper Moons', artist: 'The North Lines', album: 'Afterglow', duration: 31, freq: 246.94, color: ['#164e63','#22d3ee'], glyph: 'P', wave: 'triangle' },
  { id: 'soft-focus', title: 'Soft Focus', artist: 'Mira Vale', album: 'Polaroid Weather', duration: 26, freq: 277.18, color: ['#4c1d95','#c084fc'], glyph: 'S', wave: 'sine' },
  { id: 'golden-hour', title: 'Golden Hour', artist: 'Juniper Club', album: 'Sunroom', duration: 30, freq: 329.63, color: ['#78350f','#fbbf24'], glyph: 'G', wave: 'triangle' },
  { id: 'city-lights', title: 'City Lights', artist: 'Night Arcade', album: 'Static Hearts', duration: 27, freq: 196, color: ['#172554','#3b82f6'], glyph: 'C', wave: 'square' },
  { id: 'slow-bloom', title: 'Slow Bloom', artist: 'Elio Moss', album: 'Greenhouse', duration: 29, freq: 293.66, color: ['#14532d','#4ade80'], glyph: 'B', wave: 'sine' },
  { id: 'velvet-sky', title: 'Velvet Sky', artist: 'Sora June', album: 'Blue Hour', duration: 32, freq: 349.23, color: ['#312e81','#818cf8'], glyph: 'V', wave: 'triangle' },
  { id: 'stay-awake', title: 'Stay Awake', artist: 'Low Atlas', album: 'Open Late', duration: 25, freq: 261.63, color: ['#3f3f46','#f97316'], glyph: 'A', wave: 'square' },
]

const artists = [
  { name: 'Nova Lane', color: ['#3f0d12','#a71d31'], glyph: 'NL' },
  { name: 'Mira Vale', color: ['#1e3a8a','#7c3aed'], glyph: 'MV' },
  { name: 'Night Arcade', color: ['#0c4a6e','#0f172a'], glyph: 'NA' },
  { name: 'Juniper Club', color: ['#365314','#f59e0b'], glyph: 'JC' },
  { name: 'Elio Moss', color: ['#064e3b','#84cc16'], glyph: 'EM' },
  { name: 'Sora June', color: ['#4c1d95','#ec4899'], glyph: 'SJ' },
]

const categories = [
  ['Music','#dc148c'], ['Podcasts','#006450'], ['Live Events','#8400e7'], ['Made For You','#1e3264'],
  ['New Releases','#608108'], ['Pop','#d84000'], ['Indie','#e8115b'], ['Dance/Electronic','#477d95'],
  ['Charts','#8d67ab'], ['Discover','#b02897'], ['Mood','#e13300'], ['Chill','#148a08'],
  ['Workout','#777777'], ['Focus','#a56752'], ['Sleep','#1e3264'], ['At Home','#0d73ec'],
]

function makeWavUrl(freq = 220, duration = 28, wave = 'sine') {
  const sampleRate = 11025
  const length = Math.floor(sampleRate * duration)
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)
  const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); write(8, 'WAVEfmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * 2, true)
  const tone = (phase) => wave === 'square' ? Math.sign(Math.sin(phase)) : wave === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const chord = tone(2 * Math.PI * freq * t) * .48 + tone(2 * Math.PI * freq * 1.5 * t) * .22 + tone(2 * Math.PI * freq * 2 * t) * .1
    const beat = Math.sin(2 * Math.PI * 2 * t) > .88 ? Math.sin(2 * Math.PI * 60 * t) * .18 : 0
    const fade = Math.min(1, t * 2, (duration - t) * 2)
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, (chord + beat) * fade * .45)) * 32767, true)
  }
  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }))
}

const fmt = (seconds = 0) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  return `${m}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

const readStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function Art({ item, className = '', round = false, large = false }) {
  if (item.artwork) return <img src={item.artwork} alt={item.title || item.name || ''} className={`object-cover shadow-xl ${round?'rounded-full':'rounded-[4px]'} ${className}`}/>
  const colors = item.color || ['#334155','#9333ea']
  return (
    <div className={`relative overflow-hidden shadow-xl ${round ? 'rounded-full' : 'rounded-[4px]'} ${className}`}
      style={{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})` }}>
      <div className="absolute -right-[18%] -bottom-[28%] h-[80%] w-[80%] rotate-12 rounded-[18%] border border-white/20 bg-white/10" />
      <div className="absolute left-[12%] top-[12%] h-[28%] w-[28%] rounded-full bg-white/10 blur-xl" />
      <span className={`absolute inset-0 grid place-items-center font-black tracking-[-.08em] text-white/90 ${large ? 'text-7xl' : 'text-4xl'}`}>{item.glyph || item.title?.slice(0,1)}</span>
      {!round && <span className="absolute bottom-3 left-3 right-3 text-[10px] font-bold uppercase tracking-[.16em] text-white/70">{item.album || item.title}</span>}
    </div>
  )
}

function IconButton({ label, children, active, onClick, disabled = false, className = '' }) {
  return <button aria-label={label} title={label} disabled={disabled} onClick={onClick}
    className={`tooltip grid place-items-center rounded-full transition hover:scale-105 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'text-[#1ed760]' : 'text-[#b3b3b3]'} ${className}`}
    data-tip={label}>{children}</button>
}

function TopBar({ page, setPage, query, setQuery }) {
  const [profileOpen, setProfileOpen] = useState(false)
  return (
    <header className="h-16 shrink-0 bg-black px-2 md:px-4 flex items-center gap-2 md:gap-3 relative z-40">
      <button onClick={() => setPage({ type:'home' })} aria-label="Spotify home" className="mx-2 hidden h-10 w-10 place-items-center rounded-full bg-white text-black md:grid"><Music2 className="h-6 w-6" /></button>
      <IconButton label="Back" onClick={() => history.back()} className="hidden h-10 w-10 bg-[#1f1f1f] md:grid"><ArrowLeft size={22}/></IconButton>
      <button onClick={() => setPage({ type:'home' })} aria-label="Home" className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition ${page.type === 'home' ? 'bg-[#2a2a2a] text-white' : 'bg-[#1f1f1f] text-[#b3b3b3] hover:text-white'}`}><Home size={25} fill={page.type === 'home' ? 'currentColor' : 'none'}/></button>
      <div className="relative flex h-12 min-w-0 max-w-[475px] flex-1 items-center rounded-full bg-[#242424] ring-2 ring-transparent transition focus-within:bg-[#2a2a2a] focus-within:ring-white hover:bg-[#2a2a2a]">
        <Search className="ml-3 shrink-0 text-[#b3b3b3]" size={25}/>
        <input value={query} onChange={e => { setQuery(e.target.value); setPage({ type:'search' }) }} onFocus={() => setPage({ type:'search' })}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none placeholder:text-[#b3b3b3]" placeholder="What do you want to play?" aria-label="Search" />
        {query && <button onClick={() => setQuery('')} className="mr-2 text-[#b3b3b3] hover:text-white" aria-label="Clear search"><X size={20}/></button>}
        <span className="mr-3 hidden border-l border-[#777] pl-3 text-[#b3b3b3] sm:block"><Album size={22}/></span>
      </div>
      <nav className="ml-auto hidden items-center gap-4 text-sm font-bold text-[#b3b3b3] xl:flex">
        <button className="hover:scale-105 hover:text-white">Explore</button>
        <button className="hover:scale-105 hover:text-white">Support</button>
        <span className="h-6 border-l border-white"/>
        <button className="flex items-center gap-2 hover:scale-105 hover:text-white"><Download size={17}/> Install App</button>
      </nav>
      <button onClick={() => setProfileOpen(v => !v)} className="relative ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2a2a2a] ring-4 ring-black" aria-label="Profile">
        <UserRound size={19}/>
        {profileOpen && <div className="absolute right-0 top-12 w-52 rounded bg-[#282828] p-1 text-left text-sm shadow-2xl">
          {['Account','Profile','Settings'].map(x => <div key={x} className="rounded px-3 py-3 hover:bg-white/10">{x}</div>)}
          <div className="border-t border-white/10 px-3 py-3 text-[#b3b3b3]">Local demo · no login</div>
        </div>}
      </button>
    </header>
  )
}

function Sidebar({ page, setPage, playlists, setCreateOpen, onUpload }) {
  const [filter, setFilter] = useState('')
  const items = [{ id:'liked', name:'Liked Songs', meta:'Playlist', special:true }, ...playlists]
  return (
    <aside className="hidden min-h-0 w-[330px] shrink-0 flex-col rounded-lg bg-[#121212] md:flex">
      <div className="flex h-16 items-center gap-3 px-5 font-bold text-[#b3b3b3]"><Library size={24}/><span>Your Library</span>
        <IconButton label="Create playlist" onClick={() => setCreateOpen(true)} className="ml-auto h-9 w-9 hover:bg-[#2a2a2a]"><Plus size={22}/></IconButton>
      </div>
      <div className="flex gap-2 px-4 pb-3"><button className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm font-semibold hover:bg-[#333]">Playlists</button><button onClick={onUpload} className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm font-semibold hover:bg-[#333]">Local audio</button></div>
      <div className="flex items-center gap-2 px-4 pb-2"><Search size={19} className="text-[#b3b3b3]"/><input value={filter} onChange={e=>setFilter(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#777]" placeholder="Search your library"/></div>
      <div className="spotify-scroll min-h-0 flex-1 overflow-y-auto px-2">
        {items.filter(x => x.name.toLowerCase().includes(filter.toLowerCase())).map(item => (
          <button key={item.id} onClick={() => setPage({ type:item.special ? 'liked' : 'playlist', id:item.id })}
            className={`flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-[#1f1f1f] ${page.id === item.id || (item.special && page.type === 'liked') ? 'bg-[#232323]' : ''}`}>
            {item.special ? <div className="grid h-12 w-12 place-items-center rounded bg-gradient-to-br from-[#450af5] to-[#c4efd9]"><Heart size={21} fill="white"/></div> : <Art item={{title:item.name,glyph:item.name[0],color:item.color || ['#334155','#111827']}} className="h-12 w-12 shrink-0"/>}
            <div className="min-w-0"><div className={`truncate text-sm font-medium ${item.special && page.type === 'liked' ? 'text-[#1ed760]' : ''}`}>{item.name}</div><div className="mt-1 text-xs text-[#b3b3b3]">Playlist · You</div></div>
          </button>
        ))}
        {!playlists.length && <div className="mx-2 mt-4 rounded-lg bg-[#242424] p-4"><strong className="text-sm">Create your first playlist</strong><p className="my-2 text-xs">It's easy, we'll help you</p><button onClick={()=>setCreateOpen(true)} className="mt-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-black hover:scale-105">Create playlist</button></div>}
      </div>
      <div className="p-5 text-[11px] leading-7 text-[#b3b3b3]">Legal &nbsp; Safety & Privacy Center<br/>Privacy Policy &nbsp; Cookies<br/>Accessibility<br/><button className="mt-2 rounded-full border border-[#777] px-3 py-1 text-xs font-bold text-white">◎ English</button></div>
    </aside>
  )
}

function PlayDot({ playing, onClick, label='Play' }) {
  return <button onClick={e => { e.stopPropagation(); onClick() }} aria-label={label} className="card-play absolute bottom-2 right-2 grid h-12 w-12 place-items-center rounded-full bg-[#1ed760] text-black shadow-xl hover:scale-105 hover:bg-[#3be477]">{playing ? <Pause size={22} fill="black"/> : <Play size={22} fill="black" className="ml-1"/>}</button>
}

function MediaCard({ item, onOpen, onPlay, playing, round=false }) {
  return (
    <article onClick={onOpen} tabIndex={0} className="media-card group min-w-[150px] cursor-pointer rounded-md p-2 transition hover:bg-[#1f1f1f] focus:bg-[#1f1f1f] md:min-w-0">
      <div className="relative"><Art item={item} round={round} className="aspect-square w-full"/><PlayDot playing={playing} onClick={onPlay} label={`${playing?'Pause':'Play'} ${item.title || item.name}`}/></div>
      <div className="mt-2 truncate text-sm font-semibold">{item.title || item.name}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#b3b3b3]">{item.artist || 'Artist'}</div>
    </article>
  )
}

function Section({ title, children, onShowAll }) {
  return <section className="mb-8"><div className="mb-2 flex items-end justify-between px-3 md:px-6"><h2 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h2>{onShowAll && <button onClick={onShowAll} className="text-xs font-bold text-[#b3b3b3] hover:underline">Show all</button>}</div>{children}</section>
}

function HomePage({ tracks, current, isPlaying, playTrack, setPage }) {
  return <div className="page-fade bg-gradient-to-b from-[#242424] via-[#121212] to-[#121212] pb-24 pt-6 md:pt-7">
    <h1 className="sr-only">Home</h1>
    <Section title="Trending songs" onShowAll={() => setPage({ type:'playlist', id:'top-hits' })}>
      <div className="spotify-scroll grid auto-cols-[170px] grid-flow-col overflow-x-auto px-2 pb-2 md:grid-flow-row md:grid-cols-[repeat(auto-fit,minmax(145px,1fr))] md:overflow-visible md:px-4">
        {tracks.slice(0,6).map(t => <MediaCard key={t.id} item={t} onOpen={() => setPage({type:'album',id:t.album})} onPlay={() => playTrack(t)} playing={current?.id===t.id && isPlaying}/>) }
      </div>
    </Section>
    <Section title="Popular artists" onShowAll={() => setPage({ type:'search' })}>
      <div className="spotify-scroll grid auto-cols-[170px] grid-flow-col overflow-x-auto px-2 pb-2 md:grid-flow-row md:grid-cols-[repeat(auto-fit,minmax(145px,1fr))] md:overflow-visible md:px-4">
        {[...new Map(tracks.map(t=>[t.artist,{name:t.artist,artwork:t.artwork,color:t.color}])).values()].slice(0,6).map(a => <MediaCard key={a.name} item={a} round onOpen={() => setPage({type:'artist',id:a.name})} onPlay={() => playTrack(tracks.find(t=>t.artist===a.name))} playing={current?.artist===a.name && isPlaying}/>) }
      </div>
    </Section>
    <Section title="Popular albums and singles">
      <div className="spotify-scroll grid auto-cols-[170px] grid-flow-col overflow-x-auto px-2 pb-2 md:grid-flow-row md:grid-cols-[repeat(auto-fit,minmax(145px,1fr))] md:overflow-visible md:px-4">
        {[...tracks].reverse().slice(0,6).map(t => <MediaCard key={t.id} item={t} onOpen={() => setPage({type:'album',id:t.album})} onPlay={() => playTrack(t)} playing={current?.id===t.id && isPlaying}/>) }
      </div>
    </Section>
  </div>
}

function SearchPage({ query, tracks, playTrack, current, isPlaying, setPage, onAdd }) {
  const q = query.trim().toLowerCase()
  const results = tracks.filter(t => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q))
  return <div className="page-fade min-h-full bg-[#121212] p-4 pb-28 md:p-6">
    {!q ? <><h1 className="mb-5 text-2xl font-bold">Browse all</h1><div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map(([name,color],i)=><button key={name} onClick={()=>{}} className="relative h-32 overflow-hidden rounded-lg p-4 text-left text-xl font-bold md:h-40 md:text-2xl" style={{background:color}}><span>{name}</span><div className="absolute -bottom-5 -right-4 h-24 w-24 rotate-[25deg] rounded-md bg-black/20 shadow-xl"><div className="grid h-full place-items-center text-4xl">{['♫','◉','✦','♪'][i%4]}</div></div></button>)}
    </div></> : <><h1 className="mb-5 text-2xl font-bold">Search results for “{query}”</h1>
      {results.length ? <><div className="mb-8 grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]"><div><h2 className="mb-3 text-xl font-bold">Top result</h2><div role="button" tabIndex={0} onClick={()=>setPage({type:'artist',id:results[0].artist})} onKeyDown={e=>e.key==='Enter'&&setPage({type:'artist',id:results[0].artist})} className="relative w-full rounded-lg bg-[#181818] p-5 text-left transition hover:bg-[#282828]"><Art item={results[0]} className="h-24 w-24"/><div className="mt-4 text-3xl font-bold">{results[0].artist}</div><div className="mt-2 text-sm text-[#b3b3b3]">Artist</div><PlayDot playing={current?.id===results[0].id&&isPlaying} onClick={()=>playTrack(results[0])}/></div></div>
      <div><h2 className="mb-3 text-xl font-bold">Songs</h2>{results.slice(0,5).map((t,i)=><TrackRow key={t.id} track={t} index={i} playTrack={playTrack} current={current} isPlaying={isPlaying} onAdd={onAdd}/>)}</div></div></> : <div className="grid min-h-[45vh] place-items-center text-center"><div><Search className="mx-auto mb-4" size={44}/><h2 className="text-2xl font-bold">No results found for “{query}”</h2><p className="mt-2 text-[#b3b3b3]">Check the spelling or try a different search.</p></div></div>}
    </>}
  </div>
}

function TrackRow({ track, index, playTrack, current, isPlaying, liked, toggleLike, compact=false, onAdd }) {
  const active = current?.id === track.id
  return <div className={`group grid h-14 items-center gap-3 rounded px-2 text-sm hover:bg-white/10 ${compact ? 'grid-cols-[24px_1fr_48px]' : 'grid-cols-[24px_minmax(160px,2fr)_minmax(100px,1fr)_44px_50px]'}`}>
    <button onClick={()=>playTrack(track)} aria-label={`${active&&isPlaying?'Pause':'Play'} ${track.title}`} className={`text-center ${active?'text-[#1ed760]':'text-[#b3b3b3]'}`}><span className="group-hover:hidden">{active&&isPlaying?<span className="inline-flex h-4 items-end gap-[2px]"><i className="eq-bar h-3 w-[2px] bg-[#1ed760]"/><i className="eq-bar h-4 w-[2px] bg-[#1ed760]"/><i className="eq-bar h-2 w-[2px] bg-[#1ed760]"/></span>:index+1}</span><span className="hidden group-hover:inline">{active&&isPlaying?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}</span></button>
    <div className="flex min-w-0 items-center gap-3"><Art item={track} className="h-10 w-10 shrink-0"/><div className="min-w-0"><div className={`truncate font-medium ${active?'text-[#1ed760]':''}`}>{track.title}</div><div className="truncate text-xs text-[#b3b3b3]">{track.artist}</div></div></div>
    {!compact && <div className="truncate text-[#b3b3b3]">{track.album}</div>}
    {!compact && <button onClick={()=>toggleLike?.(track.id)} className={`opacity-0 transition group-hover:opacity-100 ${liked?'!opacity-100 text-[#1ed760]':''}`} aria-label={liked?'Remove from Liked Songs':'Save to Liked Songs'}><Heart size={17} fill={liked?'currentColor':'none'}/></button>}
    <div className="flex items-center justify-end gap-2 text-[#b3b3b3]"><span>{fmt(track.duration)}</span>{onAdd&&<button onClick={()=>onAdd(track)} className="opacity-0 group-hover:opacity-100" title="Add to playlist"><Plus size={16}/></button>}</div>
  </div>
}

function CollectionPage({ kind='playlist', title, description, tracks, playTrack, current, isPlaying, likedIds, toggleLike, setPage }) {
  const first = tracks[0] || seedTracks[0]
  const isLiked = kind === 'liked'
  const hero = isLiked ? ['#450af5','#8c8ce5'] : first.color
  return <div className="page-fade min-h-full bg-[#121212] pb-28">
    <section className="flex min-h-[276px] flex-col justify-end gap-5 p-6 md:flex-row md:items-end md:justify-start" style={{background:`linear-gradient(180deg, ${hero[1]}, ${hero[0]})`}}>
      {isLiked ? <div className="grid h-40 w-40 shrink-0 place-items-center bg-gradient-to-br from-[#450af5] to-[#c4efd9] shadow-2xl md:h-56 md:w-56"><Heart size={70} fill="white"/></div> : <Art item={{...first,title,glyph:title[0],color:hero}} large className="h-40 w-40 shrink-0 md:h-56 md:w-56"/>}
      <div className="min-w-0"><div className="mb-2 text-xs font-semibold">{isLiked?'Playlist':'Public Playlist'}</div><h1 className="truncate text-4xl font-black tracking-[-.05em] sm:text-6xl xl:text-8xl">{title}</h1><p className="mt-4 text-sm text-white/80">{description}</p><div className="mt-2 text-sm"><b>Spotify Clone</b> · {tracks.length} {tracks.length===1?'song':'songs'}, about {tracks.length?Math.max(1,Math.round(tracks.reduce((a,t)=>a+t.duration,0)/60)):0} min</div></div>
    </section>
    <div className="bg-gradient-to-b from-black/50 to-transparent p-4 md:p-6"><div className="mb-5 flex items-center gap-5"><button onClick={()=>tracks[0]&&playTrack(tracks[0])} className="grid h-14 w-14 place-items-center rounded-full bg-[#1ed760] text-black hover:scale-105">{current&&tracks.some(t=>t.id===current.id)&&isPlaying?<Pause size={27} fill="black"/>:<Play size={27} fill="black" className="ml-1"/>}</button><IconButton label="Shuffle"><Shuffle size={30}/></IconButton><IconButton label="Save playlist"><CirclePlus size={30}/></IconButton><IconButton label="More options"><MoreHorizontal size={28}/></IconButton></div>
      <div className="mb-2 hidden grid-cols-[24px_minmax(160px,2fr)_minmax(100px,1fr)_44px_50px] gap-3 border-b border-white/10 px-2 pb-2 text-sm text-[#b3b3b3] md:grid"><span>#</span><span>Title</span><span>Album</span><span/><Clock3 size={16}/></div>
      {tracks.length ? tracks.map((t,i)=><TrackRow key={t.id} track={t} index={i} playTrack={playTrack} current={current} isPlaying={isPlaying} liked={likedIds.includes(t.id)} toggleLike={toggleLike} compact={false}/>) : <div className="py-20 text-center"><Music2 className="mx-auto mb-4" size={48}/><h2 className="text-2xl font-bold">This playlist is empty</h2><button onClick={()=>setPage({type:'search'})} className="mt-5 rounded-full bg-white px-5 py-3 font-bold text-black">Find something to add</button></div>}
    </div>
  </div>
}

function ArtistPage({ name, tracks, current, isPlaying, playTrack, setPage }) {
  const list = tracks.filter(t=>t.artist===name)
  const artist = {name,color:list[0]?.color||['#164e63','#4c1d95'],artwork:list[0]?.artwork}
  const [followed,setFollowed]=useState(false)
  return <div className="page-fade min-h-full bg-[#121212] pb-28">
    <section className="relative flex h-[340px] items-end overflow-hidden p-6" style={{background:`linear-gradient(100deg,${artist.color[0]},${artist.color[1]})`}}>
      <div className="absolute -right-20 -top-36 h-[520px] w-[520px] rounded-full bg-white/10 blur-2xl"/>
      <Art item={artist} round className="mr-6 hidden h-56 w-56 shrink-0 md:block"/>
      <div className="relative"><div className="mb-2 text-sm font-semibold">Artist on Audius</div><h1 className="text-6xl font-black tracking-[-.06em] md:text-8xl">{name}</h1><p className="mt-4 text-sm">{list.length} tracks in your current catalog</p></div>
    </section>
    <div className="bg-gradient-to-b from-[#202020] to-[#121212] p-5 md:p-6"><div className="mb-7 flex items-center gap-5"><button onClick={()=>playTrack(list[0])} className="grid h-14 w-14 place-items-center rounded-full bg-[#1ed760] text-black hover:scale-105">{current?.artist===name&&isPlaying?<Pause size={27} fill="black"/>:<Play size={27} fill="black"/>}</button><IconButton label="Shuffle"><Shuffle size={30}/></IconButton><button onClick={()=>setFollowed(v=>!v)} className="rounded-full border border-[#777] px-4 py-1.5 text-sm font-bold hover:border-white">{followed?'Following':'Follow'}</button><IconButton label="More options"><Ellipsis size={28}/></IconButton></div>
      <h2 className="mb-3 text-2xl font-bold">Popular</h2>{list.map((t,i)=><TrackRow key={t.id} track={t} index={i} playTrack={playTrack} current={current} isPlaying={isPlaying} compact/>) }
      <Section title="Discography"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{list.slice(0,5).map(t=><MediaCard key={t.id} item={t} onOpen={()=>setPage({type:'album',id:t.album})} onPlay={()=>playTrack(t)} playing={current?.id===t.id&&isPlaying}/>)}</div></Section>
    </div>
  </div>
}

function Player({ current, isPlaying, toggle, next, previous, shuffle, setShuffle, repeat, setRepeat, volume, setVolume, progress, duration, seek, liked, toggleLike, setQueueOpen }) {
  const [muted,setMuted]=useState(false)
  const [expanded,setExpanded]=useState(false)
  const volumeBeforeMute=useRef(volume)
  const mute=()=>{if(muted){setVolume(volumeBeforeMute.current||.72);setMuted(false)}else{volumeBeforeMute.current=volume;setVolume(0);setMuted(true)}}
  if (!current) return null
  return <>
    <div className="fixed bottom-[64px] left-2 right-2 z-50 flex h-14 items-center rounded-md bg-[#3b3b3b] px-2 shadow-xl md:hidden">
      <Art item={current} className="h-11 w-11 shrink-0"/><button onClick={()=>setExpanded(true)} aria-label="Open player" className="min-w-0 flex-1 px-2 text-left"><div className="truncate text-sm font-semibold">{current.title}</div><div className="truncate text-xs text-[#ddd]">{current.artist}</div></button><button onClick={()=>toggleLike(current.id)} className={liked?'text-[#1ed760]':''}><Heart size={21} fill={liked?'currentColor':'none'}/></button><button onClick={toggle} className="ml-4">{isPlaying?<Pause size={25} fill="white"/>:<Play size={25} fill="white"/>}</button><div className="absolute bottom-0 left-0 h-[2px] rounded bg-white" style={{width:`${duration?progress/duration*100:0}%`}}/>
    </div>
    <footer className={`fixed bottom-0 left-0 right-0 z-[60] grid-cols-[minmax(180px,1fr)_minmax(300px,2fr)_minmax(180px,1fr)] items-center bg-black px-4 md:grid md:h-[92px] ${expanded?'flex h-full flex-col justify-center gap-12':'hidden h-[92px]'}`}>
      {expanded&&<button onClick={()=>setExpanded(false)} aria-label="Close player" className="absolute top-6 right-6 md:hidden"><ChevronDown size={30}/></button>}
      <div className="flex min-w-0 items-center gap-3"><Art item={current} className="h-14 w-14 shrink-0"/><div className="min-w-0"><div className="truncate text-sm font-medium hover:underline">{current.title}</div><div className="truncate text-xs text-[#b3b3b3] hover:underline">{current.artist}</div></div><IconButton label={liked?'Remove from Liked Songs':'Save to Liked Songs'} active={liked} onClick={()=>toggleLike(current.id)} className="ml-2 h-8 w-8"><Heart size={17} fill={liked?'currentColor':'none'}/></IconButton></div>
      <div className="flex flex-col items-center"><div className="flex h-9 items-center gap-4"><IconButton label={shuffle?'Disable shuffle':'Enable shuffle'} active={shuffle} onClick={()=>setShuffle(v=>!v)}><Shuffle size={18}/></IconButton><IconButton label="Previous" onClick={previous}><SkipBack size={20} fill="currentColor"/></IconButton><button onClick={toggle} aria-label={isPlaying?'Pause':'Play'} className="grid h-8 w-8 place-items-center rounded-full bg-white text-black transition hover:scale-105">{isPlaying?<Pause size={18} fill="black"/>:<Play size={18} fill="black" className="ml-[2px]"/>}</button><IconButton label="Next" onClick={next}><SkipForward size={20} fill="currentColor"/></IconButton><IconButton label={repeat===0?'Enable repeat':repeat===1?'Enable repeat one':'Disable repeat'} active={repeat>0} onClick={()=>setRepeat((repeat+1)%3)}>{repeat===2?<Repeat1 size={18}/>:<Repeat size={18}/>}</IconButton></div>
        <div className="flex w-full max-w-[630px] items-center gap-2 text-[11px] text-[#b3b3b3]"><span className="w-10 text-right">{fmt(progress)}</span><input aria-label="Seek" className="range w-full" style={{'--value':`${duration?progress/duration*100:0}%`}} type="range" min="0" max={duration||1} step="0.1" value={Math.min(progress,duration||0)} onChange={e=>seek(Number(e.target.value))}/><span className="w-10">{fmt(duration)}</span></div>
      </div>
      <div className="flex justify-end gap-3"><IconButton label="Queue" onClick={()=>{setExpanded(false);setQueueOpen(v=>!v)}}><ListMusic size={18}/></IconButton><IconButton label={muted?'Unmute':'Mute'} onClick={mute}>{muted||volume===0?<VolumeX size={18}/>:volume<.5?<Volume1 size={18}/>:<Volume2 size={18}/>}</IconButton><input aria-label="Volume" className="range w-24" style={{'--value':`${muted?0:volume*100}%`}} type="range" min="0" max="1" step="0.01" value={muted?0:volume} onChange={e=>{setMuted(false);setVolume(Number(e.target.value))}}/>{current.sourceUrl&&<a href={current.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-[#b3b3b3] hover:text-white">Audius ↗</a>}</div>
    </footer>
  </>
}

function MobileNav({ page, setPage }) {
  return <nav className="fixed bottom-0 left-0 right-0 z-50 grid h-16 grid-cols-3 bg-gradient-to-t from-black via-black to-black/90 md:hidden">
    {[['home','Home',Home],['search','Search',Search],['library','Your Library',Library]].map(([id,label,Icon])=><button key={id} onClick={()=>setPage({type:id})} className={`flex flex-col items-center justify-center gap-1 text-[10px] ${page.type===id?'text-white':'text-[#b3b3b3]'}`}><Icon size={23} fill={page.type===id&&id==='home'?'currentColor':'none'}/><span>{label}</span></button>)}
  </nav>
}

function LibraryPage({ playlists, setPage, setCreateOpen, likedCount, onUpload }) {
  return <div className="min-h-full bg-[#121212] p-4 pb-32 md:hidden"><div className="mb-5 flex items-center"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#a855f7] font-bold">Y</div><h1 className="ml-3 text-2xl font-bold">Your Library</h1><button onClick={()=>setCreateOpen(true)} className="ml-auto"><Plus size={28}/></button></div><div className="mb-5 flex gap-2"><button className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm">Playlists</button><button onClick={onUpload} className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm">Local audio</button></div><button onClick={()=>setPage({type:'liked'})} className="mb-3 flex w-full items-center gap-3"><div className="grid h-16 w-16 place-items-center rounded bg-gradient-to-br from-[#450af5] to-[#c4efd9]"><Heart fill="white"/></div><div className="text-left"><div className="font-semibold">Liked Songs</div><div className="text-sm text-[#b3b3b3]">Playlist · {likedCount} songs</div></div></button>{playlists.map(p=><button key={p.id} onClick={()=>setPage({type:'playlist',id:p.id})} className="mb-3 flex w-full items-center gap-3"><Art item={{title:p.name,glyph:p.name[0],color:p.color||['#334155','#111827']}} className="h-16 w-16"/><div className="text-left"><div className="font-semibold">{p.name}</div><div className="text-sm text-[#b3b3b3]">Playlist · You</div></div></button>)}</div>
}

function QueuePanel({ tracks, current, playTrack, onClose }) {
  return <aside className="fixed bottom-[92px] right-2 top-16 z-50 w-[340px] rounded-lg bg-[#121212] p-4 shadow-2xl ring-1 ring-white/10"><div className="mb-5 flex items-center"><h2 className="text-xl font-bold">Queue</h2><button onClick={onClose} className="ml-auto rounded-full p-2 hover:bg-white/10"><X size={20}/></button></div><h3 className="mb-3 text-sm font-bold text-[#b3b3b3]">Now playing</h3>{current&&<button className="mb-6 flex w-full items-center gap-3 rounded p-2 text-left hover:bg-white/10"><Art item={current} className="h-12 w-12"/><div><div className="text-sm text-[#1ed760]">{current.title}</div><div className="text-xs text-[#b3b3b3]">{current.artist}</div></div></button>}<h3 className="mb-3 text-sm font-bold">Next in queue</h3>{tracks.filter(t=>t.id!==current?.id).map(t=><button key={t.id} onClick={()=>playTrack(t)} className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-white/10"><Art item={t} className="h-10 w-10"/><div className="min-w-0"><div className="truncate text-sm">{t.title}</div><div className="truncate text-xs text-[#b3b3b3]">{t.artist}</div></div></button>)}</aside>
}

function CreateModal({ onClose, onCreate }) {
  const [name,setName]=useState('My Playlist')
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onMouseDown={onClose}><form onSubmit={e=>{e.preventDefault();onCreate(name)}} onMouseDown={e=>e.stopPropagation()} className="w-full max-w-md rounded-lg bg-[#282828] p-6 shadow-2xl"><div className="flex items-center"><h2 className="text-2xl font-bold">Create playlist</h2><button type="button" onClick={onClose} className="ml-auto"><X/></button></div><label className="mt-5 block text-xs font-bold">Name</label><input autoFocus value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded bg-[#3e3e3e] px-3 py-3 outline-none ring-white focus:ring-1" maxLength={60}/><p className="mt-4 text-xs text-[#b3b3b3]">Your playlist is stored only in this browser.</p><button disabled={!name.trim()} className="mt-6 float-right rounded-full bg-[#1ed760] px-6 py-3 font-bold text-black disabled:opacity-50">Create</button><div className="clear-both"/></form></div>
}

export default function App() {
  const [page,setPageState]=useState({type:'home'})
  const [query,setQuery]=useState('')
  const [video,setVideo]=useState(null)
  const [likedIds,setLikedIds]=useState(()=>readStored('spotify-clone-liked',[]))
  const [playlists,setPlaylists]=useState(()=>readStored('spotify-clone-playlists',[]))
  const [uploaded,setUploaded]=useState([])
  const [createOpen,setCreateOpen]=useState(false)
  const [queueOpen,setQueueOpen]=useState(false)
  const [current,setCurrent]=useState(null)
  const [isPlaying,setIsPlaying]=useState(false)
  const [shuffle,setShuffle]=useState(false)
  const [repeat,setRepeat]=useState(0)
  const [volume,setVolume]=useState(()=>Number(localStorage.getItem('spotify-clone-volume') ?? .72))
  const [progress,setProgress]=useState(0)
  const [duration,setDuration]=useState(0)
  const audioRef=useRef(new Audio())
  const selectionRef=useRef(0)
  const playbackRequest=useRef(null)
  const fileRef=useRef(null)
  const [catalog,setCatalog]=useState(()=>readStored('openplayer-catalog',[]))
  const [results,setResults]=useState([])
  const [busy,setBusy]=useState(true)
  const [musicError,setMusicError]=useState('')
  const [playError,setPlayError]=useState('')
  const tracks=useMemo(()=>[...catalog,...uploaded],[catalog,uploaded])
  useEffect(()=>{
    const controller=new AbortController()
    setBusy(true);setMusicError('')
    const timer=setTimeout(()=>getMusic(query.trim(),controller.signal).then(list=>{
      setResults(list);setCatalog(old=>[...new Map([...old,...list].map(t=>[t.id,t])).values()].slice(-300))
    }).catch(e=>{if(e.name!=='AbortError'){setResults([]);setMusicError(e.message)}}).finally(()=>{if(!controller.signal.aborted)setBusy(false)}),350)
    return()=>{clearTimeout(timer);controller.abort()}
  },[query])
  useEffect(()=>localStorage.setItem('openplayer-catalog',JSON.stringify(catalog)),[catalog])

  const setPage = useCallback((p)=>{ setPageState(p); setQueueOpen(false) },[])
  useEffect(()=>localStorage.setItem('spotify-clone-liked',JSON.stringify(likedIds)),[likedIds])
  useEffect(()=>{ if(!current&&tracks[0]){ setCurrent(tracks[0]); setDuration(tracks[0].duration) } },[tracks,current])
  useEffect(()=>localStorage.setItem('spotify-clone-playlists',JSON.stringify(playlists)),[playlists])
  useEffect(()=>{ localStorage.setItem('spotify-clone-volume',String(volume)); audioRef.current.volume=volume },[volume])

  const next = useCallback(()=>{
    if(!tracks.length) return
    const idx=tracks.findIndex(t=>t.id===current?.id)
    const target=shuffle?tracks[Math.floor(Math.random()*tracks.length)]:tracks[(idx+1+tracks.length)%tracks.length]
    playTrack(target,true)
  },[tracks,current,shuffle])
  useEffect(()=>{
    const a=audioRef.current
    const time=()=>{setProgress(a.currentTime||0);setDuration(a.duration||current?.duration||0)}
    const ended=()=>{ if(repeat===2){a.currentTime=0;a.play()} else if(repeat===1||tracks.length>1) next(); else setIsPlaying(false) }
    const played=()=>{setIsPlaying(true);setPlayError('')};const paused=()=>setIsPlaying(false);const failed=()=>{setIsPlaying(false);setPlayError('This track could not be played. Try another track or retry.')}
    a.addEventListener('timeupdate',time);a.addEventListener('loadedmetadata',time);a.addEventListener('ended',ended);a.addEventListener('play',played);a.addEventListener('pause',paused);a.addEventListener('error',failed)
    return()=>{a.removeEventListener('timeupdate',time);a.removeEventListener('loadedmetadata',time);a.removeEventListener('ended',ended);a.removeEventListener('play',played);a.removeEventListener('pause',paused);a.removeEventListener('error',failed)}
  },[current,repeat,next,tracks.length])

  async function playTrack(track, force=false){
    if(!track) return
    const a=audioRef.current
    playbackRequest.current?.abort()
    const request=new AbortController();playbackRequest.current=request
    setPlayError('')
    if(track.provider==='Invidious') {
      const selection=++selectionRef.current
      const resumeAt=current?.id===track.id&&!force?a.currentTime:0
      setCurrent(track);setDuration(track.duration||0);setProgress(resumeAt)
      const client=invidious||createInvidiousClient(track.instanceUrl)
      if(current?.id===track.id&&!force&&a.getAttribute('src')&&!a.paused){client.cancelPlayback(a);return}
      try { await client.playVideo(track.videoId,a,{volume,signal:request.signal,startTime:resumeAt}) }
      catch(e){if(e.name!=='AbortError'&&selectionRef.current===selection)setPlayError(e.message)}
      return
    }
    ++selectionRef.current
    if(current?.id===track.id&&!force&&a.getAttribute('src')){ if(a.paused)a.play().catch(()=>setPlayError('Playback failed. Please try again.')); else a.pause(); return }
    setCurrent(track);a.src=track.src;a.currentTime=0;a.volume=volume;a.play().catch(e=>{if(e.name!=='AbortError')setPlayError('This track is unavailable. Try another song.')});setDuration(track.duration||0)
  }
  const toggle=()=>current?playTrack(current):playTrack(tracks[0])
  const previous=()=>{ const a=audioRef.current;if(a.currentTime>3){a.currentTime=0;return}const i=tracks.findIndex(t=>t.id===current?.id);playTrack(tracks[(i-1+tracks.length)%tracks.length],true) }
  const seek=(v)=>{audioRef.current.currentTime=v;setProgress(v)}
  const toggleLike=(id)=>setLikedIds(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])
  const createPlaylist=(name)=>{ const p={id:`playlist-${Date.now()}`,name:name.trim(),trackIds:[],color:['#5b21b6','#0f172a']};setPlaylists(v=>[...v,p]);setCreateOpen(false);setPage({type:'playlist',id:p.id}) }
  const addToPlaylist=(track)=>{ let target=playlists.at(-1); if(!target){target={id:`playlist-${Date.now()}`,name:'My Playlist',trackIds:[],color:['#5b21b6','#0f172a']};setPlaylists([target])} setPlaylists(v=>v.map(p=>p.id===target.id?{...p,trackIds:[...new Set([...(p.trackIds||[]),track.id])]}:p));setPage({type:'playlist',id:target.id}) }
  const handleUpload=e=>{ const file=e.target.files?.[0];if(!file)return;const src=URL.createObjectURL(file);const t={id:`upload-${Date.now()}`,title:file.name.replace(/\.[^.]+$/,''),artist:'Local file',album:'Uploads',duration:0,color:['#0f766e','#22c55e'],glyph:'♪',src,uploaded:true};setUploaded(v=>[...v,t]);playTrack(t);e.target.value='' }

  let content
  if(page.type==='search') content=<UnifiedSearch query={query} setQuery={setQuery} results={results} busy={busy} error={musicError} playTrack={playTrack} toggleLike={toggleLike} likedIds={likedIds} setPage={setPage} onAdd={addToPlaylist} onVideo={v=>{audioRef.current.pause();setVideo(v)}}/>
  else if(page.type==='artist') content=<ArtistPage name={page.id} tracks={tracks} current={current} isPlaying={isPlaying} playTrack={playTrack} setPage={setPage}/>
  else if(page.type==='album'){ const list=tracks.filter(t=>t.album===page.id);content=<CollectionPage kind="album" title={page.id||'Album'} description={`A release by ${list[0]?.artist||'Spotify Clone'}`} tracks={list.length?list:tracks.slice(0,4)} playTrack={playTrack} current={current} isPlaying={isPlaying} likedIds={likedIds} toggleLike={toggleLike} setPage={setPage}/> }
  else if(page.type==='liked'){ const list=tracks.filter(t=>likedIds.includes(t.id));content=<CollectionPage kind="liked" title="Liked Songs" description="Your favorite tracks in one place." tracks={list} playTrack={playTrack} current={current} isPlaying={isPlaying} likedIds={likedIds} toggleLike={toggleLike} setPage={setPage}/> }
  else if(page.type==='playlist'){ const p=playlists.find(x=>x.id===page.id);const list=p?tracks.filter(t=>(p.trackIds||[]).includes(t.id)):tracks;content=<CollectionPage title={p?.name||"Today's Top Hits"} description={p?'Made by you.':"The tracks that define right now."} tracks={list} playTrack={playTrack} current={current} isPlaying={isPlaying} likedIds={likedIds} toggleLike={toggleLike} setPage={setPage}/> }
  else if(page.type==='library') content=<LibraryPage playlists={playlists} setPage={setPage} setCreateOpen={setCreateOpen} likedCount={likedIds.length} onUpload={()=>fileRef.current?.click()}/>
  else content=<><div className="px-6 pt-4 text-sm text-[#b3b3b3]">Discover music{busy?' · Loading…':''}{musicError&&<p role="alert">{musicError}</p>}</div><HomePage tracks={results.length?results:tracks} current={current} isPlaying={isPlaying} playTrack={playTrack} setPage={setPage}/></>

  return <div className="h-full bg-black text-white">
    <TopBar page={page} setPage={setPage} query={query} setQuery={setQuery}/>
    <div className="flex h-[calc(100%-64px)] gap-2 px-0 pb-0 md:px-2 md:pb-[100px]">
      <Sidebar page={page} setPage={setPage} playlists={playlists} setCreateOpen={setCreateOpen} onUpload={()=>fileRef.current?.click()}/>
      <main className="spotify-scroll min-w-0 flex-1 overflow-y-auto rounded-none bg-[#121212] md:rounded-lg">{content}</main>
    </div>
    <Player current={current} isPlaying={isPlaying} toggle={toggle} next={next} previous={previous} shuffle={shuffle} setShuffle={setShuffle} repeat={repeat} setRepeat={setRepeat} volume={volume} setVolume={setVolume} progress={progress} duration={duration} seek={seek} liked={current&&likedIds.includes(current.id)} toggleLike={toggleLike} setQueueOpen={setQueueOpen}/>
    {video&&<VideoPlayer video={video} onClose={()=>setVideo(null)}/>}
    <MobileNav page={page} setPage={setPage}/>
    {playError&&<div role="alert" className="fixed bottom-32 left-4 right-4 z-[70] rounded-lg bg-red-950 p-4 text-center">{playError}<button onClick={()=>setPlayError('')} className="ml-4 underline">Dismiss</button></div>}
    {queueOpen&&<QueuePanel tracks={tracks} current={current} playTrack={playTrack} onClose={()=>setQueueOpen(false)}/>} 
    {createOpen&&<CreateModal onClose={()=>setCreateOpen(false)} onCreate={createPlaylist}/>} 
    <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload}/>
  </div>
}
