import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMusic, musicService } from './catalog'
import UnifiedSearch from './UnifiedSearch'
import { startAudio, restorePosition, watchAudioStalls, upcomingTracks, shuffledTracks } from './playback.mjs'
import {
  Archive, ChevronDown, ChevronLeft, ChevronRight, Clock3, Heart, Home, Library, ListMusic, Music2,
  Pause, Play, Plus, Repeat, Repeat1, Search, Shuffle, SkipBack, SkipForward,
  Volume1, Volume2, VolumeX, X,
} from 'lucide-react'

const EMPTY_TRACK = {title:'',album:'',color:['#282828','#111827']}

const fmt = (seconds = 0) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  return `${m}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

const readStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function playbackMessage(error) {
  if (error.name === 'NotAllowedError') return 'Tap Play again to allow audio.'
  if (error.sourceFailure) return 'The music service cannot play this recording right now. Available music has been refreshed below.'
  if (error.name === 'TimeoutError') return 'This recording took too long to start. Retry playback or find available music.'
  if (['NotSupportedError','NetworkError'].includes(error.name) || /No supported audio-only/.test(error.message)) {
    return 'This recording has no playable audio right now. Try another recording.'
  }
  return error.message
}

function Art({ item, className = '', round = false, large = false, small = false, eager = false }) {
  const [failed,setFailed]=useState([])
  const src = (small ? [item.thumbnail,item.artwork] : [item.artwork,item.thumbnail]).find(url=>url&&!failed.includes(url))
  const colors = item.color || ['#334155','#9333ea']
  return (
    <div className={`relative overflow-hidden shadow-xl ${round ? 'rounded-full' : 'rounded-[4px]'} ${className}`}
      style={{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})` }}>
      <div className="absolute -right-[18%] -bottom-[28%] h-[80%] w-[80%] rotate-12 rounded-[18%] border border-white/20 bg-white/10" />
      <div className="absolute left-[12%] top-[12%] h-[28%] w-[28%] rounded-full bg-white/10 blur-xl" />
      <span aria-hidden="true" className={`absolute inset-0 grid place-items-center font-black tracking-[-.08em] text-white/90 ${large ? 'text-7xl' : 'text-2xl'}`}>{item.glyph || (item.title || item.name)?.slice(0,1)}</span>
      {src && <img key={src} src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={()=>setFailed(urls=>[...urls,src])}/>}
    </div>
  )
}

function IconButton({ label, children, active, onClick, disabled = false, className = '' }) {
  return <button aria-label={label} title={label} disabled={disabled} onClick={onClick}
    className={`tooltip grid place-items-center rounded-full transition hover:scale-105 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'text-[#1ed760]' : 'text-[#b3b3b3]'} ${className}`}
    data-tip={label}>{children}</button>
}

function TopBar({ page, setPage, query, setQuery }) {
  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center gap-2 bg-black px-2 md:px-4">
      <button onClick={() => setPage({ type:'home' })} aria-label="OpenPlayer home" className="mx-3 mr-5 hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-black md:grid"><Music2 size={20}/></button>
      <button onClick={() => setPage({ type:'home' })} aria-label="Home" className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition ${page.type === 'home' ? 'bg-[#2a2a2a] text-white' : 'bg-[#1f1f1f] text-[#b3b3b3] hover:text-white'}`}><Home size={25} fill={page.type === 'home' ? 'currentColor' : 'none'}/></button>
      <div role="search" className="relative flex h-12 min-w-0 max-w-[475px] flex-1 items-center rounded-full bg-[#1f1f1f] ring-2 ring-transparent transition focus-within:bg-[#2a2a2a] focus-within:ring-white hover:bg-[#2a2a2a]">
        <Search className="ml-3 shrink-0 text-[#b3b3b3]" size={25}/>
        <input value={query} onChange={e => { setQuery(e.target.value); setPage({ type:'search' }) }} onFocus={() => setPage({ type:'search' })}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#b3b3b3] md:text-[15px]" placeholder="What do you want to play?" aria-label="Search" />
        {query && <button onClick={() => setQuery('')} className="mr-2 text-[#b3b3b3] hover:text-white" aria-label="Clear search"><X size={20}/></button>}
        <button onClick={()=>setPage({type:'search',query:''})} aria-label="Browse music" className="mr-4 hidden border-l border-[#777] pl-3 text-[#b3b3b3] hover:text-white md:block"><Archive size={22}/></button>
      </div>
      <nav aria-label="Library" className="ml-auto hidden items-center text-sm font-bold md:flex"><button onClick={()=>setPage({type:'library'})} className={page.type==='library'?'text-white':'text-[#b3b3b3] hover:text-white'}>Your Library</button></nav>
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
      <div className="flex gap-2 px-4 pb-3"><button onClick={()=>setPage({type:'library'})} className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm font-semibold hover:bg-[#333]">Playlists</button><button onClick={onUpload} className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm font-semibold hover:bg-[#333]">Local audio</button></div>
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
      <div className="p-5 text-[11px] leading-7 text-[#b3b3b3]">OpenPlayer · Free and open source<br/>Your library stays in this browser.</div>
    </aside>
  )
}

function PlayDot({ playing, onClick, label='Play' }) {
  return <button onClick={onClick} aria-label={label} className="card-play absolute bottom-2 right-2 z-20 grid h-12 w-12 place-items-center rounded-full bg-[#1ed760] text-black shadow-xl hover:scale-105 hover:bg-[#3be477]">{playing ? <Pause size={22} fill="black"/> : <Play size={22} fill="black" className="ml-1"/>}</button>
}

function MediaCard({ item, onOpen, onPlay, playing, round=false, eager=false }) {
  return (
    <article className="media-card relative min-w-0 rounded-md p-2 transition hover:bg-[#1f1f1f] focus-within:bg-[#1f1f1f] md:p-3">
      <button onClick={onOpen} aria-label={`Open ${item.title || item.name}`} className="absolute inset-0 z-10 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"/>
      <div className="relative"><Art item={item} round={round} eager={eager} className="aspect-square w-full"/><PlayDot playing={playing} onClick={onPlay} label={`${playing?'Pause':'Play'} ${item.title || item.name}`}/></div>
      <div className="mt-2 line-clamp-2 text-sm leading-[22px] md:text-[15px]">{item.title || item.name}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-[22px] text-[#b3b3b3] md:text-sm">{item.artist || item.subtitle || 'Artist'}</div>
    </article>
  )
}

function Section({ title, children, onShowAll }) {
  const rail=useRef(null)
  const [edges,setEdges]=useState({left:false,right:false})
  const update=useCallback(()=>{
    const node=rail.current
    if(!node)return
    const left=node.scrollLeft>2
    const right=node.scrollLeft+node.clientWidth<node.scrollWidth-2
    setEdges(old=>old.left===left&&old.right===right?old:{left,right})
  },[])
  useEffect(()=>{
    const observer=new ResizeObserver(update)
    observer.observe(rail.current)
    update()
    return()=>observer.disconnect()
  },[children.length,update])
  const scroll=direction=>rail.current.scrollBy({left:direction*rail.current.clientWidth*.75,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})
  return <section className="mb-8 md:mb-10">
    <div className="flex items-end justify-between gap-3 px-4 md:px-10"><h2 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h2>{onShowAll && <button onClick={onShowAll} className="shrink-0 text-xs font-bold text-[#b3b3b3] hover:underline md:text-sm">Show all</button>}</div>
    <div className="group/rail relative md:mt-1">
      <div className="home-rail" ref={rail} onScroll={update}>{children}</div>
      {edges.left&&<button onClick={()=>scroll(-1)} aria-label={`Previous in ${title}`} className="rail-arrow left-2"><ChevronLeft size={20}/></button>}
      {edges.right&&<button onClick={()=>scroll(1)} aria-label={`Next in ${title}`} className="rail-arrow right-2"><ChevronRight size={20}/></button>}
    </div>
  </section>
}

function HomePage({ tracks, current, isPlaying, playTrack, setPage }) {
  const artists=[...new Map(tracks.map(t=>[t.artist,t])).values()].slice(0,6)
  const releases=[...new Map(tracks.map(t=>[t.albumTitle?JSON.stringify([t.provider,t.artist,t.albumTitle]):t.id,t])).values()].slice(0,6)
  return <div className="min-h-full bg-[linear-gradient(#222_0,#121212_290px)] pb-6 pt-6">
    <h1 className="sr-only">Home</h1>
    <Section title="Trending songs" onShowAll={() => setPage({ type:'playlist', id:'top-hits' })}>
      {tracks.slice(0,6).map(t => <MediaCard key={t.id} item={t} eager onOpen={() => setPage({type:'release',track:t})} onPlay={() => playTrack(t)} playing={current?.id===t.id && isPlaying}/>)}
    </Section>
    <Section title="Popular artists" onShowAll={() => setPage({ type:'search' })}>
      {artists.map(t => <MediaCard key={t.artist} item={{name:t.artist,artwork:t.artwork,thumbnail:t.thumbnail,color:t.color,subtitle:t.provider==='Invidious'?'Channel':'Artist'}} round onOpen={() => setPage({type:'artist',track:t})} onPlay={() => playTrack(t,tracks.filter(a=>a.artist===t.artist&&a.provider===t.provider))} playing={current?.id===t.id && isPlaying}/>)}
    </Section>
    <Section title="Popular albums and recordings">
      {releases.map(t => <MediaCard key={t.id} item={{...t,title:t.albumTitle||t.title}} onOpen={() => setPage({type:'release',track:t})} onPlay={() => playTrack(t)} playing={current?.id===t.id && isPlaying}/>)}
    </Section>
  </div>
}

function TrackRow({ track, index, playTrack, current, isPlaying, liked, toggleLike, compact=false, onAdd }) {
  const active = current?.id === track.id
  return <div className={`track-row group grid h-14 items-center gap-3 rounded px-2 text-sm hover:bg-white/10 ${compact ? 'grid-cols-[24px_1fr_48px]' : 'grid-cols-[24px_minmax(0,2fr)_minmax(0,1fr)_36px_76px]'}`}>
    <button onClick={()=>playTrack(track)} aria-label={`${active&&isPlaying?'Pause':'Play'} ${track.title}`} className={`text-center ${active?'text-[#1ed760]':'text-[#b3b3b3]'}`}><span className="group-hover:hidden">{active&&isPlaying?<span className="inline-flex h-4 items-end gap-[2px]"><i className="eq-bar h-3 w-[2px] bg-[#1ed760]"/><i className="eq-bar h-4 w-[2px] bg-[#1ed760]"/><i className="eq-bar h-2 w-[2px] bg-[#1ed760]"/></span>:index+1}</span><span className="hidden group-hover:inline">{active&&isPlaying?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}</span></button>
    <div className="flex min-w-0 items-center gap-3"><Art item={track} small className="h-10 w-10 shrink-0"/><div className="min-w-0"><div className={`truncate font-medium ${active?'text-[#1ed760]':''}`}>{track.title}</div><div className="truncate text-xs text-[#b3b3b3]">{track.artist}</div></div></div>
    {!compact && <div className="track-album truncate text-[#b3b3b3]">{track.album}</div>}
    {!compact && <button onClick={()=>toggleLike?.(track.id)} className={`transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${liked?'!opacity-100 text-[#1ed760]':''}`} aria-label={liked?'Remove from Liked Songs':'Save to Liked Songs'}><Heart size={17} fill={liked?'currentColor':'none'}/></button>}
    <div className="flex items-center justify-end gap-2 text-[#b3b3b3]"><span>{fmt(track.duration)}</span>{onAdd&&<button onClick={()=>onAdd(track)} className="md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" aria-label={`Add ${track.title} to playlist`}><Plus size={16}/></button>}</div>
  </div>
}

function CollectionPage({ kind='playlist', title, description, tracks, artwork, playTrack, current, isPlaying, likedIds, toggleLike, setPage, shuffle, setShuffle, onAdd }) {
  const first = artwork || tracks[0] || EMPTY_TRACK
  const isLiked = kind === 'liked'
  const isArtist = kind === 'artist' || kind === 'channel'
  const isPlaylist = isLiked || kind === 'playlist'
  const isActive = current && tracks.some(t=>t.id===current.id)
  const hero = isLiked ? ['#450af5','#8c8ce5'] : first.color || EMPTY_TRACK.color
  const label = isPlaylist ? 'Playlist' : kind[0].toUpperCase()+kind.slice(1)
  return <div className="page-fade min-h-full bg-[#121212] pb-6">
    <section className="flex min-h-[276px] flex-col justify-end gap-5 p-6 md:flex-row md:items-end md:justify-start" style={{background:`linear-gradient(180deg, ${hero[1]}, ${hero[0]})`}}>
      {isLiked ? <div className="grid h-40 w-40 shrink-0 place-items-center bg-gradient-to-br from-[#450af5] to-[#c4efd9] shadow-2xl md:h-56 md:w-56"><Heart size={70} fill="white"/></div> : <Art item={{...first,title,glyph:title[0],color:hero}} round={isArtist} eager large className="h-40 w-40 shrink-0 md:h-56 md:w-56"/>}
      <div className="min-w-0"><div className="mb-2 text-xs font-semibold">{label}</div><h1 className={`line-clamp-3 break-words text-3xl font-black tracking-[-.045em] sm:text-5xl ${isPlaylist||isArtist?'xl:text-7xl':'xl:text-5xl'}`}>{title}</h1>{description&&<p className="mt-4 text-sm text-white/80">{description}</p>}<div className="mt-2 text-sm">{isPlaylist&&<><b>OpenPlayer</b> · </>}{tracks.length} {tracks.length===1?'track':'tracks'}</div></div>
    </section>
    <div className="bg-gradient-to-b from-black/50 to-transparent p-4 md:p-6"><div className="mb-5 flex flex-wrap items-center gap-5"><button aria-label={`${isActive&&isPlaying?'Pause':'Play'} ${label.toLowerCase()}`} disabled={!tracks.length} onClick={()=>playTrack(isActive?current:tracks[0])} className="grid h-14 w-14 place-items-center rounded-full bg-[#1ed760] text-black hover:scale-105 disabled:opacity-50">{isActive&&isPlaying?<Pause size={27} fill="black"/>:<Play size={27} fill="black" className="ml-1"/>}</button><IconButton label="Shuffle" active={shuffle} onClick={setShuffle}><Shuffle size={30}/></IconButton>{isArtist&&<button onClick={()=>setPage({type:'search',query:title})} className="rounded-full border border-white/30 px-4 py-2 text-sm font-bold hover:border-white">Find more</button>}</div>
      <div className="mb-2 hidden grid-cols-[24px_minmax(0,2fr)_minmax(0,1fr)_36px_76px] gap-3 border-b border-white/10 px-2 pb-2 text-sm text-[#b3b3b3] md:grid"><span>#</span><span>Title</span><span>Album</span><span/><Clock3 size={16}/></div>
      {tracks.length ? tracks.map((t,i)=><TrackRow key={t.id} track={t} index={i} playTrack={playTrack} current={current} isPlaying={isPlaying} liked={likedIds.includes(t.id)} toggleLike={toggleLike} onAdd={onAdd}/>) : <div className="py-20 text-center"><Music2 className="mx-auto mb-4" size={48}/><h2 className="text-2xl font-bold">This playlist is empty</h2><button onClick={()=>setPage({type:'search'})} className="mt-5 rounded-full bg-white px-5 py-3 font-bold text-black">Find something to add</button></div>}
    </div>
  </div>
}

function Player({ audioRef, loading, current, isPlaying, toggle, next, canAdvance, previous, shuffle, setShuffle, repeat, setRepeat, volume, setVolume, seek, liked, toggleLike, setQueueOpen }) {
  const [muted,setMuted]=useState(false)
  const [expanded,setExpanded]=useState(false)
  const [position,setPosition]=useState({time:0,duration:0})
  useEffect(()=>{
    const audio=audioRef.current
    if(!audio || !current)return
    const update=()=>{
      const duration=Number.isFinite(audio.duration)?audio.duration:current.duration||0
      const time=audio.currentTime||0
      setPosition(previous=>previous.time===time&&previous.duration===duration?previous:{time,duration})
    }
    const events=['timeupdate','durationchange','seeking','emptied']
    update()
    events.forEach(event=>audio.addEventListener(event,update))
    return()=>events.forEach(event=>audio.removeEventListener(event,update))
  },[audioRef,current])
  const progress=loading?0:position.time
  const duration=loading?current?.duration||0:position.duration
  const volumeBeforeMute=useRef(volume)
  const mute=()=>{if(muted){setVolume(volumeBeforeMute.current||.72);setMuted(false)}else{volumeBeforeMute.current=volume;setVolume(0);setMuted(true)}}
  if (!current) return null
  return <>
    {!expanded&&<div className="fixed bottom-[64px] left-2 right-2 z-50 flex h-14 items-center rounded-md bg-[#3b3b3b] px-2 shadow-xl md:hidden">
      <Art item={current} className="h-11 w-11 shrink-0"/><button onClick={()=>setExpanded(true)} aria-label="Open player" className="min-w-0 flex-1 px-2 text-left"><div className="truncate text-sm font-semibold">{current.title}</div><div className="truncate text-xs text-[#ddd]">{current.artist}</div></button><button aria-label={liked?'Remove from Liked Songs':'Save to Liked Songs'} onClick={()=>toggleLike(current.id)} className={liked?'text-[#1ed760]':''}><Heart size={21} fill={liked?'currentColor':'none'}/></button><button aria-label={loading?'Cancel loading':isPlaying?'Pause':'Play'} onClick={toggle} className="ml-4">{loading?<X size={25}/>:isPlaying?<Pause size={25} fill="white"/>:<Play size={25} fill="white"/>}</button><div className="absolute bottom-0 left-0 h-[2px] rounded bg-white" style={{width:`${duration?progress/duration*100:0}%`}}/>
    </div>}
    <footer className={`fixed bottom-0 left-0 right-0 z-[60] grid-cols-[minmax(180px,1fr)_minmax(300px,2fr)_minmax(180px,1fr)] items-center bg-black px-4 md:grid md:h-[92px] ${expanded?'flex h-full flex-col justify-center gap-12':'hidden h-[92px]'}`}>
      {expanded&&<button onClick={()=>setExpanded(false)} aria-label="Close player" className="absolute top-6 right-6 md:hidden"><ChevronDown size={30}/></button>}
      <div className="flex w-full min-w-0 items-center gap-3 md:w-auto"><Art item={current} className="h-14 w-14 shrink-0"/><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium hover:underline">{current.title}</div><div className="truncate text-xs text-[#b3b3b3] hover:underline">{current.artist}</div></div><IconButton label={liked?'Remove from Liked Songs':'Save to Liked Songs'} active={liked} onClick={()=>toggleLike(current.id)} className="ml-2 h-8 w-8"><Heart size={17} fill={liked?'currentColor':'none'}/></IconButton></div>
      <div className="flex flex-col items-center"><div className="flex h-9 items-center gap-4"><IconButton label={shuffle?'Disable shuffle':'Enable shuffle'} active={shuffle} onClick={()=>setShuffle(v=>!v)}><Shuffle size={18}/></IconButton><IconButton label="Previous" onClick={previous}><SkipBack size={20} fill="currentColor"/></IconButton><button onClick={toggle} aria-label={loading?'Cancel loading':isPlaying?'Pause':'Play'} className="grid h-8 w-8 place-items-center rounded-full bg-white text-black transition hover:scale-105">{loading?<X size={18}/>:isPlaying?<Pause size={18} fill="black"/>:<Play size={18} fill="black" className="ml-[2px]"/>}</button><IconButton label="Next" onClick={next} disabled={!canAdvance}><SkipForward size={20} fill="currentColor"/></IconButton><IconButton label={repeat===0?'Enable repeat':repeat===1?'Enable repeat one':'Disable repeat'} active={repeat>0} onClick={()=>setRepeat((repeat+1)%3)}>{repeat===2?<Repeat1 size={18}/>:<Repeat size={18}/>}</IconButton></div>
        <div className="flex w-full max-w-[630px] items-center gap-2 text-[11px] text-[#b3b3b3]"><span className="w-10 text-right">{loading?'…':fmt(progress)}</span><input aria-label="Seek" className="range w-full" style={{'--value':`${duration?progress/duration*100:0}%`}} type="range" min="0" max={duration||1} step="0.1" value={Math.min(progress,duration||0)} onChange={e=>seek(Number(e.target.value))}/><span className="w-10">{fmt(duration)}</span></div>
      </div>
      <div className="flex justify-end gap-3"><IconButton label="Queue" onClick={()=>{setExpanded(false);setQueueOpen(v=>!v)}}><ListMusic size={18}/></IconButton><IconButton label={muted?'Unmute':'Mute'} onClick={mute}>{muted||volume===0?<VolumeX size={18}/>:volume<.5?<Volume1 size={18}/>:<Volume2 size={18}/>}</IconButton><input aria-label="Volume" className="range w-24" style={{'--value':`${muted?0:volume*100}%`}} type="range" min="0" max="1" step="0.01" value={muted?0:volume} onChange={e=>{setMuted(false);setVolume(Number(e.target.value))}}/></div>
    </footer>
  </>
}

function MobileNav({ page, setPage }) {
  return <nav className="fixed bottom-0 left-0 right-0 z-50 grid h-16 grid-cols-3 bg-gradient-to-t from-black via-black to-black/90 md:hidden">
    {[['home','Home',Home],['search','Search',Search],['library','Your Library',Library]].map(([id,label,Icon])=><button key={id} onClick={()=>setPage({type:id})} className={`flex flex-col items-center justify-center gap-1 text-[10px] ${page.type===id?'text-white':'text-[#b3b3b3]'}`}><Icon size={23} fill={page.type===id&&id==='home'?'currentColor':'none'}/><span>{label}</span></button>)}
  </nav>
}

function LibraryPage({ playlists, setPage, setCreateOpen, likedCount, onUpload }) {
  return <div className="min-h-full bg-[#121212] p-4 pb-32"><div className="mb-5 flex items-center"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#a855f7] font-bold">Y</div><h1 className="ml-3 text-2xl font-bold">Your Library</h1><button onClick={()=>setCreateOpen(true)} className="ml-auto"><Plus size={28}/></button></div><div className="mb-5 flex gap-2"><button onClick={()=>setCreateOpen(true)} className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm">Create playlist</button><button onClick={onUpload} className="rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm">Local audio</button></div><button onClick={()=>setPage({type:'liked'})} className="mb-3 flex w-full items-center gap-3"><div className="grid h-16 w-16 place-items-center rounded bg-gradient-to-br from-[#450af5] to-[#c4efd9]"><Heart fill="white"/></div><div className="text-left"><div className="font-semibold">Liked Songs</div><div className="text-sm text-[#b3b3b3]">Playlist · {likedCount} songs</div></div></button>{playlists.map(p=><button key={p.id} onClick={()=>setPage({type:'playlist',id:p.id})} className="mb-3 flex w-full items-center gap-3"><Art item={{title:p.name,glyph:p.name[0],color:p.color||['#334155','#111827']}} className="h-16 w-16"/><div className="text-left"><div className="font-semibold">{p.name}</div><div className="text-sm text-[#b3b3b3]">Playlist · You</div></div></button>)}</div>
}

function QueuePanel({ tracks, current, playTrack, onClose }) {
  return <aside className="spotify-scroll fixed bottom-[128px] right-2 top-16 z-[70] w-[min(340px,calc(100%-16px))] overflow-y-auto rounded-lg bg-[#121212] p-4 shadow-2xl ring-1 ring-white/10 md:bottom-[92px]"><div className="mb-5 flex items-center"><h2 className="text-xl font-bold">Queue</h2><button aria-label="Close queue" onClick={onClose} className="ml-auto rounded-full p-2 hover:bg-white/10"><X size={20}/></button></div><h3 className="mb-3 text-sm font-bold text-[#b3b3b3]">Now playing</h3>{current&&<button onClick={()=>playTrack(current)} className="mb-6 flex w-full items-center gap-3 rounded p-2 text-left hover:bg-white/10"><Art item={current} className="h-12 w-12"/><div><div className="text-sm text-[#1ed760]">{current.title}</div><div className="text-xs text-[#b3b3b3]">{current.artist}</div></div></button>}<h3 className="mb-3 text-sm font-bold">Next in queue</h3>{tracks.filter(t=>t.id!==current?.id).map(t=><button key={t.id} onClick={()=>playTrack(t)} className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-white/10"><Art item={t} className="h-10 w-10"/><div className="min-w-0"><div className="truncate text-sm">{t.title}</div><div className="truncate text-xs text-[#b3b3b3]">{t.artist}</div></div></button>)}</aside>
}

function CreateModal({ onClose, onCreate }) {
  const [name,setName]=useState('My Playlist')
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onMouseDown={onClose}><form onSubmit={e=>{e.preventDefault();onCreate(name)}} onMouseDown={e=>e.stopPropagation()} className="w-full max-w-md rounded-lg bg-[#282828] p-6 shadow-2xl"><div className="flex items-center"><h2 className="text-2xl font-bold">Create playlist</h2><button type="button" onClick={onClose} className="ml-auto"><X/></button></div><label className="mt-5 block text-xs font-bold">Name</label><input autoFocus value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded bg-[#3e3e3e] px-3 py-3 outline-none ring-white focus:ring-1" maxLength={60}/><p className="mt-4 text-xs text-[#b3b3b3]">Your playlist is stored only in this browser.</p><button disabled={!name.trim()} className="mt-6 float-right rounded-full bg-[#1ed760] px-6 py-3 font-bold text-black disabled:opacity-50">Create</button><div className="clear-both"/></form></div>
}

function PlaybackNotice({ message, retryAt, onRetry, onAlternatives, onDismiss }) {
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{
    setNow(Date.now())
    if(!Number.isFinite(retryAt)||retryAt<=Date.now())return
    const timer=setInterval(()=>setNow(Date.now()),1000)
    return()=>clearInterval(timer)
  },[retryAt])
  const seconds=Math.max(0,Math.ceil((retryAt-now)/1000))
  return <div role="alert" className="fixed bottom-32 left-4 right-4 z-[80] mx-auto max-w-2xl rounded-lg bg-red-950 p-4 text-center text-sm shadow-xl">
    {message}
    <div className="mt-3 flex flex-wrap justify-center gap-4">
      {Number.isFinite(retryAt)&&<button disabled={seconds>0} onClick={onRetry} className="underline disabled:opacity-50">{seconds>0?`Retry in ${seconds}s`:'Retry playback'}</button>}
      <button onClick={onAlternatives} className="underline">Find available music</button>
      <button onClick={onDismiss} className="underline">Dismiss</button>
    </div>
  </div>
}

export default function App() {
  const [page,setPageState]=useState({type:'home'})
  const [query,setQuery]=useState('')
  const [latest,setLatest]=useState(false)
  const [retryCount,setRetryCount]=useState(0)
  const [audiusOnly,setAudiusOnly]=useState(false)
  const [likedIds,setLikedIds]=useState(()=>readStored('spotify-clone-liked',[]))
  const [playlists,setPlaylists]=useState(()=>readStored('spotify-clone-playlists',[]))
  const [uploaded,setUploaded]=useState([])
  const [createOpen,setCreateOpen]=useState(false)
  const [addTarget,setAddTarget]=useState(null)
  const [queueOpen,setQueueOpen]=useState(false)
  const [current,setCurrent]=useState(null)
  const [queue,setQueue]=useState([])
  const [isPlaying,setIsPlaying]=useState(false)
  const [playLoading,setPlayLoading]=useState(false)
  const [reconnecting,setReconnecting]=useState(false)
  const [shuffle,setShuffle]=useState(false)
  const [repeat,setRepeat]=useState(0)
  const [volume,setVolume]=useState(()=>Math.max(0,Math.min(1,Number(localStorage.getItem('spotify-clone-volume')??.72)||0)))
  const audioRef=useRef(null),playbackRequest=useRef(null),startingPlayback=useRef(null),fileRef=useRef(null)
  const mainRef=useRef(null)
  const recoveryUsed=useRef(false)
  const onPlaybackFault=useRef(null)
  const originalQueue=useRef([])
  const [catalog,setCatalog]=useState(()=>readStored('openplayer-catalog',[]).filter(t=>t.provider==='Invidious'||t.provider==='Audius'))
  const [results,setResults]=useState([])
  const [homeTracks,setHomeTracks]=useState([])
  const [busy,setBusy]=useState(true)
  const [status,setStatus]=useState('')
  const [musicError,setMusicError]=useState('')
  const [playError,setPlayError]=useState('')
  const [playRetryAt,setPlayRetryAt]=useState(0)
  const tracks=useMemo(()=>[...catalog,...uploaded],[catalog,uploaded])
  const savedIds=useMemo(()=>new Set([...likedIds,...playlists.flatMap(p=>p.trackIds||[])]),[likedIds,playlists])
  const savedIdsRef=useRef(savedIds)
  useEffect(()=>{savedIdsRef.current=savedIds},[savedIds])
  const storedCatalog=useMemo(()=>JSON.stringify(catalog.filter(t=>savedIds.has(t.id))),[catalog,savedIds])
  const searchQuery=page.type==='search'?query.trim():''
  useEffect(()=>{
    const controller=new AbortController()
    const options={signal:controller.signal,latest,audiusOnly}
    const cached=musicService.getCachedSearch(searchQuery,options)
    setBusy(!cached);setMusicError('')
    const applyResult=response=>{
      if(controller.signal.aborted)return
      setResults(response.tracks);setStatus(response.message)
      if(!searchQuery)setHomeTracks(response.tracks)
      setCatalog(old=>{
        const byId=new Map(old.map(t=>[t.id,t]))
        for(const track of response.tracks){
          if(!savedIdsRef.current.has(track.id))byId.delete(track.id)
          byId.set(track.id,track)
        }
        const pinned=[],recent=[]
        for(const track of byId.values()){
          if(savedIdsRef.current.has(track.id))pinned.push(track)
          else recent.push(track)
        }
        return [...pinned,...recent.slice(-300)]
      })
    }
    const request=()=>getMusic(searchQuery,options).then(applyResult)
      .catch(e=>{if(!controller.signal.aborted){setResults([]);setStatus('');setMusicError(e.message)}})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false)})
    let timer
    if(cached)applyResult(cached)
    else if(searchQuery)timer=setTimeout(request,220)
    else request()
    return()=>{clearTimeout(timer);controller.abort()}
  },[searchQuery,latest,retryCount,audiusOnly])
  const setPage=useCallback(p=>{
    if(p.query!==undefined)setQuery(p.query)
    setPageState(p);setQueueOpen(false)
  },[])
  useEffect(()=>{mainRef.current.scrollTop=0},[page.type,page.id,page.track?.id])
  const retry=()=>{musicService.clearCache();setRetryCount(v=>v+1)}
  useEffect(()=>localStorage.setItem('spotify-clone-liked',JSON.stringify(likedIds)),[likedIds])
  useEffect(()=>localStorage.setItem('spotify-clone-playlists',JSON.stringify(playlists)),[playlists])
  useEffect(()=>{try{localStorage.setItem('openplayer-catalog',storedCatalog)}catch{}},[storedCatalog])
  useEffect(()=>{localStorage.setItem('spotify-clone-volume',String(volume));audioRef.current.volume=volume},[volume])
  useEffect(()=>()=>{playbackRequest.current?.abort();audioRef.current?.pause()},[])
  useEffect(()=>{
    const a=audioRef.current
    const played=()=>{setIsPlaying(true);setPlayLoading(false);setPlayError('')}
    const paused=()=>setIsPlaying(false)
    const failed=()=>{if(a.error)onPlaybackFault.current(a.currentTime,true)}
    const stopWatching=watchAudioStalls(a,position=>onPlaybackFault.current(position))
    a.addEventListener('playing',played);a.addEventListener('pause',paused);a.addEventListener('error',failed)
    return()=>{
      stopWatching()
      a.removeEventListener('playing',played);a.removeEventListener('pause',paused);a.removeEventListener('error',failed)
    }
  },[])
  const upcoming=useMemo(()=>upcomingTracks(queue,current?.id,repeat===1),[queue,current,repeat])
  useEffect(()=>{
    const a=audioRef.current
    const ended=()=>{
      if(startingPlayback.current||!a.ended)return
      if(current&&(repeat===2||(repeat===1&&queue.length===1))){
        a.currentTime=0
        playTrack(current)
      }
      else if(upcoming.length)next()
      else setIsPlaying(false)
    }
    a.addEventListener('ended',ended);return()=>a.removeEventListener('ended',ended)
  },[upcoming,current,repeat,queue.length])

  function setPlaybackQueue(list, track) {
    originalQueue.current=list
    setQueue(shuffle?[track,...shuffledTracks(list.filter(item=>item.id!==track.id))]:list)
  }

  function toggleShuffle() {
    const enabled=!shuffle
    setShuffle(enabled)
    setQueue(order=>{
      const currentIndex=order.findIndex(track=>track.id===current?.id)
      const played=order.slice(0,currentIndex+1)
      const remaining=order.slice(currentIndex+1)
      if(enabled)return played.concat(shuffledTracks(remaining))
      const ids=new Set(remaining.map(track=>track.id))
      return played.concat(originalQueue.current.filter(track=>ids.has(track.id)))
    })
  }

  async function playTrack(track,force=false,list,{startTime=0,recovering=false,following=[],advancing=false}={}) {
    if(!track)return
    const a=audioRef.current
    const resume=current?.id===track.id&&!force&&!startingPlayback.current&&a.getAttribute('src')&&!a.error
    if(resume&&!a.paused){a.pause();return}

    playbackRequest.current?.abort()
    const request=new AbortController();playbackRequest.current=request
    startingPlayback.current=request
    if(!recovering)recoveryUsed.current=false
    setIsPlaying(false);setPlayLoading(true);setReconnecting(recovering);setPlayError('');setPlayRetryAt(0)
    if(list?.length)setPlaybackQueue(list,track)
    else if(!force&&current?.id!==track.id){
      const context=results.some(t=>t.id===track.id)?results:tracks.filter(t=>likedIds.includes(t.id)||t.id===track.id)
      setPlaybackQueue(context,track)
    }

    const timeout=following.length?24000:20000
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(timeout)])
    try{
      if(resume){
        await startAudio(a,signal)
        return
      }
      const candidates=[track,...following]
      for(let index=0;index<candidates.length;index++){
        signal.throwIfAborted()
        const candidate=candidates[index]
        setCurrent(candidate)
        a.pause()
        if(a.hasAttribute('src')){a.removeAttribute('src');a.load()}
        const position=index===0?startTime:0
        const attempt=index<candidates.length-1
          ? AbortSignal.any([signal,AbortSignal.timeout(10000)])
          : signal
        try{
          if(candidate.provider==='Invidious'){
            await musicService.play(candidate,a,{signal:attempt,startTime:position})
          }else{
            a.src=candidate.src
            a.load()
            await startAudio(a,attempt)
            restorePosition(a,position)
          }
          return
        }catch(error){
          signal.throwIfAborted()
          if(error.name==='NotAllowedError'||error.name==='AbortError'||index===candidates.length-1)throw error
        }
      }
    }catch(error){
      if(playbackRequest.current!==request)return
      a.pause()
      if(error.name==='AbortError'||error.name==='TimeoutError'){
        a.removeAttribute('src')
        a.load()
      }
      if(error.name==='AbortError')return
      if(advancing&&error.name!=='NotAllowedError'){
        setPlayError(error.name==='TimeoutError'
          ? 'The queue took too long to start another recording.'
          : 'The remaining recordings in this queue could not play.')
      }else{
        setPlayError(playbackMessage(error))
      }
      if(error.retryAfterMs!==undefined){
        setPlayRetryAt(Number.isFinite(error.retryAfterMs)?Date.now()+error.retryAfterMs:Infinity)
        musicService.clearCache();setRetryCount(v=>v+1)
      }
    }finally{
      if(startingPlayback.current===request){
        startingPlayback.current=null
        setPlayLoading(false);setReconnecting(false)
      }
    }
  }
  onPlaybackFault.current=(position,mediaError=false)=>{
    const a=audioRef.current
    if(!current||startingPlayback.current||a.ended||(!mediaError&&a.paused))return
    if(!current.uploaded&&!recoveryUsed.current&&(isPlaying||!a.paused)){
      recoveryUsed.current=true
      playTrack(current,true,undefined,{startTime:position,recovering:true})
      return
    }
    a.pause()
    a.removeAttribute('src')
    a.load()
    setIsPlaying(false)
    setPlayError('Playback stopped. Retry this recording or select the next track.')
  }
  function next(){
    if(upcoming.length)playTrack(upcoming[0],true,undefined,{following:upcoming.slice(1),advancing:true})
  }
  const previous=()=>{
    const a=audioRef.current
    const index=queue.findIndex(t=>t.id===current?.id)
    if(a.currentTime>3||index===0){a.currentTime=0;return}
    if(index>0)playTrack(queue[index-1],true)
  }
  const toggle=()=>{
    if(startingPlayback.current){playbackRequest.current?.abort();return}
    playTrack(current||results[0])
  }
  const seek=v=>{if(Number.isFinite(audioRef.current.duration))audioRef.current.currentTime=v}
  const toggleLike=id=>setLikedIds(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])
  const addToPlaylist=(track,playlistId)=>{setPlaylists(v=>v.map(p=>p.id===playlistId?{...p,trackIds:[...new Set([...(p.trackIds||[]),track.id])]}:p));setAddTarget(null);setPage({type:'playlist',id:playlistId})}
  const createPlaylist=name=>{
    const p={id:'playlist-'+Date.now(),name:name.trim(),trackIds:addTarget?[addTarget.id]:[],color:['#5b21b6','#0f172a']}
    setPlaylists(v=>[...v,p]);setCreateOpen(false);setAddTarget(null);setPage({type:'playlist',id:p.id})
  }
  const handleUpload=e=>{const file=e.target.files?.[0];if(!file)return;const t={id:'upload-'+Date.now(),title:file.name.replace(/\.[^.]+$/,''),artist:'Local file',album:'Uploads (this session)',duration:0,color:['#0f766e','#22c55e'],glyph:'♪',src:URL.createObjectURL(file),uploaded:true};setUploaded(v=>[...v,t]);playTrack(t,false,[t]);e.target.value=''}
  const alternatives=()=>{setQuery(query.trim()||current?.title?.split('|')[0].trim()||'');setAudiusOnly(true);setPlayError('');setPage({type:'search'});retry()}
  let content
  if(page.type==='search')content=<UnifiedSearch query={query} setQuery={q=>{setQuery(q);setAudiusOnly(false)}} results={results} busy={busy} error={musicError} status={status} latest={latest} setLatest={setLatest} retry={retry} playTrack={playTrack} current={current} isPlaying={isPlaying} toggleLike={toggleLike} likedIds={likedIds} setPage={setPage} onAdd={setAddTarget}/>
  else if(page.type==='library')content=<LibraryPage playlists={playlists} setPage={setPage} setCreateOpen={setCreateOpen} likedCount={likedIds.length} onUpload={()=>fileRef.current?.click()}/>
  else if(['liked','playlist','artist','release'].includes(page.type)){
    const p=playlists.find(x=>x.id===page.id)
    const seed=page.track
    let kind=page.type,title,description,list
    if(kind==='artist'||kind==='release'){
      const known=[seed,...tracks.filter(t=>t.id!==seed.id&&t.provider===seed.provider&&t.artist===seed.artist)]
      if(kind==='artist'){
        kind=seed.provider==='Invidious'?'channel':'artist'
        title=seed.artist
        list=known
      }else{
        kind=seed.albumTitle?'album':'recording'
        title=seed.albumTitle||seed.title
        description=seed.artist
        list=seed.albumTitle?known.filter(t=>t.albumTitle===seed.albumTitle):[seed]
      }
    }else{
      title=kind==='liked'?'Liked Songs':p?.name||'Discover music'
      description=kind==='liked'||p?'Your music, your library.':null
      list=kind==='liked'?tracks.filter(t=>likedIds.includes(t.id)):p?tracks.filter(t=>p.trackIds.includes(t.id)):homeTracks
    }
    content=<CollectionPage kind={kind} title={title} description={description} tracks={list} artwork={seed} playTrack={(t)=>playTrack(t,false,list)} current={current} isPlaying={isPlaying} likedIds={likedIds} toggleLike={toggleLike} setPage={setPage} shuffle={shuffle} setShuffle={toggleShuffle} onAdd={setAddTarget}/>
  }else content=<>{(busy||status||musicError)&&<div className="px-4 pt-4 text-sm text-[#b3b3b3] md:px-10">{busy&&!homeTracks.length&&<p role="status">Loading music…</p>}{status&&<p role="status">{status}</p>}{musicError&&<p role="alert">{musicError}</p>}{musicError&&<button onClick={retry} className="mt-2 underline">Retry search</button>}</div>}<HomePage tracks={homeTracks} current={current} isPlaying={isPlaying} playTrack={(t,list=homeTracks)=>playTrack(t,false,list)} setPage={setPage}/></>
  return <div className="flex h-full flex-col bg-black text-white">
    <audio ref={audioRef} preload="metadata" data-testid="audio-engine"/>
    <TopBar page={page} setPage={setPage} query={query} setQuery={q=>{setQuery(q);setAudiusOnly(false)}}/>
    <div className={`flex min-h-0 flex-1 gap-2 px-0 md:px-2 md:pb-[100px] ${current?'pb-[120px]':'pb-16'}`}><Sidebar page={page} setPage={setPage} playlists={playlists} setCreateOpen={setCreateOpen} onUpload={()=>fileRef.current?.click()}/><main ref={mainRef} className="spotify-scroll min-w-0 flex-1 overflow-y-auto rounded-none bg-[#121212] md:rounded-lg">{content}</main></div>
    <Player audioRef={audioRef} loading={playLoading} current={current} isPlaying={isPlaying} toggle={toggle} next={next} canAdvance={upcoming.length>0} previous={previous} shuffle={shuffle} setShuffle={toggleShuffle} repeat={repeat} setRepeat={setRepeat} volume={volume} setVolume={setVolume} seek={seek} liked={current&&likedIds.includes(current.id)} toggleLike={toggleLike} setQueueOpen={setQueueOpen}/>
    <MobileNav page={page} setPage={setPage}/>
    {playLoading&&<div role="status" className="fixed bottom-32 left-4 z-[65] rounded bg-[#282828] p-3 text-sm">{reconnecting?'Reconnecting audio…':'Loading audio…'}</div>}
    {playError&&<PlaybackNotice message={playError} retryAt={playRetryAt} onRetry={()=>playTrack(current)} onAlternatives={alternatives} onDismiss={()=>setPlayError('')}/>}
    {queueOpen&&<QueuePanel tracks={upcoming} current={current} playTrack={t=>playTrack(t,t.id!==current?.id)} onClose={()=>setQueueOpen(false)}/>}
    {addTarget&&!createOpen&&<div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"><section role="dialog" aria-label="Add to playlist" className="w-full max-w-sm rounded-lg bg-[#282828] p-5"><div className="flex justify-between"><h2 className="text-xl font-bold">Add to playlist</h2><button onClick={()=>setAddTarget(null)} aria-label="Close playlist picker"><X/></button></div>{playlists.map(p=><button key={p.id} onClick={()=>addToPlaylist(addTarget,p.id)} className="block w-full text-left rounded p-3 hover:bg-white/10">{p.name}</button>)}<button onClick={()=>setCreateOpen(true)} className="mt-4 rounded-full bg-white text-black font-bold px-4 py-2">New playlist</button></section></div>}
    {createOpen&&<CreateModal onClose={()=>setCreateOpen(false)} onCreate={createPlaylist}/>}
    <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload}/>
  </div>
}
