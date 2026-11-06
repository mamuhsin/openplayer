import { createInvidiousClient } from './invidious.mjs'
export function normalizeAudius(t) {
  return { id:`audius-${t.id}`, remoteId:t.id, provider:'Audius', title:t.title, artist:t.user?.name||'Unknown artist', album:t.album_backlink?.playlist_name||t.genre||'Single', duration:t.duration||0, artwork:t.artwork?.['480x480'], src:`https://api.audius.co/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=OpenPlayer`, sourceUrl:`https://audius.co${t.permalink||''}`, published:Date.parse(t.release_date||t.created_at||'')/1000||0, color:['#164e63','#4c1d95'] }
}
// Only origins verified for search, CORS and real audio playback belong here.
export function createMusicService({instances=[],fetchImpl=globalThis.fetch,now=Date.now,timeoutMs=10000}={}) {
  const blocked=new Map(),cache=new Map()
  const clients=new Map(instances.map(origin=>[new URL(origin).href,createInvidiousClient(origin,{fetchImpl,timeoutMs})]))
  const quarantine=(origin,e)=>blocked.set(origin,/HTTP (401|403|429)/.test(e.message)?Infinity:now()+120000)
  const usable=origin=>!blocked.has(origin)||blocked.get(origin)<now()
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
  async function search(query='',{signal,latest=false,audiusOnly=false}={}) {
    query=query.trim();signal?.throwIfAborted()
    const key=JSON.stringify([query.toLowerCase(),latest,audiusOnly]),hit=cache.get(key)
    if(hit&&hit.expires>now()&&(hit.result.provider!=='Invidious'||usable(hit.result.tracks[0]?.instanceUrl)))return hit.result
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
    const client=clients.get(track.instanceUrl)
    if(!client||!usable(track.instanceUrl))throw Error('This music source is unavailable. Search other recordings instead.')
    try{return await client.playVideo(track.videoId,audio,options)}
    catch(e){if(e.name!=='AbortError'&&e.name!=='NotAllowedError')quarantine(track.instanceUrl,e);throw e}
  }
  return {search,play,clearCache:()=>cache.clear()}
}
