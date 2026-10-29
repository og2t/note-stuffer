# Staffy

### ▶ [Open Staffy](https://og2t.github.io/staffy/)

A sight-reading trainer for the piano staff. It shows a note, interval or chord on the staff, you play it, and it measures how fast you answer. Items you know well come up less often; the ones you miss come back sooner, Anki style.

## What it does

- **Sets:** Notes, Intervals, Chords (triads and inversions) and Extended (sus, 6ths, 7ths with inversions, 9ths, 11ths, 13ths), on the treble staff, the bass staff, or both.
- **Input:** the on-screen keyboard, or a MIDI keyboard in Chrome or Edge (Settings → MIDI keyboard). Safari, including on iPad, has no Web MIDI.
- **Gradual unlocking:** new items unlock once the current ones are fast and accurate, with a level-up screen introducing them.
- **Breaks:** a short round summary every 20 answers, with mix-ups and slowest items.
- **Progress:** per-item reaction-time charts, failure rates, and the notes you confuse most.
- **Users:** separate progress per user, for example a Test user next to your own.

Progress is stored in the browser (IndexedDB) and stays on the device. Use Settings → Export progress to back it up or move it to another browser.

## Running locally

```bash
python3 serve.py 8642
```

Then open http://localhost:8642. The server disables caching so edits show up on reload.
