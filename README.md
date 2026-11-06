# Spotify Web Player Clone

A local React/Vite music player with live Audius search and full-track streaming. Search for songs, artists, or genres (including Malayalam and guitar), then select a result to play. No API key is required for the public read endpoints. The catalog is Audius, not Spotify; availability and artist-uploaded metadata depend on that service.

## Run locally

The app has a single search interface. Configure a restricted YouTube Data API key in **Music settings** to add music video results, or set `VITE_INVIDIOUS_INSTANCE` in `.env` to use an Invidious instance for audio search/playback. See `INVIDIOUS.md` for configuration. No public Invidious instance is preconfigured.

See `ANDROID.md` for the Android APK build workflow. Source code is MIT-licensed; the license does not license third-party music or branding.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). For a production build:

```bash
npm run build
npm run preview
```

## Included behavior

- Home, Search, Artist, Album, Playlist, Liked Songs, and mobile Library views
- Responsive desktop sidebar, mobile navigation, full desktop player, and mobile mini-player
- Play/pause, next/previous, shuffle, repeat/repeat-one, seek, volume, mute, queue, and progress
- Search results and browse categories
- Liked Songs and custom playlists persisted in `localStorage`
- Local audio upload (session-only, because browsers do not persist file handles automatically)
- Live trending tracks, real cover artwork, and search through the official Audius API
- Full-track HTML5 audio streaming, with loading and unavailable-track messages
- Expanded mobile player with seek, shuffle, repeat, volume, and queue
- Cached remote metadata so saved tracks remain available after reload

Internet access is required for online music. Audius can limit requests or remove tracks; unavailable or gated tracks are excluded. Uploaded files remain session-only. No login, subscription, billing, Spotify API access, or DRM bypass is included. Spotify is a trademark of Spotify AB; this independent educational reconstruction is not affiliated with Spotify.

## Main files

- `src/App.jsx` — application pages, state, audio engine, persistence, and controls
- `src/index.css` — global Spotify-like styling, ranges, animation, and responsive details
- `REA-NOTES.md` — the evidence ledger from the REA inspection and verification pass
