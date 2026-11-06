// Invidious JSON API adapter. No direct media URLs are persisted or cached.
const pendingPlayback = new WeakMap()
const ID = /^[A-Za-z0-9_-]{11}$/
const enumValue = (value, allowed, name) => {
  if (!allowed.includes(value)) throw new TypeError(`Invalid ${name}`)
  return value
}
const checkId = id => { if (!ID.test(id)) throw new TypeError('Invalid video ID'); return id }
const abortError = () => new DOMException('Playback cancelled', 'AbortError')

function httpUrl(value, base) {
  const url = new URL(value, base)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError('Expected an HTTP(S) URL without credentials')
  }
  return url.href
}

/** Select audio-only adaptive formats that this browser can decode, best bitrate first. */
export function selectAudioFormats(details, audio) {
  return (Array.isArray(details.adaptiveFormats) ? details.adaptiveFormats : [])
    .filter(format => typeof format.type === 'string' && /^audio\//i.test(format.type) && typeof format.url === 'string')
    .filter(format => !audio || ['probably', 'maybe'].includes(audio.canPlayType(format.type)))
    .map(format => ({
      url: httpUrl(format.url),
      mimeType: format.type,
      bitrate: Number(format.bitrate) || 0,
      itag: String(format.itag ?? ''),
    }))
    .sort((a, b) => b.bitrate - a.bitrate)
}

export function createInvidiousClient(instanceUrl, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const base = httpUrl(instanceUrl)
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required')

  async function request(path, params = {}, signal) {
    const url = new URL(`/api/v1/${path}`, base)
    url.search = new URLSearchParams(params)
    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    combined.throwIfAborted()
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: combined, credentials: 'omit' })
    if (!response.ok) throw new Error(`Invidious request failed (HTTP ${response.status})`)
    let body
    try { body = await response.json() } catch { throw new Error('The instance returned invalid JSON') }
    combined.throwIfAborted()
    if (body?.error) throw new Error(String(body.error))
    return body
  }

  /** q, page, sort, date, duration, region and type use documented API names. */
  async function searchSongs(query, { page = 1, sort = 'relevance', date, duration, region = 'IN', signal } = {}) {
    if (typeof query !== 'string') throw new TypeError('Query must be a string')
    if (!query.trim()) return []
    if (!Number.isSafeInteger(page) || page < 1) throw new TypeError('Page must be a positive integer')
    if (!/^[A-Z]{2}$/.test(region)) throw new TypeError('Region must be a two-letter uppercase country code')
    const params = { q: query.trim(), type: 'video', page: String(page), sort: enumValue(sort, ['relevance', 'views'], 'sort'), region }
    if (date) params.date = enumValue(date, ['hour', 'today', 'week', 'month', 'year'], 'date')
    if (duration) params.duration = enumValue(duration, ['short', 'medium', 'long'], 'duration')
    const data = await request('search', params, signal)
    if (!Array.isArray(data)) throw new Error('Expected a search-results array')
    return data.filter(item => item.type === 'video' && ID.test(item.videoId)).map(item => ({
      id: `invidious-${item.videoId}`, videoId: item.videoId, provider: 'Invidious',
      instanceUrl: base, title: item.title || 'Untitled',
      artist: item.author || 'Unknown uploader', // Uploader, not verified artist credit.
      album: 'Online music', duration: Number(item.lengthSeconds) || 0,
      artwork: item.videoThumbnails?.find(t => t.quality === 'medium')?.url || item.videoThumbnails?.[0]?.url || null,
      sourceUrl: new URL(`/watch?v=${item.videoId}`, base).href,
      views: Number(item.viewCount) || 0, published: item.published ?? null,
      liveNow: Boolean(item.liveNow), color: ['#164e63', '#4c1d95'],
    }))
  }

  /** Fetch a fresh stream URL because signed media URLs can expire. */
  async function getAudioStream(videoId, { audio, region = 'IN', signal } = {}) {
    checkId(videoId)
    const details = await request(`videos/${videoId}`, { region }, signal)
    if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('Invalid video-details response')
    const formats = selectAudioFormats(details, audio)
    if (!formats.length) throw new Error('No supported audio-only stream is available for this video')
    return { ...formats[0], formats, title: details.title, duration: Number(details.lengthSeconds) || 0 }
  }

  /** Connect a video to an HTMLAudioElement; newer selections cancel older requests. */
  async function playVideo(videoId, audio, { signal, volume, startTime = 0 } = {}) {
    checkId(videoId)
    if (!audio || typeof audio.play !== 'function' || typeof audio.canPlayType !== 'function') throw new TypeError('An HTMLAudioElement is required')
    pendingPlayback.get(audio)?.abort()
    const controller = new AbortController()
    pendingPlayback.set(audio, controller)
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    audio.pause()
    let assignedUrl
    const cancel = () => {
      if (assignedUrl && audio.getAttribute('src') === assignedUrl) {
        audio.pause(); audio.removeAttribute('src'); audio.load()
      }
    }
    combined.addEventListener('abort', cancel, { once: true })
    try {
      const stream = await getAudioStream(videoId, { audio, signal: combined })
      combined.throwIfAborted()
      if (pendingPlayback.get(audio) !== controller) throw abortError()
      if (volume !== undefined) audio.volume = Math.max(0, Math.min(1, volume))
      assignedUrl = stream.url
      audio.src = stream.url
      audio.preload = 'auto'
      audio.load()
      if (Number.isFinite(startTime) && startTime > 0) audio.currentTime = startTime
      // play() rejects on blocked autoplay, unsupported media, or network failures.
      await audio.play()
      combined.throwIfAborted()
      return stream
    } finally {
      combined.removeEventListener('abort', cancel)
      if (pendingPlayback.get(audio) === controller) pendingPlayback.delete(audio)
    }
  }

  function cancelPlayback(audio) { pendingPlayback.get(audio)?.abort(); audio.pause() }
  return { searchSongs, getAudioStream, playVideo, cancelPlayback }
}
