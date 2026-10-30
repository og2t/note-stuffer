'use strict';

// ---------- Music theory ----------
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMI = [0, 2, 4, 5, 7, 9, 11];
const ACC_SYM = { '-1': '♭', '0': '', '1': '♯' };

// d = diatonic step index (octave * 7 + letter); C4 = 28
const mkNote = (d, acc = 0) => ({ d, acc, letter: ((d % 7) + 7) % 7, oct: Math.floor(d / 7) });
const midiOf = n => 12 * (n.oct + 1) + SEMI[n.letter] + n.acc;
const nameOf = n => LETTERS[n.letter] + ACC_SYM[n.acc] + n.oct;
const idName = n => LETTERS[n.letter] + (n.acc > 0 ? '#' : n.acc < 0 ? 'b' : '') + n.oct;

const STAFF = { t: { top: 38, bottom: 30, mid: 34 }, b: { top: 26, bottom: 18, mid: 22 } };
const RANGE = { t: [26, 42], b: [14, 30] };
const ANCHOR = { t: 29.5, b: 22.5 };
const staffFor = d => (d >= 28 ? 't' : 'b');

// Skips E♯, B♯, C♭ and F♭, which beginners rarely meet
const validAcc = (d, a) => {
  const L = ((d % 7) + 7) % 7;
  return !(a === 1 && (L === 2 || L === 6)) && !(a === -1 && (L === 0 || L === 3));
};

// ---------- Item generators ----------
function noteItems(clef, withAcc) {
  const out = [];
  for (const s of clef === 'g' ? ['t', 'b'] : [clef]) {
    const [lo, hi] = RANGE[s];
    for (let d = lo; d <= hi; d++) {
      if (clef === 'g' && staffFor(d) !== s) continue;
      for (const a of withAcc ? [0, 1, -1] : [0]) {
        const n = mkNote(d, a);
        if (!validAcc(d, a)) continue;
        out.push({
          id: `n:${s}:${idName(n)}`, staff: s, notes: [{ ...n, s }],
          label: nameOf(n), short: nameOf(n),
          order: Math.abs(d - ANCHOR[s]) + (a ? 1000 : 0) + (s === 'b' ? 0.25 : 0) + d * 1e-3,
        });
      }
    }
  }
  return out;
}

const INTERVAL_NAME = ['unison', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'octave', 'ninth', 'tenth'];
const INTERVAL_PRI = [0, 4, 0, 3, 1, 5, 6, 2, 6, 6];

function intervalItem(a, b, s, sa, sb, accA = 0, accB = 0) {
  const na = { ...mkNote(a, accA), s: sa }, nb = { ...mkNote(b, accB), s: sb };
  return {
    id: `i:${s}:${idName(na)}-${idName(nb)}`, staff: s, notes: [na, nb],
    label: `${nameOf(na)} and ${nameOf(nb)}, a ${INTERVAL_NAME[b - a]}`,
    short: `${nameOf(na)} ${nameOf(nb)}`,
  };
}

// A sharpened or flattened note on the lower or upper note; these come after every natural pair
const ACC_VARIANTS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

function intervalItems(clef, withAcc) {
  const out = [];
  const variants = withAcc ? ACC_VARIANTS : [[0, 0]];
  const push = (a, b, s, sa, sb, base) => {
    for (const [x, y] of variants) {
      if (!validAcc(a, x) || !validAcc(b, y)) continue;
      const it = intervalItem(a, b, s, sa, sb, x, y);
      it.order = base + (x || y ? 1000 : 0);
      out.push(it);
    }
  };
  for (const s of clef === 'g' ? ['t', 'b'] : [clef]) {
    const [lo, hi] = RANGE[s];
    for (let a = lo; a <= hi; a++) for (let k = 1; k <= 7; k++) {
      const b = a + k;
      if (b > hi) continue;
      if (clef === 'g' && (staffFor(a) !== s || staffFor(b) !== s)) continue;
      push(a, b, s, s, s, Math.abs((a + b) / 2 - ANCHOR[s]) + INTERVAL_PRI[k] * 1.5 + (s === 'b' ? 0.25 : 0));
    }
  }
  if (clef === 'g') {
    for (let a = 20; a <= 27; a++) for (let b = 28; b <= 34; b++) {
      if (b - a < 2 || b - a > 9) continue;
      push(a, b, 'g', 'b', 't', 8 + Math.abs((a + b) / 2 - 27.5) + INTERVAL_PRI[b - a]);
    }
  }
  return out;
}

const ROOTS = [[0, 0], [3, 0], [4, 0], [1, 0], [5, 0], [2, 0], [6, 0], [6, -1], [2, -1], [5, -1], [1, -1], [3, 1]];
const QUAL = { maj: [4, 7], min: [3, 7], dim: [3, 6] };
const QUAL_NAME = { maj: 'major', min: 'minor', dim: 'diminished' };
const QUAL_SHORT = { maj: '', min: 'm', dim: '°' };
const DIATONIC = new Set(['0:0:maj', '1:0:min', '2:0:min', '3:0:maj', '4:0:maj', '5:0:min', '6:0:dim']);
const INV_NAME = ['root position', 'first inversion', 'second inversion'];
const INV_FIG = ['', '⁶', '⁶₄'];
const INV_HINT = [
  'Root position: three notes stacked neatly on lines or on spaces.',
  'First inversion: the wider gap (a fourth) is on top.',
  'Second inversion: the wider gap (a fourth) is at the bottom.',
];

function spellTriad(L, acc, q) {
  const rootSemi = SEMI[L] + acc;
  const tone = (off, semis) => {
    const l = L + off;
    const nat = SEMI[l % 7] + 12 * Math.floor(l / 7);
    return { off, acc: rootSemi + semis - nat };
  };
  const [i3, i5] = QUAL[q];
  return [{ off: 0, acc }, tone(2, i3), tone(4, i5)];
}

function chordItems(clef) {
  const out = [];
  const staves = clef === 'g' ? ['t', 'b'] : [clef];
  ROOTS.forEach(([L, acc], ri) => {
    for (const q of ['maj', 'min', 'dim']) {
      if (q === 'dim' && !(L === 6 && acc === 0)) continue;
      const tones = spellTriad(L, acc, q);
      if (tones.some(t => Math.abs(t.acc) > 1)) continue;
      const diatonic = DIATONIC.has(`${L}:${acc}:${q}`);
      for (let inv = 0; inv < 3; inv++) {
        const voicing = [tones[0], tones[1], tones[2], { off: 7, acc: tones[0].acc }, { off: 9, acc: tones[1].acc }].slice(inv, inv + 3);
        for (const s of staves) {
          let best = null;
          for (let oct = 1; oct <= 6; oct++) {
            const ds = voicing.map(v => oct * 7 + L + v.off);
            if (ds[0] < RANGE[s][0] || ds[2] > RANGE[s][1]) continue;
            const dist = Math.abs((ds[0] + ds[2]) / 2 - STAFF[s].mid);
            if (!best || dist < best.dist) best = { ds, dist };
          }
          if (!best) continue;
          const notes = best.ds.map((d, i) => ({ ...mkNote(d, voicing[i].acc), s }));
          const root = LETTERS[L] + ACC_SYM[acc];
          const tier = diatonic ? (inv === 0 ? 0 : 1) : (inv === 0 ? 2 : 3);
          out.push({
            id: `c:${s}:${root}${q}${inv}`, staff: s, notes, inv,
            label: `${root} ${QUAL_NAME[q]}, ${INV_NAME[inv]}`,
            short: `${root}${QUAL_SHORT[q]}${INV_FIG[inv]}`, hint: INV_HINT[inv],
            order: tier * 100 + ri * 3 + (q === 'min' ? 1 : 0) + (s === 'b' ? 0.5 : 0) + inv * 0.1,
          });
        }
      }
    }
  });
  return out;
}

// Extended chords, root position only: [symbol, long name, [letter offset, semitones] above the root, hint, tier]
const EXT = [
  ['sus2', 'suspended 2nd', [[1, 2], [4, 7]], 'sus2: the third drops to the second, so the bottom two notes are a step apart.', 0],
  ['sus4', 'suspended 4th', [[3, 5], [4, 7]], 'sus4: the third rises to the fourth, so the top two notes are a step apart.', 0],
  ['7sus4', 'seventh, suspended 4th', [[3, 5], [4, 7], [6, 10]], '7sus4: a sus4 with the minor seventh on top.', 2],
  ['6', 'sixth', [[2, 4], [4, 7], [5, 9]], 'Sixth: a major triad with the sixth a step above the fifth.', 2],
  ['m6', 'minor sixth', [[2, 3], [4, 7], [5, 9]], 'Minor sixth: a minor triad with the major sixth a step above the fifth.', 2],
  ['maj7', 'major seventh', [[2, 4], [4, 7], [6, 11]], 'Seventh chords: four notes stacked in thirds, all on lines or all on spaces.', 1],
  ['7', 'dominant seventh', [[2, 4], [4, 7], [6, 10]], 'Dominant seventh: major triad plus a minor seventh.', 1],
  ['m7', 'minor seventh', [[2, 3], [4, 7], [6, 10]], 'Minor seventh: minor triad plus a minor seventh.', 1],
  ['m7♭5', 'half-diminished', [[2, 3], [4, 6], [6, 10]], 'Half-diminished: diminished triad plus a minor seventh.', 2],
  ['°7', 'diminished seventh', [[2, 3], [4, 6], [6, 9]], 'Diminished seventh: minor thirds all the way up.', 2],
  ['add9', 'added ninth', [[2, 4], [4, 7], [8, 14]], 'add9: a major triad plus the ninth, with no seventh.', 3],
  ['m(add9)', 'minor added ninth', [[2, 3], [4, 7], [8, 14]], 'm(add9): a minor triad plus the ninth, with no seventh.', 3],
  ['maj9', 'major ninth', [[2, 4], [4, 7], [6, 11], [8, 14]], 'Ninth chords: five notes stacked in thirds.', 4],
  ['9', 'dominant ninth', [[2, 4], [4, 7], [6, 10], [8, 14]], 'Dominant ninth: a dominant seventh with the ninth on top.', 4],
  ['m9', 'minor ninth', [[2, 3], [4, 7], [6, 10], [8, 14]], 'Minor ninth: a minor seventh with the ninth on top.', 4],
  ['11', 'eleventh', [[4, 7], [6, 10], [8, 14], [10, 17]], 'Eleventh, voiced without the third: root, fifth, seventh, ninth, eleventh.', 5],
  ['m11', 'minor eleventh', [[2, 3], [6, 10], [8, 14], [10, 17]], 'Minor eleventh, voiced without the fifth: root, third, seventh, ninth, eleventh.', 5],
  ['13', 'thirteenth', [[2, 4], [6, 10], [12, 21]], 'Thirteenth shell: root, third, seventh and thirteenth.', 5],
];

// Seventh chords that also get inversions; tier offset places them after the root positions
const INVERTIBLE = new Set(['maj7', '7', 'm7', 'm7♭5']);
const INV7_NAME = ['', 'first inversion', 'second inversion', 'third inversion'];
const INV7_HINT = [
  '',
  'First inversion: third in the bass; the seventh and root make a step at the top.',
  'Second inversion: fifth in the bass; the seventh and root make a step in the middle.',
  'Third inversion: seventh in the bass; the seventh and root make a step at the bottom.',
];

function extItems(clef) {
  const out = [];
  const staves = clef === 'g' ? ['t', 'b'] : [clef];
  ROOTS.forEach(([L, acc], ri) => {
    const rootSemi = SEMI[L] + acc;
    const root = LETTERS[L] + ACC_SYM[acc];
    for (const [sym, long, tones, hint, tier] of EXT) {
      const base = [{ off: 0, acc }, ...tones.map(([off, semis]) => {
        const l = L + off;
        return { off, acc: rootSemi + semis - (SEMI[l % 7] + 12 * Math.floor(l / 7)) };
      })];
      if (base.some(v => Math.abs(v.acc) > 1)) continue;
      const invs = INVERTIBLE.has(sym) ? [0, 1, 2, 3] : [0];
      for (const inv of invs) {
        // Move the lowest `inv` tones up an octave
        const voicing = [...base.slice(inv), ...base.slice(0, inv).map(v => ({ ...v, off: v.off + 7 }))];
        const bass = LETTERS[(L + voicing[0].off) % 7] + ACC_SYM[voicing[0].acc];
        const name = inv ? `${root}${sym}/${bass}` : `${root}${sym}`;
        for (const s of staves) {
          let best = null;
          for (let oct = 1; oct <= 6; oct++) {
            const ds = voicing.map(v => oct * 7 + L + v.off);
            if (ds[0] < RANGE[s][0] || ds.at(-1) > RANGE[s][1]) continue;
            const dist = Math.abs((ds[0] + ds.at(-1)) / 2 - STAFF[s].mid);
            if (!best || dist < best.dist) best = { ds, dist };
          }
          if (!best) continue;
          const notes = best.ds.map((d, i) => ({ ...mkNote(d, voicing[i].acc), s }));
          out.push({
            id: `x:${s}:${root}${sym}${inv ? 'i' + inv : ''}`, staff: s, hint: inv ? INV7_HINT[inv] : hint,
            notes,
            label: inv ? `${name}, ${long}, ${INV7_NAME[inv]}` : `${name}, ${long}`, short: name,
            order: (notes.some(n => n.acc) ? 1000 : 0) + (tier + (inv ? 1.5 : 0)) * 100 + ri * 0.5 + inv * 0.1
              + EXT.findIndex(e => e[0] === sym) * 0.01 + (s === 'b' ? 0.25 : 0),
          });
        }
      }
    }
  });
  return out;
}

// ---------- Persistence (IndexedDB, falling back to localStorage) ----------
const DB = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('notestaffer', 2);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
          if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { autoIncrement: true }).createIndex('u', 'u');
        };
        r.onsuccess = () => {
          this.db = r.result;
          // Let a newer version open in another tab
          this.db.onversionchange = () => this.db.close();
          res();
        };
        r.onerror = () => res();
      } catch { res(); }
    });
  },
  get(k) {
    return new Promise(res => {
      if (!this.db) { try { res(JSON.parse(localStorage.getItem('ns:' + k))); } catch { res(undefined); } return; }
      const q = this.db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(undefined);
    });
  },
  set(k, v) {
    if (!this.db) { try { localStorage.setItem('ns:' + k, JSON.stringify(v)); } catch {} return; }
    try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch {}
  },
  // Answer log: one record per answer, kept for learning curves
  logAdd(rec) {
    if (!this.db) { try { const a = JSON.parse(localStorage.getItem('ns:log') || '[]'); a.push(rec); localStorage.setItem('ns:log', JSON.stringify(a)); } catch {} return; }
    try { this.db.transaction('log', 'readwrite').objectStore('log').add(rec); } catch {}
  },
  logFor(u) {
    return new Promise(res => {
      if (!this.db) { try { res(JSON.parse(localStorage.getItem('ns:log') || '[]').filter(r => r.u === u)); } catch { res([]); } return; }
      const q = this.db.transaction('log').objectStore('log').index('u').getAll(u);
      q.onsuccess = () => res(q.result);
      q.onerror = () => res([]);
    });
  },
  logClear(u) {
    return new Promise(res => {
      if (!this.db) { try { localStorage.setItem('ns:log', JSON.stringify(JSON.parse(localStorage.getItem('ns:log') || '[]').filter(r => r.u !== u))); } catch {} res(); return; }
      const tx = this.db.transaction('log', 'readwrite');
      const cur = tx.objectStore('log').index('u').openKeyCursor(IDBKeyRange.only(u));
      cur.onsuccess = () => { const c = cur.result; if (c) { tx.objectStore('log').delete(c.primaryKey); c.continue(); } };
      tx.oncomplete = tx.onerror = () => res();
    });
  },
  del(k) {
    if (!this.db) { try { localStorage.removeItem('ns:' + k); } catch {} return; }
    try { this.db.transaction('kv', 'readwrite').objectStore('kv').delete(k); } catch {}
  },
};

const DEFAULT_SETTINGS = { v: 2, mode: 'notes', clef: 't', sound: true, midiSound: true, octave: true, acc: true, labels: false, all: false };
const S = { settings: { ...DEFAULT_SETTINGS }, cards: {}, unlock: {}, days: {} };

// Each user's data lives under its own key prefix; the first user keeps the original unprefixed keys
let users = { list: [{ id: 'default', name: 'Me' }], current: 'default' };
const userKey = (k, id = users.current) => (id === 'default' ? k : `${id}:${k}`);

let saveTimer;
function flushSave() {
  clearTimeout(saveTimer);
  for (const k of Object.keys(S)) DB.set(userKey(k), S[k]);
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

async function loadUser(id) {
  users.current = id;
  DB.set('users', users);
  const keepLook = { dark: S.settings.dark, sound: S.settings.sound, midiSound: S.settings.midiSound };
  S.settings = { ...DEFAULT_SETTINGS }; S.cards = {}; S.unlock = {}; S.days = {};
  let found = false;
  for (const k of Object.keys(S)) {
    const v = await DB.get(userKey(k));
    if (v) { found = true; S[k] = k === 'settings' ? { ...S.settings, ...v } : v; }
  }
  // A brand-new user starts with the previous user's look and sound preferences
  if (!found) Object.assign(S.settings, keepLook);
  // Settings saved before v2 had sharps and flats off by default
  if (S.settings.v !== 2) { S.settings.v = 2; S.settings.acc = true; save(); }
  recent = [];
  $('#trace').innerHTML = '';
  applyTheme();
  syncHeader();
  renderUsers();
  rebuild();
}

// ---------- Spaced-repetition engine ----------
const INITIAL = { notes: 4, intervals: 4, chords: 3, ext: 3 };
const STEP = { notes: 2, intervals: 3, chords: 2, ext: 2 };
const DAY = 864e5;

const keyFor = (mode, clef) => `${mode}:${clef}${(mode === 'notes' || mode === 'intervals') && S.settings.acc ? ':acc' : ''}`;
const setKey = () => keyFor(S.settings.mode, S.settings.clef);

function genItems(mode, clef) {
  const acc = S.settings.acc;
  const gen = { notes: () => noteItems(clef, acc), intervals: () => intervalItems(clef, acc), chords: () => chordItems(clef), ext: () => extItems(clef) };
  return gen[mode]()
    .sort((a, b) => a.order - b.order);
}
const frontier = (mode, clef) => S.unlock[keyFor(mode, clef)] ?? INITIAL[mode];

// Unlocked items: everything before the frontier, plus items already learned in another set
function poolOf(mode, clef, list) {
  if (S.settings.all) return list;
  const k = frontier(mode, clef);
  return list.filter((it, i) => i < k || (S.cards[it.id]?.n ?? 0) >= 2);
}

function eff(c) {
  if (!c) return 0;
  return c.m * Math.exp(-(Date.now() - c.t) / DAY / c.s);
}

function quality(ok, rt, k) {
  if (!ok) return 0;
  const fast = 1500 + 900 * (k - 1), slow = 5000 + 2500 * (k - 1);
  return Math.max(0.3, Math.min(1, 1 - 0.7 * (rt - fast) / (slow - fast)));
}

// Answers since the last level-up, shown on the level-up screen
const newRound = () => ({ n: 0, ok: 0, rts: [], answers: [] });
let round = newRound(), lastRound = null, roundNo = 0;

// Untimed answers (after a pause) count for accuracy only; their time is kept out of all speed stats
const UNTIMED_Q = 0.5;

function record(item, ok, rt, wrong = null, untimed = false) {
  const timed = ok && !untimed;
  round.n++;
  if (ok) round.ok++;
  if (timed) round.rts.push(rt);
  round.answers.push({ item, ok, rt, timed, wrong });
  DB.logAdd({
    u: users.current, t: Date.now(), id: item.id, mode: S.settings.mode, clef: S.settings.clef,
    ok, rt: Math.round(rt), wrong, src: inputSrc, octave: S.settings.octave, idle: untimed,
  });
  if (!ok) rt = 0;
  const q = ok && untimed ? UNTIMED_Q : quality(ok, rt, item.notes.length);
  const c = S.cards[item.id] || { m: 0, s: 0.5, n: 0, ok: 0, rt: 0, t: Date.now() };
  c.m = c.n === 0 ? q * 0.8 : c.m * 0.5 + q * 0.5;
  c.s = ok && q >= 0.6 ? Math.min(365, c.s * (1.6 + q)) : Math.max(0.25, c.s * 0.4);
  c.n++;
  if (ok) c.ok++;
  if (timed) { c.rt = c.rt ? c.rt * 0.7 + rt * 0.3 : rt; c.last = Math.round(rt); }
  c.t = Date.now();
  S.cards[item.id] = c;

  const day = new Date().toISOString().slice(0, 10);
  const dd = S.days[day] || (S.days[day] = { n: 0, ok: 0, rts: [] });
  dd.n++;
  if (ok) dd.ok++;
  if (timed) { dd.rts.push(Math.round(rt)); if (dd.rts.length > 400) dd.rts.shift(); }
  save();
}

let items = [], pool = [], current = null, history = [], relearn = [], picks = 0;

function rebuild() {
  const { mode, clef } = S.settings;
  items = genItems(mode, clef);
  pool = poolOf(mode, clef, items);
  history = []; relearn = [];
  round = newRound(); lastRound = null; roundNo = 0;
  buildKeyboard();
  next();
}

function pick() {
  picks++;
  const dueIdx = relearn.findIndex(r => r.due <= picks);
  if (dueIdx >= 0) {
    const { id } = relearn.splice(dueIdx, 1)[0];
    const it = pool.find(i => i.id === id);
    if (it) return it;
  }
  const recent = new Set(history.slice(-Math.min(2, pool.length - 1)));
  const weights = pool.map(it => {
    if (recent.has(it.id)) return 0;
    const c = S.cards[it.id];
    return c && c.n >= 2 ? (1 - eff(c)) ** 2 + 0.04 : 1.2;
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// Progress toward the next unlock: mean of the three conditions, each capped at 1
function unlockStatus(p, total) {
  if (S.settings.all || p.length >= total) return null;
  const cs = p.map(i => S.cards[i.id]);
  const effs = cs.map(eff);
  const pending = cs.filter(c => !c || c.n < 2).length;
  const avg = effs.reduce((a, b) => a + b, 0) / effs.length;
  const weakest = effs.indexOf(Math.min(...effs));
  const parts = [
    [1 - pending / p.length, `answer ${pending === 1 ? '1 more item' : pending + ' more items'} twice`],
    [avg / 0.7, 'answer a little faster overall'],
    [effs[weakest] / 0.45, `practise ${p[weakest].short}`],
  ].map(([f, hint]) => [Math.min(1, f), hint]);
  const frac = parts.reduce((a, [f]) => a + f, 0) / parts.length;
  const blocker = parts.reduce((a, b) => (b[0] < a[0] ? b : a));
  return { frac, hint: blocker[1] };
}

function maybeUnlock() {
  const st = unlockStatus(pool, items.length);
  if (!st || st.frac < 1) return null;
  const { mode, clef } = S.settings;
  const have = new Set(pool.map(i => i.id));
  let k = frontier(mode, clef), fresh = [];
  while (k < items.length && fresh.length < STEP[mode]) {
    if (!have.has(items[k].id)) fresh.push(items[k]);
    k++;
  }
  S.unlock[setKey()] = k;
  pool = poolOf(mode, clef, items);
  save();
  return fresh;
}

// ---------- Staff rendering ----------
const HS = 6, W = 300, NOTE_X = 172;

function geometry(clef) {
  // The last CAPTION_H units hold the caption shown under the staff
  if (clef === 'g') return { tops: { t: 44, b: 152 }, H: 236 + CAPTION_H };
  return { tops: { [clef]: 44 }, H: 132 + CAPTION_H };
}

function yOf(d, s, g) { return g.tops[s] + (STAFF[s].top - d) * HS; }

const CAPTION_H = 14;

function drawStaff(item, state, caption = '') {
  $('#staff').innerHTML = staffSVG(item, state, caption, S.settings.clef, true);
}

// Letter names for every line and space, shown while peeking
function cheatSVG(clef, g) {
  let svg = '<g class="cheat" aria-hidden="true">';
  for (const s of Object.keys(g.tops)) {
    const [lo, hi] = RANGE[s];
    const { top, bottom } = STAFF[s];
    for (let d = lo; d <= hi; d++) {
      if (clef === 'g' && staffFor(d) !== s) continue;
      const y = yOf(d, s, g), line = (d - bottom) % 2 === 0, x = NOTE_X + (line ? 44 : 60);
      if (line && (d > top || d < bottom)) svg += `<line class="ghost" x1="${NOTE_X + 39}" x2="${NOTE_X + 55}" y1="${y}" y2="${y}"/>`;
      const L = ((d % 7) + 7) % 7;
      svg += `<text x="${x}" y="${y + 2.9}">${LETTERS[L]}${L === 0 ? Math.floor(d / 7) : ''}</text>`;
    }
  }
  return svg + '</g>';
}

function staffSVG(item, state, caption, clef, cheat = false) {
  const g = geometry(clef);
  let svg = `<svg viewBox="0 0 ${W} ${g.H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Staff">`;
  svg += '<g class="lines">';
  const staves = Object.keys(g.tops);
  for (const s of staves) for (let i = 0; i < 5; i++) {
    const y = g.tops[s] + i * 2 * HS;
    svg += `<line x1="6" x2="${W - 6}" y1="${y}" y2="${y}"/>`;
  }
  const yTop = Math.min(...staves.map(s => g.tops[s]));
  const yBot = Math.max(...staves.map(s => g.tops[s] + 8 * HS));
  svg += `<line x1="6" x2="6" y1="${yTop}" y2="${yBot}"/><line x1="${W - 6}" x2="${W - 6}" y1="${yTop}" y2="${yBot}"/>`;
  svg += '</g>';
  for (const s of staves) {
    const top = g.tops[s];
    svg += s === 't'
      ? `<text class="clef" x="12" y="${top + 6 * HS + 4}" font-size="54">𝄞</text>`
      : `<text class="clef" x="14" y="${top + 42}" font-size="48">𝄢</text>`;
  }

  if (item) {
    const cls = state || '';
    svg += `<g class="notes ${cls}">`;
    const ledgers = new Map();
    const heads = [];
    for (const s of ['t', 'b']) {
      const ns = item.notes.filter(n => n.s === s).sort((a, b) => a.d - b.d);
      let prevOffset = false;
      ns.forEach((n, i) => {
        const offset = i > 0 && n.d - ns[i - 1].d === 1 && !prevOffset;
        prevOffset = offset;
        const x = NOTE_X + (offset ? 16 : 0);
        heads.push({ n, x, y: yOf(n.d, s, g) });
        const { top, bottom } = STAFF[s];
        const add = L => {
          const key = s + L, cur = ledgers.get(key);
          ledgers.set(key, { y: yOf(L, s, g), x0: Math.min(cur?.x0 ?? 1e9, x - 13), x1: Math.max(cur?.x1 ?? -1e9, x + 13) });
        };
        for (let L = top + 2; L <= n.d; L += 2) add(L);
        for (let L = bottom - 2; L >= n.d; L -= 2) add(L);
      });
    }
    for (const l of ledgers.values()) svg += `<line class="ledger" x1="${l.x0}" x2="${l.x1}" y1="${l.y}" y2="${l.y}"/>`;

    const cols = [];
    heads.filter(h => h.n.acc).sort((a, b) => a.y - b.y).forEach(h => {
      let c = 0;
      while ((cols[c] || []).some(y => Math.abs(y - h.y) < 30)) c++;
      (cols[c] = cols[c] || []).push(h.y);
      const glyph = h.n.acc > 0 ? '♯' : '♭';
      const dy = h.n.acc > 0 ? 7 : 4;
      svg += `<text class="accid ${cls}" x="${NOTE_X - 16 - c * 10}" y="${h.y + dy}" font-size="22" text-anchor="middle">${glyph}</text>`;
    });
    for (const h of heads) {
      svg += `<g class="head ${cls}" transform="translate(${h.x} ${h.y})"><ellipse rx="8.4" ry="5.8"/><ellipse class="hole" rx="4.4" ry="3" transform="rotate(-35)"/></g>`;
    }
    svg += '</g>';
  }
  if (caption) {
    const text = caption.replace(/[&<>]/g, '').replace(/[♯♭]/g, a => `<tspan class="acc">${a}</tspan>`);
    const lowest = Math.max(yBot, ...(item ? item.notes.map(n => yOf(n.d, n.s, g)) : []));
    svg += `<text class="caption ${state || ''}" x="${NOTE_X}" y="${lowest + 20}" text-anchor="middle">${text}</text>`;
  }
  return svg + (cheat ? cheatSVG(clef, g) : '') + '</svg>';
}

// ---------- On-screen keyboard ----------
const KEY_MIN = 20, KEY_GAP = 3;
const PC_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const midiName = m => PC_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const keyEls = new Map();

function buildKeyboard() {
  const all = items.flatMap(i => i.notes.map(midiOf));
  let lo = Math.min(...all), hi = Math.max(...all);
  lo -= lo % 12;
  // End on the white key just above a black top note so it has a neighbour
  if ([1, 3, 6, 8, 10].includes(hi % 12)) hi++;
  const kb = $('#kb');
  kb.innerHTML = '';
  keyEls.clear();
  const whites = [];
  for (let m = lo; m <= hi; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) whites.push(m);
  // Must equal the white keys' minimum widths plus gaps, or black keys drift
  kb.style.minWidth = `${whites.length * KEY_MIN + (whites.length - 1) * KEY_GAP}px`;
  const names = PC_NAMES;
  const label = m => {
    const oct = Math.floor(m / 12) - 1;
    if (m % 12 === 0) return 'C' + oct;
    return S.settings.labels ? names[m % 12] : '';
  };
  whites.forEach(m => {
    const el = document.createElement('div');
    el.className = 'w';
    el.textContent = label(m);
    el.dataset.m = m;
    kb.appendChild(el);
    keyEls.set(m, el);
  });
  const ww = 100 / whites.length;
  whites.forEach((m, i) => {
    if (![1, 3, 6, 8, 10].includes((m + 1) % 12) || m + 1 > hi) return;
    const el = document.createElement('div');
    el.className = 'k';
    el.textContent = S.settings.labels ? names[(m + 1) % 12] : '';
    el.dataset.m = m + 1;
    el.style.left = `calc((100% + 3px) * ${(i + 1) / whites.length} - 1.5px - ${ww * 0.3}%)`;
    el.style.width = `${ww * 0.6}%`;
    kb.appendChild(el);
    keyEls.set(m + 1, el);
  });
  sizeKeyboard();
  // Scroll so middle C region is visible on narrow screens
  const wrap = $('#kbwrap');
  const c4 = keyEls.get(60) || keyEls.get(48);
  if (c4 && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = c4.offsetLeft - wrap.clientWidth / 2;
}

// Key height follows white-key width so proportions stay piano-like
function sizeKeyboard() {
  const n = $('#kb').querySelectorAll('.w').length;
  if (!n) return;
  const ww = Math.max(KEY_MIN, ($('#kbwrap').clientWidth - 24) / n);
  document.documentElement.style.setProperty('--kb-h', `${Math.round(Math.min(200, Math.max(100, ww * 4.2)))}px`);
}
window.addEventListener('resize', sizeKeyboard);

$('#kb').addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-m]');
  if (!el) return;
  e.preventDefault();
  el.classList.add('down');
  setTimeout(() => el.classList.remove('down'), 140);
  onKey(+el.dataset.m);
});

// ---------- MIDI input ----------
const held = new Set();
let midiAccess = null;

function onMidiMessage(e) {
  const [st, note, vel] = e.data;
  const cmd = st & 0xf0;
  const el = keyEls.get(note);
  if (cmd === 0x90 && vel > 0) {
    // Any key continues from the level-up screen, after a short pause against accidental presses
    const brk = document.querySelector('dialog.level[open]');
    if (brk) { if (Date.now() - levelOpenedAt > 900) brk.close(); return; }
    held.add(note);
    el?.classList.add('down');
    onKey(note, true);
    if (S.settings.midiSound) tone(note, vel / 127);
  } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
    held.delete(note);
    el?.classList.remove('down');
    // Releasing an incomplete chord lets you try it again from scratch
    if (!held.size && phase === 'ask' && sel.size) { sel.clear(); paintKeys(); }
  }
}

function midiStatus(text, state) {
  $('#midiStatus').textContent = text;
  $('#midiRow').dataset.state = state;
}

function bindMidi() {
  const inputs = [...midiAccess.inputs.values()];
  inputs.forEach(i => { i.onmidimessage = onMidiMessage; });
  const was = $('#midiRow').dataset.state === 'on';
  if (inputs.length) {
    midiStatus(`Connected: ${inputs.map(i => i.name).join(', ')}`, 'on');
    if (!was && !$('#setDlg').open) setSub(`MIDI connected: ${inputs[0].name}`);
  } else {
    midiStatus('No device found. Plug in your keyboard and it connects automatically.', 'wait');
  }
  $('#midiBtn').hidden = inputs.length > 0;
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) return;
  try {
    midiAccess = await navigator.requestMIDIAccess();
    midiAccess.onstatechange = bindMidi;
    bindMidi();
  } catch {
    midiStatus('Access was blocked. Allow MIDI in the browser’s site settings, then try again.', 'off');
  }
}

$('#midiBtn').addEventListener('click', () => (midiAccess ? bindMidi() : connectMidi()));

// Reconnect silently when the browser already granted MIDI access
(async () => {
  if (!navigator.requestMIDIAccess) {
    midiStatus('Not available in this browser. Use Chrome or Edge on a computer; iPad Safari has no MIDI.', 'na');
    $('#midiBtn').hidden = true;
    return;
  }
  try {
    const p = await navigator.permissions?.query({ name: 'midi' });
    if (p?.state === 'granted') connectMidi();
  } catch {}
})();

// ---------- Sound ----------
let ac, soundHintShown = false;

// Browsers only start audio after a click, tap or key press on the page
function unlockAudio() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch {}
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { capture: true }));

function tone(m, vel = 0.75) {
  try {
    if (!ac || ac.state !== 'running') {
      unlockAudio();
      if (ac?.state !== 'running' && !soundHintShown) {
        soundHintShown = true;
        setSub('Click or tap the page once to turn on sound.');
      }
    }
    const f = 440 * 2 ** ((m - 69) / 12), t = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06 + 0.24 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
    g.connect(ac.destination);
    for (const [h, type, a] of [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12], [4, 'sine', 0.05]]) {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type; o.frequency.value = f * h; og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + 1.7);
    }
  } catch {}
}

// ---------- Question loop ----------
let phase = 'ask', shownAt = 0, sel = new Set(), recent = [];

const matches = (a, b) => (S.settings.octave ? a === b : (a - b) % 12 === 0);
const targets = () => current.notes.map(midiOf);
const covered = () => targets().every(t => [...sel].some(m => matches(m, t)));

const PROMPT = { notes: 'Play this note', intervals: 'Play both notes', chords: 'Play the chord', ext: 'Play the chord' };

function next() {
  current = pick();
  history.push(current.id);
  phase = 'ask';
  sel.clear();
  paintKeys();
  drawStaff(current);
  setMsg(PROMPT[S.settings.mode], history.length <= 3 ? 'Hold Shift or Space, or touch the staff, to see note names.' : '');
  shownAt = performance.now();
  idle = false;
  armIdle();
  if (peeking) markPeeked();
}

// ---------- Peek: hold Shift or Space, or touch the staff, to see note names ----------
let peeking = false;
function setPeek(on) {
  if (on === peeking) return;
  peeking = on;
  $('#staff').classList.toggle('peek', on);
  if (on) markPeeked();
}
function markPeeked() {
  if (phase !== 'ask' || idle) return;
  idle = true;
  clearTimeout(idleTimer);
  setSub('Peeked: this answer won’t count toward your speed.');
}
const peekKey = e => (e.key === 'Shift' || e.code === 'Space') && !document.querySelector('dialog[open]') && !e.target.closest?.('input, textarea');
document.addEventListener('keydown', e => {
  if (!peekKey(e)) return;
  if (e.code === 'Space') e.preventDefault();
  setPeek(true);
});
document.addEventListener('keyup', e => { if (e.key === 'Shift' || e.code === 'Space') setPeek(false); });
window.addEventListener('blur', () => setPeek(false));
$('#staff').addEventListener('pointerdown', e => { e.preventDefault(); setPeek(true); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('#staff').addEventListener(ev, () => setPeek(false)));

// ---------- Idle pause ----------
let idle = false, idleTimer;
// Slightly longer than the slowest scored time, so a slow read still counts as timed
const idleLimit = () => 5000 + 2500 * (current.notes.length - 1) + 3000;

function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(goIdle, idleLimit());
}
function goIdle() {
  if (phase !== 'ask' || idle) return;
  idle = true;
  clearTimeout(idleTimer);
  setMsg('Paused', 'Take your time. This answer won’t count toward your speed.', 'muted');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) goIdle(); });

// All note input (on-screen keys now, MIDI later) goes through here
let inputSrc = 'screen';

function onKey(m, fromMidi = false) {
  inputSrc = fromMidi ? 'midi' : 'screen';
  if (!fromMidi && S.settings.sound) tone(m);
  if (phase === 'done') return;
  const isTarget = targets().some(t => matches(m, t));
  if (phase === 'ask') {
    if (!idle) armIdle();
    if (sel.has(m)) { if (!fromMidi) { sel.delete(m); paintKeys(); } return; }
    if (!isTarget) return fail(m);
    sel.add(m);
    paintKeys();
    if (covered()) succeed();
  } else if (phase === 'fix') {
    if (!isTarget) { flashWrong(m); return; }
    sel.add(m);
    paintKeys();
    if (covered()) { phase = 'done'; setTimeout(afterAnswer, 350); }
  }
}

function succeed() {
  const rt = performance.now() - shownAt;
  phase = 'done';
  clearTimeout(idleTimer);
  record(current, true, rt, null, idle);
  if (!idle) pushTrace(true, rt);
  drawStaff(current, 'good');
  const isChord = !!current.hint;
  const fresh = maybeUnlock();
  setMsg(current.label, current.hint || '', 'good', idle ? 'untimed' : rt);
  if (fresh) { setTimeout(() => showLevelUp(fresh), 700); return; }
  setTimeout(afterAnswer, isChord ? 1600 : S.settings.mode === 'intervals' ? 1000 : 550);
}

// ---------- Level-up break ----------
let levelOpenedAt = 0;
const levelOf = () => 1 + Math.ceil((frontier(S.settings.mode, S.settings.clef) - INITIAL[S.settings.mode]) / STEP[S.settings.mode]);
const NEW_WORD = { notes: ['note', 'notes'], intervals: ['interval', 'intervals'], chords: ['chord', 'chords'], ext: ['chord', 'chords'] };

function showLevelUp(fresh) {
  const mode = S.settings.mode;
  const word = NEW_WORD[mode][fresh.length === 1 ? 0 : 1];
  $('#lvlNum').textContent = `Level ${levelOf()}`;
  $('#lvlNew').textContent = `${fresh.length} new ${word} to learn`;
  $('#lvlCards').innerHTML = fresh.map((it, i) =>
    `<button type="button" class="lvl-card" data-i="${i}" title="Play it">${staffSVG(it, '', '', it.staff).replace(`viewBox="0 0 ${W} `, `viewBox="0 0 ${NOTE_X + 46} `)}<span>${it.label.replace(/[♯♭]/g, a => `<span class="acc">${a}</span>`)}</span></button>`
  ).join('');
  $('#lvlCards').onclick = e => {
    const b = e.target.closest('.lvl-card');
    if (b) fresh[+b.dataset.i].notes.forEach((n, j) => setTimeout(() => tone(midiOf(n)), j * 90));
  };
  const acc = round.n ? Math.round((100 * round.ok) / round.n) : 0;
  $('#lvlStats').innerHTML = [
    [round.n, 'answers this round'],
    [`${acc}%`, 'right'],
    [round.rts.length ? (median(round.rts) / 1000).toFixed(2) + ' s' : '–', 'median time'],
    [`${pool.length}/${items.length}`, 'unlocked'],
  ].map(([b, t]) => `<div><b>${b}</b><span>${t}</span></div>`).join('');
  round = newRound();
  levelOpenedAt = Date.now();
  $('#levelDlg').showModal();
}

$('#levelDlg').addEventListener('close', () => next());

// ---------- Round break every ROUND_LEN answers ----------
const ROUND_LEN = 20;

function afterAnswer() {
  if (round.n >= ROUND_LEN) showRoundBreak(); else next();
}

const accSpan = t => t.replace(/[♯♭]/g, a => `<span class="acc">${a}</span>`);

function showRoundBreak() {
  roundNo++;
  const acc = Math.round((100 * round.ok) / round.n);
  const med = round.rts.length ? median(round.rts) : null;
  const delta = (v, prev, fmt, better) => {
    if (prev == null || v == null) return '';
    const d = v - prev;
    if (Math.abs(d) < 1e-9) return '<em class="same">same as last round</em>';
    return `<em class="${better(d) ? 'up' : 'down'}">${fmt(d)} vs last round</em>`;
  };
  $('#rndNum').textContent = `Round ${roundNo} done`;
  $('#rndAcc').textContent = `${acc}% right`;
  $('#rndStats').innerHTML = [
    [`${round.ok}/${round.n}`, 'right', delta(acc, lastRound?.acc, d => `${d > 0 ? '+' : '−'}${Math.abs(d)}%`, d => d > 0)],
    [med ? (med / 1000).toFixed(2) + ' s' : '–', 'median time', delta(med, lastRound?.med, d => `${d > 0 ? '+' : '−'}${(Math.abs(d) / 1000).toFixed(2)} s`, d => d < 0)],
  ].map(([b, t, e]) => `<div><b>${b}</b><span>${t}</span>${e}</div>`).join('');

  // Confusions this round: what was asked and what was played instead
  const mix = {};
  for (const a of round.answers) if (!a.ok && a.wrong != null) {
    const k = `${a.item.short}|${midiName(a.wrong)}`;
    mix[k] = (mix[k] || 0) + 1;
  }
  const mixed = Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 4);
  // Slowest timed answers, one per item
  const slow = new Map();
  for (const a of round.answers) if (a.timed && (!slow.has(a.item.id) || slow.get(a.item.id).rt < a.rt)) slow.set(a.item.id, a);
  const slowest = [...slow.values()].sort((a, b) => b.rt - a.rt).slice(0, 3);

  $('#rndMixed').innerHTML = mixed.length
    ? '<h3>Mixed up</h3>' + mixed.map(([k, n]) => { const [want, got] = k.split('|'); return `<p><b>${accSpan(want)}</b> you played ${accSpan(got)}${n > 1 ? ` <span class="x">${n}×</span>` : ''}</p>`; }).join('')
    : '<h3>Mixed up</h3><p class="none">No mix-ups this round.</p>';
  $('#rndSlow').innerHTML = slowest.length
    ? '<h3>Slowest</h3>' + slowest.map(a => `<p><b>${accSpan(a.item.short)}</b> ${(a.rt / 1000).toFixed(2)} s</p>`).join('')
    : '';
  lastRound = { acc, med };
  round = newRound();
  levelOpenedAt = Date.now();
  $('#roundDlg').showModal();
}

$('#roundDlg').addEventListener('close', () => next());

function fail(m) {
  phase = 'fix';
  clearTimeout(idleTimer);
  record(current, false, performance.now() - shownAt, m, idle);
  pushTrace(false, 5000);
  relearn.push({ id: current.id, due: picks + 3 });
  drawStaff(current, 'bad', `It's ${current.label}`);
  flashWrong(m);
  sel.clear();
  paintKeys(true);
  const what = current.notes.length === 1 ? current.label : 'the marked keys';
  setMsg(`You played ${midiName(m)}`,
    `${current.hint ? current.hint + ' ' : ''}Play ${what} to continue.`, 'bad');
}

function flashWrong(m) {
  const el = keyEls.get(m);
  if (!el) return;
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 450);
}

function paintKeys(showHint = phase === 'fix') {
  const t = current ? targets() : [];
  for (const [m, el] of keyEls) {
    el.classList.toggle('sel', sel.has(m));
    el.classList.toggle('hint', showHint && t.includes(m) && !sel.has(m));
  }
}

// ---------- Feedback UI ----------
function $(q) { return document.querySelector(q); }

function setMsg(text, sub, cls = '', rt) {
  const el = $('#msg');
  el.className = 'msg ' + cls;
  el.innerHTML = text.replace(/[♯♭]/g, a => `<span class="acc">${a}</span>`);
  if (rt != null) {
    const span = document.createElement('span');
    span.className = 'rt';
    span.textContent = typeof rt === 'number' ? (rt / 1000).toFixed(2) + ' s' : rt;
    el.appendChild(span);
  }
  setSub(sub);
  renderToday();
}
function setSub(t) { $('#sub').textContent = t || ' '; }

function pushTrace(ok, rt) {
  recent.push({ ok, rt });
  if (recent.length > 32) recent.shift();
  $('#trace').innerHTML = recent
    .map(r => `<i class="${r.ok ? '' : 'bad'}" style="height:${Math.max(3, Math.min(22, (r.rt / 5000) * 22))}px"></i>`)
    .join('');
}

const today = () => S.days[new Date().toISOString().slice(0, 10)] || { n: 0, ok: 0, rts: [] };
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

const UNIT = { notes: 'notes', intervals: 'intervals', chords: 'chords', ext: 'chords' };

function renderNext() {
  const st = unlockStatus(pool, items.length);
  const el = $('#next');
  if (!st) {
    el.innerHTML = S.settings.all ? '' : `All ${items.length} ${UNIT[S.settings.mode]} in this set are unlocked`;
    return;
  }
  const pct = Math.floor(st.frac * 100);
  el.innerHTML = `<span class="nbar"><i style="width:${pct}%"></i></span>`
    + `${pct}% of the way to ${STEP[S.settings.mode]} new ${UNIT[S.settings.mode]}. Next step: ${st.hint}.`;
}

function renderToday() {
  renderNext();
  const d = today();
  $('#today').textContent = d.n
    ? `${d.n} today, ${Math.round((100 * d.ok) / d.n)}% right, median ${(median(d.rts) / 1000).toFixed(2)} s`
    : '';
}

function applyTheme() {
  document.documentElement.dataset.theme = S.settings.dark ? 'dark' : 'light';
}

// ---------- Header controls ----------
function syncHeader() {
  document.querySelectorAll('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === S.settings.mode));
  document.querySelectorAll('#clefSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.clef === S.settings.clef));
}
$('#modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.settings.mode = b.dataset.mode; save(); syncHeader(); rebuild();
});
$('#clefSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.settings.clef = b.dataset.clef; save(); syncHeader(); rebuild();
});

// ---------- Settings ----------
$('#setBtn').addEventListener('click', () => {
  document.querySelectorAll('[data-set]').forEach(i => { i.checked = !!S.settings[i.dataset.set]; });
  $('#dataNote').textContent = `${currentUser().name}’s progress is saved in this browser only. Export to back up or to move it to another device. Import and Reset replace it.`;
  $('#setDlg').showModal();
});
document.querySelectorAll('[data-set]').forEach(i => i.addEventListener('change', () => {
  S.settings[i.dataset.set] = i.checked;
  save();
  if (['acc', 'all'].includes(i.dataset.set)) rebuild();
  if (i.dataset.set === 'labels') { buildKeyboard(); paintKeys(); }
  if (i.dataset.set === 'dark') applyTheme();
}));

// ---------- Index of all sets ----------
const MODES = [['notes', 'Notes'], ['intervals', 'Intervals'], ['chords', 'Chords'], ['ext', 'Extended']];
const CLEFS = [['t', 'Treble'], ['b', 'Bass'], ['g', 'Both']];

$('#indexBtn').addEventListener('click', () => {
  let html = '<table class="index"><thead><tr><th></th>' + CLEFS.map(([, n]) => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
  for (const [mode, mName] of MODES) {
    html += `<tr><th>${mName}</th>`;
    for (const [clef] of CLEFS) {
      const list = genItems(mode, clef);
      const p = poolOf(mode, clef, list);
      const k = p.length;
      const known = list.filter(i => eff(S.cards[i.id]) >= 0.7).length;
      const st = unlockStatus(p, list.length);
      const here = mode === S.settings.mode && clef === S.settings.clef;
      const w = n => ((100 * n) / list.length).toFixed(1);
      html += `<td><button type="button" class="cell${here ? ' here' : ''}" data-mode="${mode}" data-clef="${clef}">`
        + `<span class="big">${known}<span class="of">/${list.length}</span></span>`
        + `<span class="meter"><i class="u" style="width:${w(k)}%"></i><i class="k" style="width:${w(known)}%"></i></span>`
        + `<span class="cap">${k} unlocked${st ? `, next ${Math.floor(st.frac * 100)}%` : ''}</span>`
        + '</button></td>';
    }
    html += '</tr>';
  }
  $('#indexBody').innerHTML = html + '</tbody></table>';
  $('#indexDlg').showModal();
});

$('#indexBody').addEventListener('click', e => {
  const b = e.target.closest('.cell');
  if (!b) return;
  S.settings.mode = b.dataset.mode;
  S.settings.clef = b.dataset.clef;
  save(); syncHeader(); rebuild();
  $('#indexDlg').close();
});

// ---------- Progress ----------
const STAFF_NAME = { t: 'Treble', b: 'Bass', g: 'Across both staves' };

let statLog = new Map();

$('#statsBtn').addEventListener('click', async () => {
  // Group the answer log by item for the charts and the confusion list
  statLog = new Map();
  for (const r of await DB.logFor(users.current)) {
    if (!statLog.has(r.id)) statLog.set(r.id, []);
    statLog.get(r.id).push(r);
  }
  renderConfused();
  hidePop();
  const d = today();
  const all = Object.values(S.cards);
  const known = items.filter(i => eff(S.cards[i.id]) >= 0.7).length;
  $('#nums').innerHTML = [
    [d.n, 'answers today'],
    [d.n ? Math.round((100 * d.ok) / d.n) + '%' : '–', 'right today'],
    [d.rts.length ? (median(d.rts) / 1000).toFixed(2) + ' s' : '–', 'median time today'],
    [`${known}/${items.length}`, 'known in this set'],
    [all.length, 'items seen overall'],
  ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');

  const unlocked = new Set(pool.map(i => i.id));
  const groups = {};
  for (const it of items) (groups[it.staff] = groups[it.staff] || []).push(it);
  $('#chips').innerHTML = Object.entries(groups).map(([s, list]) => {
    const chips = list.map(it => {
      const e = eff(S.cards[it.id]);
      const lock = unlocked.has(it.id) ? '' : ' locked';
      const style = lock ? '' : `background:color-mix(in srgb, var(--accent) ${Math.round(e * 100)}%, var(--track));${e > 0.5 ? 'color:#fff' : ''}`;
      return `<button type="button" class="chip${lock}" style="${style}" data-id="${it.id}" aria-label="${it.label}">${it.short}</button>`;
    }).join('');
    return `<div class="group">${Object.keys(groups).length > 1 ? `<h3>${STAFF_NAME[s]}</h3>` : ''}<div class="chips">${chips}</div></div>`;
  }).join('');
  $('#statsDlg').showModal();
});

// ---------- Progress: confusions and per-item charts ----------
const itemById = id => items.find(i => i.id === id);

function renderConfused() {
  const pairs = {};
  for (const [id, rs] of statLog) {
    const it = itemById(id);
    if (!it) continue;
    for (const r of rs) if (!r.ok && r.wrong != null) {
      const k = `${id}|${midiName(r.wrong)}`;
      pairs[k] = (pairs[k] || 0) + 1;
    }
  }
  const top = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $('#confused').innerHTML = top.length
    ? '<h3>Most confused in this set</h3><div class="conf-list">' + top.map(([k, n]) => {
      const [id, got] = k.split('|');
      return `<button type="button" class="conf" data-id="${id}"><b>${accSpan(itemById(id).short)}</b><span>played as ${accSpan(got)}</span><i>${n}×</i></button>`;
    }).join('') + '</div>'
    : '';
}

const fmtWhen = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// One-axis chart of reaction time per attempt; misses marked, with a rolling median trend
function itemChart(rs) {
  const W = 300, H = 120, L = 30, R = 8, T = 8, B = 16;
  const n = rs.length;
  const x = i => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const secs = rs.map(r => r.rt / 1000);
  const sorted = [...secs].sort((a, b) => a - b);
  const top = Math.min(15, Math.max(2, Math.ceil(sorted[Math.floor(sorted.length * 0.95)] || 2)));
  const y = v => T + (1 - Math.min(v, top) / top) * (H - T - B);
  let g = '';
  for (const v of [0, top / 2, top]) {
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${+v.toFixed(1)} s</text>`;
  }
  // Rolling median of the last 5 timed right answers
  const timed = rs.map((r, i) => ({ r, i })).filter(o => o.r.ok && !o.r.idle);
  const trend = timed.map((o, j) => {
    const win = timed.slice(Math.max(0, j - 4), j + 1).map(p => p.r.rt / 1000);
    return `${x(o.i).toFixed(1)},${y(median(win)).toFixed(1)}`;
  });
  if (trend.length > 1) g += `<polyline class="trend" points="${trend.join(' ')}"/>`;
  rs.forEach((r, i) => {
    const cls = !r.ok ? 'miss' : r.idle ? 'untimed' : 'ok';
    g += `<circle class="pt ${cls}" cx="${x(i)}" cy="${y(r.rt / 1000)}" r="${r.ok ? 3 : 3.5}"/>`;
  });
  g += `<line class="cursor" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart">${g}</svg>`, x, n };
}

function showPop(id, anchor) {
  const it = itemById(id);
  if (!it) return;
  const rs = (statLog.get(id) || []).slice().sort((a, b) => a.t - b.t);
  const pop = $('#itemPop');
  const head = `<div class="pop-head"><b>${accSpan(it.label)}</b><button type="button" class="pop-x" aria-label="Close">×</button></div>`;
  if (!rs.length) {
    pop.innerHTML = head + '<p class="pop-empty">No answers yet. It shows up here once you have practised it.</p>';
  } else {
    const pct = list => Math.round((100 * list.filter(r => !r.ok).length) / list.length);
    const medOf = list => { const t = list.filter(r => r.ok && !r.idle).map(r => r.rt); return t.length ? (median(t) / 1000).toFixed(2) + ' s' : '–'; };
    const last = rs.slice(-10);
    const played = {};
    for (const r of rs) if (!r.ok && r.wrong != null) played[midiName(r.wrong)] = (played[midiName(r.wrong)] || 0) + 1;
    const playedTop = Object.entries(played).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const ch = itemChart(rs);
    pop.innerHTML = head
      + `<div class="pop-stats">
          <div><b>${rs.length}</b><span>attempts</span></div>
          <div><b>${pct(rs)}%</b><span>failed overall</span></div>
          <div><b>${pct(last)}%</b><span>failed, last ${last.length}</span></div>
          <div><b>${medOf(last)}</b><span>median, last ${last.length}</span></div>
        </div>`
      + `<p class="readout" id="readout">Reaction time per attempt, oldest to newest. Hover or touch for details.</p>`
      + ch.svg
      + `<div class="pop-legend"><span><i class="ok"></i>right</span><span><i class="miss"></i>missed</span><span><i class="untimed"></i>untimed</span><span><i class="trend"></i>trend</span></div>`
      + (playedTop.length ? `<p class="pop-played">Usually played instead: ${playedTop.map(([nm, c]) => `<b>${accSpan(nm)}</b> ${c}×`).join(', ')}</p>` : '');
    const svg = pop.querySelector('.chart'), cursor = svg.querySelector('.cursor');
    const pts = svg.querySelectorAll('.pt');
    const pick = e => {
      const r = svg.getBoundingClientRect();
      const vx = ((e.clientX - r.left) / r.width) * 300;
      let best = 0;
      for (let i = 1; i < ch.n; i++) if (Math.abs(ch.x(i) - vx) < Math.abs(ch.x(best) - vx)) best = i;
      const a = rs[best];
      cursor.setAttribute('x1', ch.x(best)); cursor.setAttribute('x2', ch.x(best)); cursor.setAttribute('visibility', 'visible');
      pts.forEach((p, i) => p.classList.toggle('on', i === best));
      const what = !a.ok ? `missed, played ${midiName(a.wrong)}` : a.idle ? 'right, untimed' : 'right';
      $('#readout').innerHTML = `<b>${fmtWhen(a.t)}</b> ${(a.rt / 1000).toFixed(2)} s, ${accSpan(what)}`;
    };
    svg.addEventListener('pointermove', pick);
    svg.addEventListener('pointerdown', pick);
  }
  // Place the popover next to the chip, kept inside the viewport
  const a = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  pop.hidden = false;
  // Shrink the chart until the whole popover fits the window height
  const chart = pop.querySelector('.chart');
  if (chart) {
    chart.style.width = '';
    const over = pop.offsetHeight - (vh - 16);
    // Narrow it in proportion so the hover mapping and the dots stay undistorted
    if (over > 0) chart.style.width = `${Math.max(60, chart.getBoundingClientRect().height - over) * 300 / 120}px`;
  }
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const left = Math.max(8, Math.min(a.left + a.width / 2 - pw / 2, vw - pw - 8));
  let top = a.bottom + 8;
  if (top + ph > vh - 8) top = a.top - ph - 8 >= 8 ? a.top - ph - 8 : Math.max(8, vh - ph - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.dataset.id = id;
}

function hidePop() { $('#itemPop').hidden = true; }

$('#statsDlg').addEventListener('pointerover', e => {
  const c = e.target.closest('.chip[data-id], .conf');
  const pop = $('#itemPop');
  if (c && e.pointerType === 'mouse' && (pop.hidden || pop.dataset.id !== c.dataset.id)) showPop(c.dataset.id, c);
});
$('#statsDlg').addEventListener('click', e => {
  if (e.target.closest('.pop-x')) { hidePop(); return; }
  const c = e.target.closest('.chip[data-id], .conf');
  if (c) { e.preventDefault(); showPop(c.dataset.id, c); return; }
  if (!e.target.closest('#itemPop')) hidePop();
});

$('#exportBtn').addEventListener('click', async () => {
  const log = (await DB.logFor(users.current)).map(({ u, ...r }) => r);
  const blob = new Blob([JSON.stringify({ app: 'notestaffer', v: 2, user: currentUser().name, ...S, log })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `notestuffer-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'notestaffer') throw new Error();
    for (const k of Object.keys(S)) if (data[k]) S[k] = data[k];
    if (Array.isArray(data.log)) {
      await DB.logClear(users.current);
      for (const r of data.log) DB.logAdd({ ...r, u: users.current });
    }
    save(); applyTheme(); syncHeader(); rebuild();
    $('#setDlg').close();
  } catch { alert('This file is not a NoteStuffer progress export.'); }
  e.target.value = '';
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm(`Erase all progress for ${currentUser().name}? Export first if you want a backup.`)) return;
  S.cards = {}; S.unlock = {}; S.days = {}; recent = [];
  DB.logClear(users.current);
  $('#trace').innerHTML = '';
  save(); rebuild();
  $('#setDlg').close();
});

// Close dialogs by tapping the backdrop
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

// ---------- Users ----------
const currentUser = () => users.list.find(u => u.id === users.current) || users.list[0];

function renderUsers() {
  $('#userName').textContent = currentUser().name;
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('#userMenu').innerHTML =
    users.list.map(u => `<button type="button" role="menuitemradio" aria-checked="${u.id === users.current}" data-user="${u.id}">${esc(u.name)}</button>`).join('')
    + '<hr><button type="button" data-act="add">+ Add user</button>'
    + '<button type="button" data-act="rename">Rename current user</button>'
    + (users.list.length > 1 ? '<button type="button" data-act="delete" class="danger">Delete current user</button>' : '');
}

function toggleUserMenu(open) {
  const m = $('#userMenu');
  m.hidden = !(open ?? m.hidden);
  $('#userBtn').setAttribute('aria-expanded', !m.hidden);
}

$('#userBtn').addEventListener('click', e => { e.stopPropagation(); toggleUserMenu(); });
document.addEventListener('pointerdown', e => {
  if (!$('#userMenu').hidden && !e.target.closest('#userMenu, #userBtn')) toggleUserMenu(false);
});

$('#userMenu').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  toggleUserMenu(false);
  flushSave();
  if (b.dataset.user) {
    if (b.dataset.user !== users.current) await loadUser(b.dataset.user);
    return;
  }
  const act = b.dataset.act;
  if (act === 'add') {
    const name = prompt('Name for the new user (e.g. Test):', 'Test')?.trim();
    if (!name) return;
    const id = 'u' + Date.now().toString(36);
    users.list.push({ id, name });
    await loadUser(id);
  } else if (act === 'rename') {
    const name = prompt('New name:', currentUser().name)?.trim();
    if (!name) return;
    currentUser().name = name;
    DB.set('users', users);
    renderUsers();
  } else if (act === 'delete') {
    const u = currentUser();
    if (!confirm(`Delete ${u.name} and all of their progress on this device?`)) return;
    for (const k of Object.keys(S)) DB.del(userKey(k, u.id));
    DB.logClear(u.id);
    users.list = users.list.filter(x => x.id !== u.id);
    await loadUser(users.list[0].id);
  }
});

// ---------- Boot ----------
(async () => {
  await DB.open();
  const u = await DB.get('users');
  if (u?.list?.length) users = u;
  await loadUser(users.list.some(x => x.id === users.current) ? users.current : users.list[0].id);
  if (document.fonts) document.fonts.ready.then(() => drawStaff(current, phase === 'ask' ? '' : undefined));
})();
