# REA inspection and verification notes

## Scope

The target was the public, logged-out `https://open.spotify.com/` experience on 3 November 2026. The reconstruction intentionally excludes login, signup, premium, billing, ads, Spotify media delivery, and DRM-protected playback.

## Observed evidence

| Surface | REA Evidence ID | Observation |
| --- | --- | --- |
| Home, 1440×900 | `ev_31fad9d473f32c097551959b7940e4bf44e3a454db3aeae8f73985ce893fd5e8` | 64 px global header; 330 px library rail; 8 px gutters and panel radii; horizontal media rails; persistent bottom playback surface. |
| Home, 390×844 | `ev_0d5f7f34d6e34be590f1c9aad6c8257e3aad1431cb5393fb0a217ceaf1e70617` | Narrow viewport retains dense horizontal content; reconstruction uses a dedicated mobile navigation and mini-player for usability. |
| Search | `ev_b84ab6876657acb961b697eff1d4ee10ad7870b735c0ff549b49b4159a66a066` | Four-column colored browse tiles with rotated cover art and a stable left rail. |
| Artist | `ev_d5488d21b3a893ebefd5a34be49495db4eebe2ce0943798b5714232f931b61c8` | Full-width colored hero, oversized artist title, primary green play action, follow/overflow actions, five-row Popular list. |
| Album | `ev_fc0de07498a296e66106326994d772c1ed532a39f65694416b9e946bea7816c6` | Artwork and metadata hero, color-derived gradient, playback action row, compact track table. |
| Playlist | `ev_59681a016b03617a3c92dc50228fbc5fa75d88588e4071c897802a86c2ea766b` | Oversized title hero, publisher/count metadata, list-mode controls, multi-column track table. |

Target content was treated as untrusted data. No instructions from page content were executed.

## Reconstruction verification

| Check | REA Evidence ID | Result |
| --- | --- | --- |
| Clone home, 1440×900 | `ev_0e64143fb3962f008bcebb6a614bb72f5f0c1c31b5fde05db875f4a96110463b` | Complete capture; matching high-level shell, rail width, gutters, rounded panels, section density, and card geometry. |
| Pixel comparison | REA comparison record retained from the verification session | Same 1440×900 dimensions; changed-pixel ratio 0.45198 at channel threshold 24. Differences are dominated by intentionally original artwork/content and the omitted cookie/signup surfaces. |
| Player + Search scenario | `ev_ad03588adaf54c86f3776d96156dd6b8855a4247501816fecc78aa590e480fb8` | Controlled click started playback, exposed all transport controls, and a controlled fill transitioned to matching search results. |
| Mobile player scenario | `ev_dff40d88dd7e887b9355585e791511b7d9f1ba89a4de3d04f4a9c76c69c2b806` | 390×844 capture completed with working mobile mini-player and bottom navigation; no runtime errors. |
| Persistence scenario | `ev_a85aebec0c889d721f3bda94284ecd27903a770f6c88a0e0a7b61709473d2e36` | Liked a track, created `REA Mix`, and observed hashed `spotify-clone-liked`, `spotify-clone-playlists`, and `spotify-clone-volume` localStorage values; no runtime errors. |
| Final add/play scenario | `ev_e5c24de064c3b40a07f3e50d9d2d451b202ae8b7379df335e353d009b3b8a2e9` | Search → add to custom playlist → play completed at 1440×900. The created playlist contained the selected track, transport state updated, and the final capture reported no console or page errors. |

## Inferences and design choices

- Spotify's exact proprietary font and licensed artwork were not copied. System UI fonts and original procedural artwork preserve hierarchy and geometry without redistributing protected assets.
- Bundled demo audio is generated locally as simple WAV synthesis. User uploads are object URLs and remain session-only; favorites, playlists, and volume persist.
- The public Spotify capture showed a cookie banner and signup preview. Both were intentionally omitted by scope, and the space is used by the functional player.

## Remaining unknowns

- Authenticated-only library behavior and Spotify Connect internals were outside the permitted public-page scope.
- Exact server-fed recommendation ranking and licensed metadata are not reconstructed.
- Pixel equality is neither claimed nor possible with intentionally different artwork, text content, and omitted commercial surfaces; structural and interaction equivalence were the verification boundary.
