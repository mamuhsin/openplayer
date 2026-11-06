import { useEffect, useRef, useState } from 'react'
import { ExternalLink, KeyRound, Play, Search, X } from 'lucide-react'
import { videoIdFromUrl, searchYouTube } from './youtube.mjs'

export default function YouTubePage({query,setQuery,onPlay}) {
  const [key,setKey]=useState(()=>sessionStorage.getItem('openplayer-youtube-key')||'')
  const [draftKey,setDraftKey]=useState(key)
  const [settings,setSettings]=useState(false)
  const [link,setLink]=useState('')
  const [latest,setLatest]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [results,setResults]=useState([])
  const [selected,setSelected]=useState(null)
  const request=useRef(null)
  useEffect(()=>()=>request.current?.abort(),[])
  const open=(id,title='YouTube video')=>{onPlay();setSelected({id,title});setError('')}
  async function search(e) {
    e.preventDefault();setError('')
    const id=videoIdFromUrl(query)
    if(id){open(id);return}
    if(!query.trim())return
    if(!key){setSettings(true);return}
    request.current?.abort();const controller=new AbortController();request.current=controller
    setBusy(true)
    try {setResults(await searchYouTube(query.trim(),key,latest,AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])))}
    catch(e){if(e.name!=='AbortError')setError(e.name==='TimeoutError'?'Search timed out. Try again.':e.message)}
    finally{if(request.current===controller)setBusy(false)}
  }
  return <div className="p-4 md:p-6 pb-36">
    <div className="flex items-center justify-between gap-3 mb-2"><h1 className="text-2xl font-bold">YouTube Music Search</h1><button onClick={()=>setSettings(v=>!v)} className="flex items-center gap-2 rounded-full bg-[#282828] px-3 py-2 text-sm"><KeyRound size={16}/>Search setup</button></div>
    <p className="text-sm text-[#b3b3b3] mb-5">Find songs and watch them with the official YouTube player.</p>
    <form onSubmit={search} className="flex gap-2"><input aria-label="YouTube search" placeholder="Song, artist, or YouTube link" value={query} onChange={e=>setQuery(e.target.value)} className="bg-[#282828] rounded-full px-4 py-3 min-w-0 flex-1 outline-none focus:ring-2 ring-white"/><button disabled={busy} className="bg-white text-black font-bold rounded-full px-5 disabled:opacity-50">{busy?'Searching…':'Search'}</button></form>
    <label className="flex items-center gap-2 my-4 text-sm text-[#b3b3b3]"><input type="checkbox" checked={latest} onChange={e=>setLatest(e.target.checked)}/> Latest uploads first</label>
    {!key&&<div className="rounded-lg bg-[#202020] p-4 mb-4 text-sm"><p>Search results inside this app need a YouTube Data API key. You can already paste a YouTube video link below to play it here.</p><a className="inline-flex gap-2 items-center text-[#1ed760] mt-3" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query||'latest malayalam songs')}`} target="_blank" rel="noreferrer">Search on YouTube <ExternalLink size={15}/></a></div>}
    {settings&&<form onSubmit={e=>{e.preventDefault();sessionStorage.setItem('openplayer-youtube-key',draftKey.trim());setKey(draftKey.trim());setSettings(false)}} className="bg-[#242424] p-4 rounded-lg mb-5"><h2 className="font-bold">Enable in-app YouTube search</h2><p className="text-sm text-[#b3b3b3] my-2">Enable YouTube Data API v3 in your Google Cloud project and create a browser API key restricted to this app’s address. The key stays in this browser tab’s session.</p><a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" className="text-[#1ed760] text-sm underline">Open Google Cloud setup</a><input aria-label="YouTube API key" type="password" autoComplete="off" value={draftKey} onChange={e=>setDraftKey(e.target.value)} placeholder="Paste your API key here" className="w-full bg-black rounded px-3 py-2 mt-3"/><div className="flex gap-3 mt-3"><button className="bg-white rounded-full text-black font-bold px-4 py-2">Save key</button><button type="button" onClick={()=>{sessionStorage.removeItem('openplayer-youtube-key');setKey('');setDraftKey('')}} className="text-sm">Remove key</button></div></form>}
    <form onSubmit={e=>{e.preventDefault();const id=videoIdFromUrl(link);if(id)open(id);else setError('Paste a valid youtube.com or youtu.be video link.')}} className="flex flex-wrap gap-2 mb-5"><input aria-label="YouTube video link" value={link} onChange={e=>setLink(e.target.value)} placeholder="Paste YouTube video link" className="min-w-0 flex-1 rounded bg-[#282828] px-3 py-2"/><button className="rounded-full bg-[#1ed760] text-black font-bold px-4 py-2">Play link</button></form>
    {error&&<p role="alert" className="p-4 rounded bg-red-950 mb-4">{error}</p>}
    {selected&&<section className="mb-6"><div className="flex justify-between gap-3 mb-2"><h2 className="font-bold truncate">{selected.title}</h2><button onClick={()=>setSelected(null)} aria-label="Close YouTube player"><X size={20}/></button></div><iframe key={selected.id} title="YouTube video player" className="w-full aspect-video min-h-[210px] rounded-lg" src={`https://www.youtube.com/embed/${selected.id}?autoplay=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/><p className="text-xs text-[#b3b3b3] mt-2">Use the YouTube player controls. Availability and ads are controlled by YouTube. If embedding is unavailable, <a href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noreferrer" className="underline">watch on YouTube</a>.</p></section>}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{results.map(v=><button key={v.id} onClick={()=>open(v.id,v.title)} className="bg-[#181818] rounded-lg p-3 text-left hover:bg-[#282828]"><img src={v.thumbnails?.medium?.url} alt="" className="aspect-video w-full object-cover rounded"/><h2 className="mt-3 font-semibold line-clamp-2">{v.title}</h2><p className="text-sm text-[#b3b3b3] mt-1">{v.channelTitle}</p><p className="text-xs text-[#b3b3b3] mt-1">{new Date(v.publishedAt).toLocaleDateString()}</p></button>)}</div>
  </div>
}
