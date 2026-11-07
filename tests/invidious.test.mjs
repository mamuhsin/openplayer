import test from 'node:test'
import assert from 'node:assert/strict'
import { createInvidiousClient, selectAudioFormats } from '../src/invidious.mjs'

const id='M7lc1UVf-VE'
const formats=[{type:'video/mp4',url:'https://media.test/video',bitrate:'900000'},{type:'audio/webm; codecs="opus"',url:'https://media.test/opus',bitrate:'160000'},{type:'audio/mp4; codecs="mp4a.40.2"',url:'https://media.test/aac',bitrate:'128000'}]
const json=body=>({ok:true,json:async()=>body})
class FakeAudio {
  src='';volume=1;currentTime=0;paused=true
  canPlayType(type){return type.startsWith('audio/mp4')?'probably':''}
  getAttribute(){return this.src}
  removeAttribute(){this.src=''}
  pause(){this.paused=true}
  load(){}
  async play(){this.paused=false}
}
test('search encodes documented parameters and normalizes only videos',async()=>{
  let url
  const api=createInvidiousClient('https://instance.test',{fetchImpl:async value=>{url=value;return json([{type:'video',videoId:id,title:'A & B',author:'Uploader',lengthSeconds:42},{type:'channel'},{type:'video',videoId:'invalid'}])}})
  const result=await api.searchSongs('മലയാളം & music',{page:2,date:'month',duration:'medium',sort:'views'})
  assert.equal(url.pathname,'/api/v1/search');assert.equal(url.searchParams.get('q'),'മലയാളം & music');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('type'),'video');assert.equal(url.searchParams.get('date'),'month');assert.equal(result.length,1);assert.equal(result[0].duration,42)
})
test('invalid options and IDs fail before network access',async()=>{
  const api=createInvidiousClient('https://instance.test',{fetchImpl:()=>{throw Error('Must not fetch')}})
  await assert.rejects(api.searchSongs('music',{page:0}),/positive integer/)
  await assert.rejects(api.searchSongs('music',{sort:'date'}),/Invalid sort/)
  await assert.rejects(api.getAudioStream('../bad'),/Invalid video ID/)
  assert.deepEqual(await api.searchSongs('  '),[])
})
test('audio selection excludes video, respects codec support and bitrate',()=>{
  assert.equal(selectAudioFormats({adaptiveFormats:formats})[0].url,'https://media.test/opus')
  assert.equal(selectAudioFormats({adaptiveFormats:formats},new FakeAudio())[0].url,'https://media.test/aac')
})
test('details endpoint supplies a fresh supported stream to the audio element',async()=>{
  let calls=0
  const api=createInvidiousClient('https://instance.test',{fetchImpl:async (url,options)=>{
    calls++
    assert.equal(url.pathname,`/api/v1/videos/${id}`)
    assert.equal(options.cache,'no-store')
    return json({title:'Song',lengthSeconds:90,adaptiveFormats:formats})
  }})
  const audio=new FakeAudio()
  const stream=await api.playVideo(id,audio,{volume:.4})
  assert.equal(audio.src,'https://media.test/aac');assert.equal(audio.volume,.4);assert.equal(audio.paused,false);assert.equal(stream.duration,90)
  await api.playVideo(id,audio);assert.equal(calls,2)
})
test('HTTP, instance, invalid JSON and missing-format errors are surfaced',async()=>{
  for(const [response,pattern] of [[{ok:false,status:429},/429/],[json({error:'Video unavailable'}),/unavailable/],[{ok:true,json:async()=>{throw Error()}},/invalid JSON/],[json({adaptiveFormats:[]}),/No supported/]]){
    const api=createInvidiousClient('https://instance.test',{fetchImpl:async()=>response})
    await assert.rejects(api.getAudioStream(id),pattern)
  }
})
test('new playback cancels stale selection even if fetch ignores abort',async()=>{
  let release
  let calls=0
  const api=createInvidiousClient('https://instance.test',{fetchImpl:async()=>{if(++calls===1)await new Promise(r=>release=r);return json({adaptiveFormats:formats})}})
  const audio=new FakeAudio()
  const first=api.playVideo(id,audio)
  const rejected=assert.rejects(first,{name:'AbortError'})
  await api.playVideo('abcdefghijk',audio)
  release();await rejected
  assert.equal(audio.src,'https://media.test/aac');assert.equal(audio.paused,false)
})
test('autoplay rejection reaches caller',async()=>{
  const api=createInvidiousClient('https://instance.test',{fetchImpl:async()=>json({adaptiveFormats:formats})})
  const audio=new FakeAudio()
  audio.canPlayType=()=> 'probably'
  let attempts=0
  audio.play=async()=>{attempts++;throw new DOMException('Gesture required','NotAllowedError')}
  await assert.rejects(api.playVideo(id,audio),{name:'NotAllowedError'})
  assert.equal(attempts,1)
  assert.equal(audio.src,'https://media.test/opus')
})
test('tries another codec when the browser rejects the preferred stream',async()=>{
  const audio=new FakeAudio()
  audio.canPlayType=()=> 'probably'
  const attempted=[]
  audio.play=async()=>{
    attempted.push(audio.src)
    if(audio.src.endsWith('/opus'))throw new DOMException('No supported source','NotSupportedError')
    audio.paused=false
  }
  let requests=0
  const api=createInvidiousClient('https://instance.test',{fetchImpl:async()=>{
    requests++
    return json({adaptiveFormats:[
      ...formats,
      {type:'audio/webm; codecs="opus"',url:'https://media.test/opus',bitrate:'150000'},
      {type:'audio/mp4',url:'invalid',bitrate:'200000'},
    ]})
  }})
  const stream=await api.playVideo(id,audio)
  assert.deepEqual(attempted,['https://media.test/opus','https://media.test/aac'])
  assert.equal(stream.url,audio.src)
  assert.equal(audio.paused,false)
  assert.equal(requests,1)
})
test('a stalled stream times out and another format can start',async()=>{
  const audio=new FakeAudio()
  audio.canPlayType=()=> 'probably'
  const attempted=[]
  audio.play=async()=>{
    attempted.push(audio.src)
    if(audio.src.endsWith('/opus'))await new Promise(()=>{})
  }
  const api=createInvidiousClient('https://instance.test',{
    fetchImpl:async()=>json({adaptiveFormats:formats}),
    mediaTimeoutMs:5,
  })
  // Keep the test process alive while the native abort timer is pending.
  const keepAlive=setTimeout(()=>{},1000)
  try{await api.playVideo(id,audio)}finally{clearTimeout(keepAlive)}
  assert.deepEqual(attempted,['https://media.test/opus','https://media.test/aac'])
})
test('cancelled startup releases its source without trying another format',async()=>{
  const audio=new FakeAudio()
  audio.canPlayType=()=> 'probably'
  const controller=new AbortController()
  let attempts=0
  audio.play=async()=>{
    attempts++
    controller.abort()
    await new Promise(()=>{})
  }
  const api=createInvidiousClient('https://instance.test',{fetchImpl:async()=>json({adaptiveFormats:formats})})
  await assert.rejects(api.playVideo(id,audio,{signal:controller.signal}),{name:'AbortError'})
  assert.equal(attempts,1)
  assert.equal(audio.src,'')
})
