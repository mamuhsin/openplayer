# YouTube search and playback

Open the app and select **YouTube**. Pasting a youtube.com/watch, youtu.be, shorts, live, or embed video URL into **YouTube video link** opens the official visible player. A search link opens YouTube search in a separate tab when an API key is not configured. YouTube's player controls manage playback; switching away unmounts it and stops playback. Opening YouTube also pauses Audius audio.

## Enable results inside the app

1. Open https://console.cloud.google.com/apis/library/youtube.googleapis.com and select/create your Google Cloud project.
2. Enable **YouTube Data API v3**.
3. In **APIs & Services → Credentials**, create an API key. Restrict it to **YouTube Data API v3** and **Websites (HTTP referrers)**. For this local preview allow `http://127.0.0.1:4173/*` (or the exact local hostname and port you use). Allow the real production origin before deployment.
4. In the app select **YouTube → Search setup**, paste the key, and save it. The key is kept only in sessionStorage, not in source or the downloadable archive. Do not send it through chat.
5. Enter a song or artist and press **Search**. Enable **Latest uploads first** to order by upload date; this does not guarantee an official release. Results request embeddable videos and show the uploader and upload date.

The app uses the public Data API, not extracted audio or undocumented search endpoints. Search consumes your project's quota. Videos may have ads or be restricted by their owners, region, or YouTube; the app includes a watch-on-YouTube fallback.

Official references: https://developers.google.com/youtube/data/reference/rest/v3/search/list and https://developers.google.com/youtube/player_parameters

## Verification

Production build passed. URL parsing checks cover accepted YouTube URL forms and reject invalid/non-YouTube URLs. REA mobile scenario `ev_a235f609eef2ab20d27d917355e4ee44abb8113cf467b581b92d4b07ca55623e` opened the YouTube tab, entered Google's documented demo video URL, and displayed the official video player playing at 0:02. All actions completed. Live Data API search was not tested because no user API key is configured; it remains dependent on that setup.
