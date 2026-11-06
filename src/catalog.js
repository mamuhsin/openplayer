import { createMusicService } from './music-service.mjs'
import verified from './verified-instances.json'
export const musicService=createMusicService({instances:verified.instances})
export const getMusic=(query,options)=>musicService.search(query,options)
