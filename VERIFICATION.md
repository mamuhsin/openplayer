# Verification — 6 November 2026

## Live sources

Official list: https://docs.invidious.io/instances/ . Search requests returned 403 for inv.nadeko.net and invidious.tiekoetter.com, 401 for invidious.nerdvpn.de. These were not bypassed and are not enabled.

yt.chocolatemoo53.com returned JSON search/video details, enabled CORS and provided supported adaptive audio formats. REA browser evidence ev_ec70ceca720f5eaab011f3d71f60a5f51aa0001c2fd28eeb45a12cc439806664 observed real audio advancing to 14.9 seconds. Only this origin is enabled. Availability may change after testing.

## Browser verification

REA desktop 1440×900 scenario ev_da56037ab385c5603d1f8b67a76461f4dc9beefb752324a26a2f44982034030a completed Guitar search/playback, pause, seek, likes, repeat, mute/unmute and queue with no reported page errors.

Mobile browser at 390×844: Malayalam query “മലരേ” found the official Premam Malare recording. HTML5 audio was playing at 9.87 seconds of 313.32 seconds with no media error. Pause, seek, volume, shuffle, repeat, likes, playlist creation and queue opening were exercised. A long-title overflow found during screenshot review was corrected. A stable-build reload retained a created playlist and the saved like. Initial mobile automation was inconclusive and was replaced by direct browser verification.

## Automated checks

npm test: 14 passing tests covering query encoding, filtering, supported audio selection, fresh URLs, cancellation, autoplay errors, HTTP/JSON/API failures, fallback, empty/gated results, denial quarantine, network cooldown and stale cached source handling. Failure tests use controlled responses, not a claim that remote outages were induced.

Local production build passed. Deployment, fresh-clone and Android results are recorded with their final deliverables. Android device installation is not verified by a successful CI build.

## Limits

No complete licensed commercial catalog is bundled. Browser playback depends on remote availability and restrictions. Local uploads are session-only. LocalStorage libraries belong to the current browser/origin; localhost, Netlify and Android have separate libraries. No paid backend or media proxy is deployed.
