import { createInvidiousClient } from './invidious.mjs'
export function normalizeAudius(t) {
  return {
    id:`audius-${t.id}`, remoteId:t.id, provider:'Audius', title:t.title,
    artist:t.user?.name||'Unknown artist', album:t.album_backlink?.playlist_name||t.genre||'Single',
    albumTitle:t.album_backlink?.playlist_name||undefined,
    duration:t.duration||0, artwork:t.artwork?.['480x480'], thumbnail:t.artwork?.['150x150'],
    src:`https://api.audius.co/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=OpenPlayer`,
    sourceUrl:`https://audius.co${t.permalink||''}`,
    published:Date.parse(t.release_date||t.created_at||'')/1000||0, color:['#164e63','#4c1d95'],
  }
}
// Only origins verified for search, CORS and real audio playback belong here.
export function createMusicService({instances=[],fetchImpl=globalThis.fetch,now=Date.now,timeoutMs=10000}={}) {
  const blocked=new Map(),cache=new Map()
  const clients=new Map(instances.map(origin=>[new URL(origin).href,createInvidiousClient(origin,{fetchImpl,timeoutMs})]))
  const quarantine=(origin,e)=>blocked.set(origin,/HTTP (401|403|429)/.test(e.message)?Infinity:now()+120000)
  const usable=origin=>!blocked.has(origin)||blocked.get(origin)<now()
  const unavailable=origin=>Object.assign(new Error('This music service is temporarily unavailable. Search available music below.'),{retryAfterMs:blocked.has(origin)?Math.max(0,blocked.get(origin)-now()):Infinity})
  async function audius(query,signal,latest) {
    const path=query?`tracks/search?query=${encodeURIComponent(query)}&limit=40`:'tracks/trending?limit=24'
    const response=await fetchImpl(`https://api.audius.co/v1/${path}&app_name=OpenPlayer`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)})
    if(!response.ok)throw Error(`Audio catalog unavailable (HTTP ${response.status}). Please try again later.`)
    const data=await response.json()
    if(!Array.isArray(data.data))throw Error('Audio catalog returned an invalid response.')
    const tracks=data.data.filter(t=>t.is_streamable&&!t.is_stream_gated&&t.is_available!==false).map(normalizeAudius)
    return latest?tracks.sort((a,b)=>b.published-a.published):tracks
  }
  function remember(key,result){if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(key,{result,expires:now()+300000})}
  const searchKey=(query,latest,audiusOnly)=>JSON.stringify([query.trim().toLowerCase(),latest,audiusOnly])
  function getCachedSearch(query='',{latest=false,audiusOnly=false}={}) {
    const key=searchKey(query,latest,audiusOnly)
    const entry=cache.get(key)
    if(!entry)return
    if(entry.expires<=now()||(entry.result.provider==='Invidious'&&!usable(entry.result.tracks[0]?.instanceUrl))){
      cache.delete(key)
      return
    }
    return entry.result
  }
  async function search(query='',{signal,latest=false,audiusOnly=false}={}) {
    query=query.trim();signal?.throwIfAborted()
    const key=searchKey(query,latest,audiusOnly)
    const cached=getCachedSearch(query,{latest,audiusOnly})
    if(cached)return cached
    if(!audiusOnly)for(const [origin,client] of clients) {
      if(!usable(origin))continue
      try {
        const tracks=await client.searchSongs(query||'Malayalam official music',{signal,...(latest?{date:'month'}:{})})
        signal?.throwIfAborted()
        if(tracks.length){const result={tracks,provider:'Invidious',fallback:false,message:''};remember(key,result);return result}
      } catch(e){if(signal?.aborted)throw e;quarantine(origin,e)}
    }
    const tracks=await audius(query,signal,latest);signal?.throwIfAborted()
    const result={tracks,provider:'Audius',fallback:true,message:'The wider music catalog is unavailable or has no matching tracks. Showing the available Audius catalog.'}
    remember(key,result);return result
  }
  async function play(track,audio,options={}) {
    let origin
    try { origin=new URL(track.instanceUrl).href } catch { /* Old or incomplete saved metadata. */ }
    const client=clients.get(origin)
    if(!client)throw Object.assign(new Error('This saved recording uses a source that is no longer available. Search for it again.'),{retryAfterMs:Infinity})
    if(!usable(origin))throw unavailable(origin)
    try{return await client.playVideo(track.videoId,audio,options)}
    catch(e){
      // A removed video, unsupported codec or failed media URL is not a source outage.
      if(e.sourceFailure&&!options.signal?.aborted){quarantine(origin,e);e.retryAfterMs=unavailable(origin).retryAfterMs}
      throw e
    }
  }
  return {search,getCachedSearch,play,clearCache:()=>cache.clear()}
}
