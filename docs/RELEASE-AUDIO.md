# Managing Audio Release Assets

## Overview

The MP3 audio tracks for the 18 Opus cards are **not** stored inside the git repository. Full Mozart movements can easily be 10–30 MB each, making a total of 150–300 MB for all 18 tracks — far too large for a source-code repository.

Instead, the tracks are hosted as assets on a **GitHub Release** and fetched on demand by the browser at runtime. This approach has several advantages:

- **Repo stays small** — no binary blobs in git history.
- **Independent versioning** — audio assets can be updated without touching app code.
- **Free hosting** — GitHub Release assets are free with no egress limits for public repositories.
- **Cache-friendly** — `src/audio/audio-loader.js` caches each downloaded blob as an Object URL in memory, so replaying a track already fetched in the current session is instant.

---

## File Naming Convention

Each MP3 file must be named after the **card ID** it belongs to, with a `.mp3` extension:

```
{cardId}.mp3
```

The card IDs are the `id` fields in `src/data/opus-cards.js`. The full list of expected files is:

| File | Card |
|------|------|
| `OP-01.mp3` | Introitus |
| `OP-02.mp3` | Kyrie |
| `OP-03.mp3` | Dies Irae |
| `OP-04.mp3` | Tuba Mirum |
| `OP-05.mp3` | Rex Tremendae |
| `OP-06.mp3` | Recordare |
| `OP-07.mp3` | Confutatis |
| `OP-08.mp3` | Lacrimosa |
| `OP-09.mp3` | Offertorium |
| `OP-10.mp3` | Hostias |
| `OP-11.mp3` | Sanctus |
| `OP-12.mp3` | Benedictus |
| `OP-13.mp3` | Agnus Dei |
| `OP-14.mp3` | Lux Aeterna |
| `OP-15.mp3` | Symphony No. 40 |
| `OP-16.mp3` | Symphony No. 41 |
| `OP-17.mp3` | Piano Sonata |
| `OP-18.mp3` | Eine Kleine Nacht |

---

## How to Create the Release

You will need the [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated.

1. **Prepare your MP3 files.** Place all 18 files in a local `audio/` directory, named according to the convention above (e.g. `audio/OP-01.mp3`).

2. **Create and tag the release:**

   ```bash
   gh release create audio-v1 \
     --title "Audio tracks v1" \
     --notes "Mozart MP3 audio tracks for Opus cards"
   ```

3. **Upload all MP3 files to the release:**

   ```bash
   gh release upload audio-v1 audio/*.mp3
   ```

The app's default base URL points to the `audio-v1` release tag:

```
https://github.com/MarcMevert/lacrimosa-opus-card-scanner/releases/download/audio-v1
```

So the full URL for a track is, for example:

```
https://github.com/MarcMevert/lacrimosa-opus-card-scanner/releases/download/audio-v1/OP-08.mp3
```

---

## How to Update or Replace Tracks

### Replace a file in an existing release

```bash
gh release upload audio-v1 audio/OP-08.mp3 --clobber
```

The `--clobber` flag overwrites the existing asset with the same name.

### Create a new release version

If you want a clean break (e.g. different recordings, different quality), create a new tag:

```bash
gh release create audio-v2 \
  --title "Audio tracks v2" \
  --notes "Higher quality Mozart MP3s"

gh release upload audio-v2 audio/*.mp3
```

Then update the default base URL in `src/audio/audio-loader.js` from `audio-v1` to `audio-v2`, **or** set the `VITE_AUDIO_BASE_URL` environment variable (see below).

---

## Environment Variable Override

The audio loader reads the base URL from `VITE_AUDIO_BASE_URL` at build time. This lets you point the app at any CDN or object storage bucket without changing source code.

Create (or edit) a `.env` file in the project root:

```dotenv
VITE_AUDIO_BASE_URL=https://your-cdn.example.com/lacrimosa-audio
```

The loader will then fetch tracks from `https://your-cdn.example.com/lacrimosa-audio/{trackId}.mp3`.

Examples of alternative storage backends:

- **Cloudflare R2** — free egress, S3-compatible API, public bucket URL
- **Backblaze B2** — very low cost, works well behind Cloudflare CDN
- **AWS S3 / Azure Blob** — set the bucket's base URL and ensure CORS is configured

> **Note:** If you use a different origin, make sure the server sends an appropriate `Access-Control-Allow-Origin` CORS header so the browser can `fetch()` the files.

---

## Troubleshooting

### CORS errors (`Access to fetch … has been blocked by CORS policy`)

GitHub Release assets are served from `objects.githubusercontent.com`, which **does** set `Access-Control-Allow-Origin: *`. If you see CORS errors with the default URL, check that:

- You are not using a private repository (private release assets require auth tokens, which cannot be used client-side).
- You have not changed the base URL to a server that lacks CORS headers.

### 404 — file not found

- Verify the release tag is exactly `audio-v1` (or whatever tag your `VITE_AUDIO_BASE_URL` points to).
- Check the file exists in the release: `gh release view audio-v1 --json assets`
- Confirm the filename matches the card ID exactly (e.g. `OP-08.mp3`, not `op-08.mp3` or `OP08.mp3`).

### Slow first-play / long loading spinner

Large MP3 files (10–30 MB) can take a few seconds on a slow connection. The app shows a *"Loading …"* status while fetching. Subsequent plays in the same session are instant (the blob is cached in memory).

### Track does not play after loading

Browser autoplay policies may block audio that was not triggered directly by a user gesture. The Lacrimosa scanner triggers playback from the detection loop (a background task), which some browsers block. Clicking the **Play** button manually after a card is detected will always work.
