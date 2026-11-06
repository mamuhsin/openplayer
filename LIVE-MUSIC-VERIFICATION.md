# Live music integration — 4 November 2026

Uses official Audius public endpoints: `/v1/tracks/trending`, `/v1/tracks/search`, and `/v1/tracks/{id}/stream`. Only available, streamable, non-gated tracks are displayed. API reference: https://docs.audius.co/api/

REA desktop scenario `ev_c4c9f6451ff24c9a34229ec5cd91a73274e467ae6cb59a3136e4f2e6aad4c41f`: searched guitar, selected Solid Guitar by Pontr0x, and observed real playback advance to 0:06 of 1:54. All scenario actions passed and no console/page errors were captured.

REA mobile scenario `ev_ce26bbb20ea84dc09e4c82631270eef65c5f08180210c937d353ce88d745df3d`: at 390×844, searched Malayalam, played Malayalam songs, expanded the player, toggled shuffle, muted/unmuted, sought using the range input, and saved to Liked Songs. All actions passed. Observed playback at 0:03 of 1:26. One unrelated result artwork host refused a connection; audio playback continued. Search artwork now hides failed images.

Earlier REA notes describe the initial demo version; this update replaces its active synthesized music catalog with real streaming. API availability, content rights and track metadata are controlled by Audius and uploaders; this app does not acquire content from Spotify or YouTube. It does not promise Spotify's catalog or identical service behavior.
