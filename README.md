# Lacrimosa Opus Card Scanner

A card scanner application for the board game **[Lacrimosa](https://www.kosmos.de/de/lacrimosa-15498)** by KOSMOS. It scans the Opus cards from the game and automatically plays the corresponding Wolfgang Amadeus Mozart piece.

---

## Table of Contents

- [About the Game](#about-the-game)
- [About This Project](#about-this-project)
- [Audio Tracks](#audio-tracks)
- [Features](#features)
- [How It Works](#how-it-works)
- [Usage](#usage)
- [Opus Card Reference](#opus-card-reference)
- [Contributing](#contributing)
- [License](#license)

---

## About the Game

**Lacrimosa** ([KOSMOS, 2023](https://www.kosmos.de/de/lacrimosa-15498)) is a cooperative board game for 1–4 players set in the final days of Wolfgang Amadeus Mozart's life. Players work together to help Mozart complete his legendary *Requiem in D minor* before his time runs out.

Throughout the game, players draw **Opus cards** — each representing a section or movement of Mozart's compositions. These cards drive the musical narrative of the gameplay.

> More details and a full review can be found on [Brett & Pad](https://brettundpad.de/2023/10/23/lacrimosa/).

---

## About This Project

The **Lacrimosa Opus Card Scanner** is a software companion for the board game. Using a camera (webcam or device camera), it:

1. Recognises an Opus card held up to the camera.
2. Identifies which Mozart piece or Requiem movement the card represents.
3. Plays the corresponding audio track automatically.

This brings the music of Mozart to life at the table without needing a separate device or app, enhancing the immersive atmosphere of the game.

---

## Audio Tracks

Audio tracks are hosted as **GitHub Release assets** and loaded on demand — they are not bundled in the repository. When a card is detected, the matching MP3 is fetched from the release, cached in memory, and played immediately; repeat plays in the same session are instant.

See **[docs/RELEASE-AUDIO.md](docs/RELEASE-AUDIO.md)** for full instructions on uploading audio files, using a custom CDN, and troubleshooting.

---

## Features

- 📷 **Real-time card scanning** via webcam or device camera
- 🎵 **Automatic music playback** of the matching Mozart composition
- 🃏 **Full Opus card library** — every card in the game is mapped to its audio track
- ⏯️ **Playback controls** — play, pause, stop, and volume adjustment
- 🖥️ **Cross-platform** — runs on Windows, macOS, and Linux
- 🌐 **Optional web interface** for mobile or tablet use at the gaming table

---

## How It Works

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Camera feed │────▶│  Card recognition  │────▶│  Audio playback  │
│  (webcam /   │     │  (image processing │     │  (Mozart piece   │
│   device)    │     │   + card ID lookup)│     │   for that card) │
└──────────────┘     └───────────────────┘     └──────────────────┘
```

1. **Capture** – The application opens the camera and captures a continuous video stream.
2. **Detect** – Each frame is analysed to detect a card in the frame (contour / edge detection).
3. **Identify** – The detected card image is compared against the Opus card database using perceptual image hashing. QR/barcode recognition is planned for a future release.
4. **Play** – The matched audio track is loaded and played back through the system's audio output.

---

## Usage

### Start the scanner

```bash
python scanner.py
```

The application will open a camera window. Hold an Opus card up to the camera — once recognised, the corresponding Mozart piece will begin playing automatically.

> **Audio source:** Music playback will be integrated with streaming services such as YouTube, Spotify, or other cloud platforms. The exact integration is yet to be defined.

### Command-line options

| Option | Description | Default |
|---|---|---|
| `--camera` | Camera device index | `0` (first webcam) |
| `--fullscreen` | Launch in fullscreen mode | `false` |
| `--volume` | Playback volume (0.0 – 1.0) | `0.8` |

**Example:**

```bash
python scanner.py --camera 1 --volume 0.6 --fullscreen
```

---

## Opus Card Reference

The table below lists all Opus cards in the game and their corresponding Mozart compositions.

| Card ID | Card Name | Mozart Composition | Movement / Track |
|---|---|---|---|
| OP-01 | Introitus | Requiem in D minor, K. 626 | I. Introitus – Requiem aeternam |
| OP-02 | Kyrie | Requiem in D minor, K. 626 | II. Kyrie |
| OP-03 | Dies Irae | Requiem in D minor, K. 626 | III. Sequenz – Dies irae |
| OP-04 | Tuba Mirum | Requiem in D minor, K. 626 | IV. Sequenz – Tuba mirum |
| OP-05 | Rex Tremendae | Requiem in D minor, K. 626 | V. Sequenz – Rex tremendae |
| OP-06 | Recordare | Requiem in D minor, K. 626 | VI. Sequenz – Recordare |
| OP-07 | Confutatis | Requiem in D minor, K. 626 | VII. Sequenz – Confutatis |
| OP-08 | Lacrimosa | Requiem in D minor, K. 626 | VIII. Sequenz – Lacrimosa |
| OP-09 | Offertorium | Requiem in D minor, K. 626 | IX. Offertorium – Domine Jesu |
| OP-10 | Hostias | Requiem in D minor, K. 626 | X. Offertorium – Hostias |
| OP-11 | Sanctus | Requiem in D minor, K. 626 | XI. Sanctus |
| OP-12 | Benedictus | Requiem in D minor, K. 626 | XII. Benedictus |
| OP-13 | Agnus Dei | Requiem in D minor, K. 626 | XIII. Agnus Dei |
| OP-14 | Lux Aeterna | Requiem in D minor, K. 626 | XIV. Communio – Lux aeterna |
| OP-15 | Symphony No. 40 | Symphony No. 40 in G minor, K. 550 | I. Molto allegro |
| OP-16 | Symphony No. 41 | Symphony No. 41 in C major, K. 551 "Jupiter" | IV. Molto allegro |
| OP-17 | Piano Sonata | Piano Sonata No. 11 in A major, K. 331 | III. Rondo alla Turca |
| OP-18 | Eine Kleine Nacht | Eine kleine Nachtmusik, K. 525 | I. Allegro |

> **Note:** The card-to-composition mappings above are based on the movements of Mozart's *Requiem* and other works referenced in the Lacrimosa game. If you spot an inaccuracy for a specific card in your edition, please open an issue or pull request — contributions to keep this table up to date are very welcome.

---

## Contributing

Contributions are welcome! Whether it's improving card recognition accuracy, adding support for additional card editions, or translating the interface, feel free to open an issue or pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please make sure your code follows the existing style and that tests pass before submitting.

---

## License

This project is released under the [MIT License](LICENSE).

> **Disclaimer:** This software is an unofficial companion tool and is not affiliated with, endorsed by, or produced by KOSMOS. "Lacrimosa" and all related game content are property of KOSMOS Verlags-GmbH & Co. KG. All Mozart compositions referenced are in the public domain.
