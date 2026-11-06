export function videoIdFromUrl(value) {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
    let id
    if (host === 'youtu.be') id = url.pathname.split('/')[1]
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = url.searchParams.get('v') || (/^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null)
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null
  } catch { return null }
}

export async function searchYouTube(query, key, latest, signal) {
  const params = new URLSearchParams({ part:'snippet', type:'video', videoEmbeddable:'true', videoSyndicated:'true', maxResults:'20', q:query, order:latest?'date':'relevance', regionCode:'IN', key })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {signal})
  const body = await response.json()
  if (!response.ok) {
    const reason = body.error?.errors?.[0]?.reason
    throw new Error(reason === 'quotaExceeded' ? 'YouTube search quota is used up. Try later, or paste a video link below.' : 'YouTube search failed. Check that the API key is valid and YouTube Data API v3 is enabled.')
  }
  return (body.items || []).filter(x=>x.id?.videoId).map(x=>({id:x.id.videoId,...x.snippet}))
}
