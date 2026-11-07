# OpenPlayer

A free, open-source music player with Home, Search and Library. It uses React components with Preact's compatibility runtime, Vite and Tailwind. No account, subscription or user API key is required.

## Start

```sh
npm ci
npm test
npm run dev
```

Production: `npm run build`, then `npm run preview`. Vite prints the local URL. Netlify uses the included netlify.toml: build `npm run build`, publish `dist`. No functions or music proxy is deployed; media streams directly to the listener.

## Music availability

Public Invidious origins are recorded in src/verified-instances.json after checking the official list, API search, browser access and actual audio playback. When unavailable or empty, search falls back to the official Audius catalog and reports the fallback. Recent music filters Invidious results to the past month; this is not a guaranteed new-release feed. Audius results sort by publication date when selected.

Denied requests (401/403/429) are not retried during the session. Other failures have a two-minute cooldown; search is debounced, cancellable and cached for five minutes. Playback includes loading, a timeout, retry and an option to find other recordings. No demo tracks appear as real search results.

Public instances, geography, CORS and source restrictions affect availability. This does not provide the entire Spotify/YouTube catalog or guarantee new songs. Use music you have permission to access; no DRM or access-control bypass is implemented.

## Player

- Desktop sidebar, mobile navigation and expanded mobile player
- Play/pause, previous/next, shuffle, repeat/repeat-one, seek, volume/mute and queue
- Likes, custom playlists and metadata persist in localStorage on the current browser/origin
- Local audio upload is session-only; select files again after reload
- Remote artwork and source links

See ANDROID.md for debug APK builds, INVIDIOUS.md for API details and VERIFICATION.md for checks. Source is MIT-licensed; that does not grant rights to third-party music or artwork. This independent project is not affiliated with Spotify.
