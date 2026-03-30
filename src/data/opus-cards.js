/**
 * opus-cards.js
 * Static database of the 18 Opus cards from the Lacrimosa board game.
 *
 * The `hash` field will hold a BigInt dHash value once reference card images
 * have been processed. Until then it is null and identification is disabled.
 *
 * The `audioUrl` field is intentionally null for every card.  Audio tracks are
 * loaded lazily at runtime from GitHub Release assets via `getTrackUrl(card.id)`
 * in `src/audio/audio-loader.js` — see docs/RELEASE-AUDIO.md for details.
 */
export const OPUS_CARDS = [
  {
    id: 'OP-01',
    name: 'Introitus',
    composition: 'Requiem in D minor, K. 626',
    movement: 'I. Introitus – Requiem aeternam',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-02',
    name: 'Kyrie',
    composition: 'Requiem in D minor, K. 626',
    movement: 'II. Kyrie',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-03',
    name: 'Dies Irae',
    composition: 'Requiem in D minor, K. 626',
    movement: 'III. Sequenz – Dies irae',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-04',
    name: 'Tuba Mirum',
    composition: 'Requiem in D minor, K. 626',
    movement: 'IV. Sequenz – Tuba mirum',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-05',
    name: 'Rex Tremendae',
    composition: 'Requiem in D minor, K. 626',
    movement: 'V. Sequenz – Rex tremendae',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-06',
    name: 'Recordare',
    composition: 'Requiem in D minor, K. 626',
    movement: 'VI. Sequenz – Recordare',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-07',
    name: 'Confutatis',
    composition: 'Requiem in D minor, K. 626',
    movement: 'VII. Sequenz – Confutatis',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-08',
    name: 'Lacrimosa',
    composition: 'Requiem in D minor, K. 626',
    movement: 'VIII. Sequenz – Lacrimosa',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-09',
    name: 'Offertorium',
    composition: 'Requiem in D minor, K. 626',
    movement: 'IX. Offertorium – Domine Jesu',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-10',
    name: 'Hostias',
    composition: 'Requiem in D minor, K. 626',
    movement: 'X. Offertorium – Hostias',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-11',
    name: 'Sanctus',
    composition: 'Requiem in D minor, K. 626',
    movement: 'XI. Sanctus',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-12',
    name: 'Benedictus',
    composition: 'Requiem in D minor, K. 626',
    movement: 'XII. Benedictus',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-13',
    name: 'Agnus Dei',
    composition: 'Requiem in D minor, K. 626',
    movement: 'XIII. Agnus Dei',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-14',
    name: 'Lux Aeterna',
    composition: 'Requiem in D minor, K. 626',
    movement: 'XIV. Communio – Lux aeterna',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-15',
    name: 'Symphony No. 40',
    composition: 'Symphony No. 40 in G minor, K. 550',
    movement: 'I. Molto allegro',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-16',
    name: 'Symphony No. 41',
    composition: 'Symphony No. 41 in C major, K. 551 "Jupiter"',
    movement: 'IV. Molto allegro',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-17',
    name: 'Piano Sonata',
    composition: 'Piano Sonata No. 11 in A major, K. 331',
    movement: 'III. Rondo alla Turca',
    audioUrl: null,
    hash: null,
  },
  {
    id: 'OP-18',
    name: 'Eine Kleine Nacht',
    composition: 'Eine kleine Nachtmusik, K. 525',
    movement: 'I. Allegro',
    audioUrl: null,
    hash: null,
  },
];
