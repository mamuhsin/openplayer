# Invidious integration

The dependency-free src/invidious.mjs module follows https://docs.invidious.io/api/ .

```js
import { createInvidiousClient } from './src/invidious.mjs'
const client = createInvidiousClient('https://YOUR-VERIFIED-INSTANCE')
const songs = await client.searchSongs('Malayalam music', {
  page: 1, sort: 'relevance', date: 'month', region: 'IN'
})
await client.playVideo(songs[0].videoId, document.querySelector('audio'))
```

Search encodes q, type=video, page, sort, date, duration and region. Video details come from /api/v1/videos/{id}; only supported audio MIME types in adaptiveFormats are selected. Fresh stream URLs are requested for each playback and are not persisted.

src/music-service.mjs handles verified-origin selection, caching, denial quarantine and Audius fallback. No environment variable or user API key is required. Add an origin to src/verified-instances.json only after checking the official list, search, CORS and actual browser playback. Availability can change.

Requests support cancellation and timeouts. Stale requests cannot replace newer playback. Autoplay, geography, expiration and source restrictions can prevent playback. No stream proxy, DRM removal or access-control bypass is included.

Run npm test for API and fallback tests. See VERIFICATION.md for live evidence.
