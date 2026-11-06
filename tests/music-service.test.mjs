import test from 'node:test'
import assert from 'node:assert/strict'
import { createMusicService } from '../src/music-service.mjs'
const playable={adaptiveFormats:[{type:'audio/mp4',url:'https://media.test/song.mp4',bitrate:'128000'}]}
const audio=()=>({src:'',pause(){},load(){},getAttribute(){return this.src},canPlayType(){return 'probably'},async play(){}})
const origin='https://verified.test'
const inv={type:'video',videoId:'M7lc1UVf-VE',title:'Guitar',author:'Artist',lengthSeconds:120}
const track={id:'abc',title:'Guitar',user:{name:'Artist'},is_streamable:true,duration:120}
const response=data=>({ok:true,json:async()=>data})
test('healthy instance is preferred and recent search uses documented date parameter',async()=>{
  let calls=0
  const service=createMusicService({instances:[origin],fetchImpl:async url=>{calls++;assert.equal(new URL(url).searchParams.get('date'),'month');return response([inv])}})
  const result=await service.search('മലയാളം',{latest:true});assert.equal(result.provider,'Invidious');assert.equal(result.fallback,false)
  await service.search('മലയാളം',{latest:true});assert.equal(calls,1)
})
test('403 falls back and denied instance is not called again even after refresh',async()=>{
  let invCalls=0
  const service=createMusicService({instances:[origin],fetchImpl:async url=>{if(String(url).startsWith(origin)){invCalls++;return {ok:false,status:403}}return response({data:[track]})}})
  assert.equal((await service.search('first')).provider,'Audius');service.clearCache()
  await service.search('second');assert.equal(invCalls,1)
})
test('network outage falls back then allows a new attempt after cooldown',async()=>{
  let time=0,calls=0
  const service=createMusicService({instances:[origin],now:()=>time,fetchImpl:async url=>{if(String(url).startsWith(origin)){calls++;throw Error('Network down')}return response({data:[track]})}})
  await service.search('one');await service.search('two');assert.equal(calls,1)
  time=120001;await service.search('three');assert.equal(calls,2)
})
test('empty results use real fallback; gated tracks never become results',async()=>{
  const service=createMusicService({instances:[origin],fetchImpl:async url=>String(url).startsWith(origin)?response([]):response({data:[{...track,is_stream_gated:true}]})})
  const result=await service.search('missing');assert.equal(result.tracks.length,0);assert.equal(result.fallback,true)
})
test('both providers failing is an error, not demo results',async()=>{
  const service=createMusicService({instances:[origin],fetchImpl:async()=>({ok:false,status:503})})
  await assert.rejects(service.search('guitar'),/unavailable/)
})
test('cancelled searches do not call a fallback provider',async()=>{
  const controller=new AbortController();let calls=0
  const service=createMusicService({instances:[origin],fetchImpl:async()=>{calls++;controller.abort();throw controller.signal.reason}})
  await assert.rejects(service.search('guitar',{signal:controller.signal}),{name:'AbortError'});assert.equal(calls,1)
})
test('playback failure invalidates cached instance results',async()=>{
  const service=createMusicService({instances:[origin],fetchImpl:async url=>String(url).includes('/videos/')?{ok:false,status:403}:String(url).startsWith(origin)?response([inv]):response({data:[track]})})
  const result=await service.search('guitar')
  await assert.rejects(service.play(result.tracks[0],{play(){},pause(){},canPlayType(){return 'probably'}}),/403/)
  assert.equal((await service.search('guitar')).provider,'Audius')
})
test('one unavailable recording does not quarantine the entire source',async()=>{
  let calls=0
  const service=createMusicService({instances:[origin],fetchImpl:async()=>++calls===1?response({error:'Video unavailable'}):response(playable)})
  const t={instanceUrl:origin+'/',videoId:inv.videoId}
  await assert.rejects(service.play(t,audio()),/Video unavailable/)
  await service.play({...t,videoId:'abcdefghijk'},audio());assert.equal(calls,2)
})
test('missing audio formats and failed media URLs leave other recordings playable',async()=>{
  let calls=0
  const service=createMusicService({instances:[origin],fetchImpl:async()=>response(++calls===1?{adaptiveFormats:[]}:playable)})
  const t={instanceUrl:origin+'/',videoId:inv.videoId}
  await assert.rejects(service.play(t,audio()),/No supported/)
  const brokenAudio=audio();brokenAudio.play=async()=>{throw new DOMException('Media failed','NotSupportedError')}
  await assert.rejects(service.play(t,brokenAudio),{name:'NotSupportedError'})
  await service.play(t,audio());assert.equal(calls,3)
})
test('saved origins without trailing slash are normalized before playback',async()=>{
  const service=createMusicService({instances:[origin],fetchImpl:async()=>response(playable)})
  await service.play({instanceUrl:origin,videoId:inv.videoId},audio())
})
test('temporary source outage exposes cooldown and retry succeeds after it expires',async()=>{
  let time=0,calls=0
  const service=createMusicService({instances:[origin],now:()=>time,fetchImpl:async()=>++calls===1?{ok:false,status:503}:response(playable)})
  const t={instanceUrl:origin,videoId:inv.videoId}
  await assert.rejects(service.play(t,audio()),e=>e.retryAfterMs===120000)
  await assert.rejects(service.play(t,audio()),e=>e.retryAfterMs===120000);assert.equal(calls,1)
  time=120001;await service.play(t,audio());assert.equal(calls,2)
})
test('denied playback is not offered an immediate retry or sent again',async()=>{
  let calls=0
  const service=createMusicService({instances:[origin],fetchImpl:async()=>{calls++;return {ok:false,status:403}}})
  const t={instanceUrl:origin,videoId:inv.videoId}
  await assert.rejects(service.play(t,audio()),e=>e.retryAfterMs===Infinity)
  await assert.rejects(service.play(t,audio()),e=>e.retryAfterMs===Infinity);assert.equal(calls,1)
})
test('a removed recording (404) does not block the service',async()=>{
  let calls=0
  const service=createMusicService({instances:[origin],fetchImpl:async()=>++calls===1?{ok:false,status:404}:response(playable)})
  const t={instanceUrl:origin,videoId:inv.videoId}
  await assert.rejects(service.play(t,audio()),/404/)
  await service.play(t,audio());assert.equal(calls,2)
})
