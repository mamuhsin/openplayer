# Invidious integration

`src/invidious.mjs` is a standalone ES module with no dependencies. It follows https://docs.invidious.io/api/ .

```js
import { createInvidiousClient } from './src/invidious.mjs';

const client = createInvidiousClient('https://YOUR-INSTANCE');
const songs = await client.searchSongs('Malayalam music', {
  page: 1, sort: 'relevance', date: 'month', region: 'IN'
});

// Metadata + a fresh direct URL, chosen using browser codec support:
const audio = document.querySelector('audio');
const stream = await client.getAudioStream(songs[0].videoId, { audio });
console.log(stream.mimeType, stream.bitrate);

// Use from a play-button event. Assigns audio.src and starts playback.
await client.playVideo(songs[0].videoId, audio, { volume: 0.7 });
// Existing audio controls, timeupdate, ended, volume and currentTime still work.
client.cancelPlayback(audio);
```

## Use in this app

Copy `.env.example` to `.env`, set `VITE_INVIDIOUS_INSTANCE` to your instance origin, and restart Vite. The existing unified search and HTML5 audio player then use Invidious. No new provider tabs are added. Saved track metadata includes its originating instance; signed stream URLs are fetched again for playback and are not stored in localStorage. Without configuration, the existing Audius integration remains active.

## Behavior and limitations

- Search parameters use `q`, `type=video`, `page`, `sort`, `date`, `duration`, and `region`. The documented sort options are relevance/views; a recent-date filter does not guarantee chronological release order.
- Video details come from `/api/v1/videos/{id}`. Only audio MIME types in `adaptiveFormats` are considered; highest bitrate supported by `audio.canPlayType` wins.
- Requests support AbortSignal, timeouts, HTTP failures, invalid JSON and API errors. Rapid track changes cancel stale requests before they can replace a newer selection.
- `playVideo` rejects if the browser blocks autoplay. Call it from a user interaction and show the error/retry state; some browsers may still require another gesture after the metadata request.
- The instance must enable its API and allow your origin through CORS. Stream hosts must permit media playback; requests can fail due to expiration, geography, removal, provider restrictions, or outages. There is no promise of uninterrupted playback or the complete Spotify catalog.
- No proxy, DRM removal, signature-deciphering implementation, or access-control bypass is included.

Validation: `node --test tests/invidious.test.mjs` tests parameter encoding, filtering, codec support, fresh URLs, HTTP/API/JSON errors, autoplay rejection, and stale-request cancellation. Tests use mock API responses/audio elements. A live instance URL has not been supplied, so real Invidious streaming is not verified.
