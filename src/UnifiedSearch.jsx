import { useEffect, useState } from 'react'
import { Settings, Play, X } from 'lucide-react'
import OnlineSearch from './OnlineSearch'
import { searchYouTube, videoIdFromUrl } from './youtube.mjs'

export default function UnifiedSearch(props) {
  const [apiKey,setApiKey]=useState(()=>sessionStorage.getItem('openplayer-youtube-key')||import.meta.env.VITE_YOUTUBE_API_KEY||'')
  const [settings,setSettings]=useState(false)
  const [draft,setDraft]=useState(apiKey)
  const [videos,setVideos]=useState([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [latest,setLatest]=useState(false)
  useEffect(()=>{
    if(!apiKey){setVideos([]);return}
    const controller=new AbortController();setLoading(true);setError('')
    const timer=setTimeout(()=>searchYouTube(props.query.trim()||'latest Malayalam official music',apiKey,latest,AbortSignal.any([controller.signal,AbortSignal.timeout(18000)])).then(setVideos).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)}),900)
    return()=>{clearTimeout(timer);controller.abort()}
  },[props.query,apiKey,latest])
  return <>
    <div className="px-4 md:px-6 pt-5 flex items-center gap-3"><label className="text-sm text-[#b3b3b3]"><input type="checkbox" checked={latest} onChange={e=>setLatest(e.target.checked)} className="mr-2"/>Latest releases</label><button aria-label="Music settings" onClick={()=>setSettings(v=>!v)} className="ml-auto rounded-full bg-[#282828] p-2"><Settings size={19}/></button></div>
    {settings&&<form onSubmit={e=>{e.preventDefault();sessionStorage.setItem('openplayer-youtube-key',draft.trim());setApiKey(draft.trim());setSettings(false)}} className="mx-4 md:mx-6 mt-4 rounded-lg bg-[#242424] p-4"><h2 className="font-bold">Music catalog setup</h2><p className="text-sm text-[#b3b3b3] my-2">Enable YouTube music video results with a restricted YouTube Data API key. Videos use the official visible player. Audio catalog search works without a key.</p><input aria-label="Music API key" type="password" autoComplete="off" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="YouTube Data API key" className="w-full rounded bg-black p-3"/><button className="mt-3 rounded-full bg-white px-4 py-2 font-bold text-black">Save</button></form>}
    {loading&&<p role="status" className="px-6 pt-4 text-sm">Finding music videos…</p>}
    {error&&<p role="alert" className="mx-6 mt-4 rounded bg-red-950 p-3 text-sm">{error}</p>}
    {!apiKey&&<p className="px-4 md:px-6 pt-4 text-sm text-[#b3b3b3]">Audio catalog available. Music video search needs an API key in Music settings.</p>}
    {videoIdFromUrl(props.query)&&<button onClick={()=>props.onVideo({id:videoIdFromUrl(props.query),title:'Music video'})} className="mx-6 mt-4 rounded-full bg-[#1ed760] text-black px-4 py-2">Play video link</button>}
    {!!videos.length&&<section className="px-4 md:px-6 pt-5"><h2 className="text-xl font-bold mb-3">{latest?'Recently uploaded music videos':'Music videos'}</h2><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{videos.map(v=><button key={v.id} onClick={()=>props.onVideo(v)} className="rounded-lg bg-[#181818] hover:bg-[#282828] p-2 text-left"><img src={v.thumbnails?.medium?.url} alt="" className="w-full aspect-video rounded object-cover"/><p className="font-semibold text-sm line-clamp-2 mt-2">{v.title}</p><p className="text-xs text-[#b3b3b3] mt-1">{v.channelTitle}</p></button>)}</div></section>}
    <OnlineSearch {...props}/>
  </>
}

export function VideoPlayer({video,onClose}) {
  return <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-3"><section role="dialog" aria-label="Now playing video" className="w-full max-w-4xl rounded-xl bg-[#181818] p-3"><div className="flex gap-3 items-center mb-3"><h2 className="truncate font-bold">{video.title}</h2><button onClick={onClose} aria-label="Close video" className="ml-auto p-2"><X/></button></div><iframe title="Music video player" src={`https://www.youtube.com/embed/${video.id}?autoplay=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`} className="w-full aspect-video min-h-[210px]" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="block mt-3 text-sm text-[#b3b3b3] underline">Unavailable here? Open on YouTube</a></section></div>
}
