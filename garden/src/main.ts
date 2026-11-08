import './ui/styles.css';
import { LANDMARK_NAMES, FLOWER_NAMES, Split, TaskId, houseLevelFor, splitFor, tasksFor } from './data/config';
import { addDays, prettyDate, todayKey } from './data/dates';
import { State, inventory, isWon, store, weatherFor, wonDays } from './data/store';
import { Metric, chartData, garden, groupInventory, hud, progress, today, workout, MAX_BACK_DAYS } from './ui/panels';
import { World } from './world/world';
import { sound } from './audio';
import { resolveTime } from './world/environment';
import { seasonFor, type Season } from './world/seasons';
import type { Weather } from './world/weather';

type Tab = 'today' | 'workout' | 'progress' | 'garden';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
  tab: 'today' as Tab,
  day: todayKey(),
  split: null as Split | null,
  exId: 'leg-press',
  metric: 'e1rm' as Metric,
  placingToken: null as string | null,
};

// ---------- World ----------

// Optional preview overrides, e.g. ?season=winter&weather=storm
const params = new URLSearchParams(location.search);
const seasonNow = (): Season =>
  (params.get('season') as Season) ||
  (store.state.settings.season === 'live' ? seasonFor() : store.state.settings.season);
const weatherNow = (): Weather => (params.get('weather') as Weather) || weatherFor(store.state, todayKey());

let world: World | null = null;
try {
  world = new World($('world'), {
    quality: store.state.settings.quality,
    startLines: ['Day one', prettyDate(store.state.startDate), 'The day I woke up.'],
  });
  world.setSeason(seasonNow());
  world.setWeather(weatherNow(), store.state.settings.timeOfDay, true);
  world.onLightning = (c) => sound.thunder(c);
  world.setHouseLevel(houseLevelFor(wonDays(store.state).length));
  world.sync(store.state.placed);
} catch (err) {
  console.error(err);
  $('world').innerHTML = '<div style="padding:120px 24px;text-align:center;color:#c9c5b8">3D is not available on this device, but your tasks and workouts still work.</div>';
}

// keep the "live" light in step with the clock
setInterval(() => {
  world?.setTime(store.state.settings.timeOfDay);
  if (world && world.season !== seasonNow()) world.setSeason(seasonNow());
}, 60_000);

// ---------- Sound ----------

sound.setEnabled(store.state.settings.sound);
const unlockAudio = () => {
  if (store.state.settings.sound) sound.unlock();
};
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('touchend', unlockAudio, true);
document.addEventListener('visibilitychange', () => (document.hidden ? sound.suspend() : sound.resume()));
setInterval(() => {
  if (!world) return;
  const d = world.waterDistances();
  sound.setScene({
    tod: resolveTime(store.state.settings.timeOfDay),
    season: world.season,
    weather: world.weather,
    waterfall: d.waterfall,
    pond: d.pond,
  });
}, 300);

// ---------- Sheet ----------

const sheet = $('sheet');
const setSheet = (state: 'peek' | 'open' | 'hidden') => (sheet.dataset.state = state);
$('grabber').addEventListener('click', () => setSheet(sheet.dataset.state === 'open' ? 'peek' : 'open'));

// swipe the grabber/tabs area up or down
let swipeY: number | null = null;
for (const el of [$('grabber'), $('tabs')]) {
  el.addEventListener('touchstart', (e) => (swipeY = e.touches[0].clientY), { passive: true });
  el.addEventListener('touchend', (e) => {
    if (swipeY == null) return;
    const dy = e.changedTouches[0].clientY - swipeY;
    if (dy < -30) setSheet('open');
    if (dy > 30) setSheet('peek');
    swipeY = null;
  });
}

$('tabs').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button[data-tab]') as HTMLElement | null;
  if (!b) return;
  setTab(b.dataset.tab as Tab);
  setSheet('open');
});

function setTab(t: Tab) {
  ui.tab = t;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.tab === t));
  render(true);
  $('panel').scrollTop = 0;
}

// ---------- Rendering ----------

function render(force = false) {
  const s = store.state;
  $('hud-status').innerHTML = hud(s);
  const active = document.activeElement as HTMLElement | null;
  const typing = active && $('panel').contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  if (typing && !force) return;
  const panel = $('panel');
  switch (ui.tab) {
    case 'today':
      panel.innerHTML = today(s, ui.day);
      break;
    case 'workout':
      panel.innerHTML = workout(s, ui.day, ui.split);
      break;
    case 'progress':
      panel.innerHTML = progress(s, ui.exId, ui.metric);
      drawChart();
      break;
    case 'garden':
      panel.innerHTML = garden(s);
      break;
  }
}

function drawChart() {
  const svg = document.getElementById('chart') as SVGSVGElement | null;
  if (!svg) return;
  const data = chartData(ui.exId, ui.metric);
  const W = svg.clientWidth || 320;
  const H = 200;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const vals = data.map((d) => d.v);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    lo -= 5;
    hi += 5;
  }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.15);
  hi += span * 0.15;
  const x = (i: number) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  const grid = ticks
    .map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(243,239,228,.1)"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#8f8c82">${Math.round(v)}</text>`)
    .join('');
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join('');
  const area = data.length > 1 ? `${path}L${x(data.length - 1)},${H - pad.b}L${x(0)},${H - pad.b}Z` : '';
  const best = Math.max(...vals);
  const pts = data
    .map(
      (d, i) =>
        `<circle cx="${x(i)}" cy="${y(d.v)}" r="${d.v === best ? 5 : 4}" fill="${d.v === best ? '#e6c77c' : '#b7cf98'}" stroke="#1b2219" stroke-width="2"/>
         <circle cx="${x(i)}" cy="${y(d.v)}" r="18" fill="transparent" data-pt="${i}"/>`,
    )
    .join('');
  const first = data[0];
  const lastD = data[data.length - 1];
  svg.innerHTML = `
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b7cf98" stop-opacity=".25"/><stop offset="1" stop-color="#b7cf98" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    ${area ? `<path d="${area}" fill="url(#g)"/>` : ''}
    <path d="${path}" fill="none" stroke="#b7cf98" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <text x="${pad.l}" y="${H - 6}" font-size="11" fill="#8f8c82">${first.date.slice(5)}</text>
    ${data.length > 1 ? `<text x="${W - pad.r}" y="${H - 6}" font-size="11" fill="#8f8c82" text-anchor="end">${lastD.date.slice(5)}</text>` : ''}
    ${pts}`;
  const tip = document.getElementById('chart-tip');
  svg.addEventListener('click', (e) => {
    const t = (e.target as Element).closest('[data-pt]');
    if (!t || !tip) return;
    const d = data[Number(t.getAttribute('data-pt'))];
    tip.textContent = `${d.label}  →  ${d.v}`;
  });
  if (tip && data.length > 1) {
    const diff = lastD.v - first.v;
    tip.textContent = `${diff >= 0 ? '+' : ''}${Math.round(diff * 10) / 10} since ${prettyDate(first.date)}. Tap a point for details.`;
  }
}

// ---------- Panel interactions ----------

function toast(msg: string, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout((t as any)._h);
  (t as any)._h = setTimeout(() => (t.hidden = true), ms);
}

function celebrate(day: string) {
  const s = store.state;
  const n = wonDays(s).filter((k) => k <= day).length;
  const tok = inventory(s).find((t) => t.token === `w:${n}`) ?? inventory(s).find((t) => t.kind !== 'flower');
  const lvlBefore = houseLevelFor(wonDays(s).length - 1);
  const lvlAfter = houseLevelFor(wonDays(s).length);
  const el = $('celebrate');
  el.innerHTML = `<div class="inner">
      <h1>Day won.</h1>
      <p>You did exactly what you said you would.<br>
      ${tok ? `A <b>${LANDMARK_NAMES[tok.kind as keyof typeof LANDMARK_NAMES].toLowerCase()}</b> is ready to plant` : 'Your garden grows'}${lvlAfter > lvlBefore ? ', and <b>your house just grew</b>.' : '.'}</p>
      <button class="btn primary block" data-go-garden>Go plant it</button>
      <button class="btn ghost block" style="margin-top:8px" data-close>Later</button>
    </div>`;
  el.hidden = false;
}

$('celebrate').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-go-garden]')) {
    $('celebrate').hidden = true;
    setTab('garden');
    setSheet('open');
  } else if (t.closest('[data-close]') || t === $('celebrate')) {
    $('celebrate').hidden = true;
  }
});

function setTask(day: string, id: TaskId, value: boolean) {
  const before = isWon(store.state, day);
  store.setTask(day, id, value);
  const after = isWon(store.state, day);
  if (!before && after) {
    celebrate(day);
    sound.chime('win');
  }
  else if (value) toast(`+1 ${FLOWER_NAMES[taskFlower(id)].toLowerCase()} to plant`);
}

function taskFlower(id: TaskId) {
  return ({ workout: 'poppy', clean: 'daisy', coffee: 'lavender', kzbb: 'sunflower', jumbo: 'cornflower', reflect: 'foxglove', walk: 'tulip' } as const)[id];
}

const panel = $('panel');

panel.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => t.closest(sel) as T | null;

  const task = q('[data-task]');
  if (task) {
    const id = task.dataset.task as TaskId;
    setTask(ui.day, id, !store.day(ui.day).done[id]);
    return;
  }
  const dayBtn = q('[data-day]');
  if (dayBtn) {
    const next = addDays(ui.day, Number(dayBtn.dataset.day));
    if (next <= todayKey() && next >= addDays(todayKey(), -MAX_BACK_DAYS)) {
      ui.day = next;
      ui.split = null;
      render(true);
    }
    return;
  }
  const go = q('[data-goto]');
  if (go) return setTab(go.dataset.goto as Tab);

  const sp = q('[data-split]');
  if (sp) {
    ui.split = sp.dataset.split as Split;
    store.ensureSession(ui.day, ui.split);
    render(true);
    return;
  }
  const copy = q('[data-copy]');
  if (copy) {
    const exId = copy.dataset.copy!;
    const last = store.lastFor(exId, ui.day);
    const split = ui.split ?? store.session(ui.day)?.split ?? splitFor(ui.day);
    if (last && split) {
      store.ensureSession(ui.day, split);
      last.sets.forEach((st, i) => {
        store.setSet(ui.day, exId, i, 'weight', st.weight);
        store.setSet(ui.day, exId, i, 'reps', st.reps);
      });
      render(true);
    }
    return;
  }
  if (q('[data-finish]')) {
    const split = ui.split ?? store.session(ui.day)?.split ?? splitFor(ui.day);
    if (!split) return;
    store.ensureSession(ui.day, split);
    store.update((s) => {
      s.sessions[ui.day].finished = true;
    });
    if (tasksFor(ui.day).includes('workout') && !store.day(ui.day).done.workout) setTask(ui.day, 'workout', true);
    else toast('Workout saved');
    render(true);
    return;
  }
  const metric = q('[data-metric]');
  if (metric) {
    ui.metric = metric.dataset.metric as Metric;
    render(true);
    return;
  }
  const plant = q('[data-plant]');
  if (plant) return beginPlant(plant.dataset.plant!);
  const season = q('[data-season]');
  if (season) {
    store.update((s) => (s.settings.season = season.dataset.season as State['settings']['season']));
    world?.setSeason(seasonNow());
    return;
  }
  const snd = q('[data-sound]');
  if (snd) {
    const on = snd.dataset.sound === 'on';
    store.update((s) => (s.settings.sound = on));
    if (on) sound.unlock();
    sound.setEnabled(on);
    return;
  }
  const tod = q('[data-tod]');
  if (tod) {
    store.update((s) => (s.settings.timeOfDay = tod.dataset.tod as State['settings']['timeOfDay']));
    world?.setTime(store.state.settings.timeOfDay);
    return;
  }
  const qual = q('[data-quality]');
  if (qual && qual.dataset.quality !== store.state.settings.quality) {
    store.update((s) => (s.settings.quality = qual.dataset.quality as 'high' | 'battery'));
    store.saveNow();
    location.reload();
    return;
  }
  if (q('[data-home]')) {
    world?.goHome();
    world?.toggleOverview(false);
    syncViewButton();
    setSheet('peek');
    return;
  }
  if (q('[data-undo]')) {
    const p = store.undoLastPlace();
    if (p) toast('Back in your inventory');
    return;
  }
  if (q('[data-export]')) return exportBackup();
  if (q('[data-import]')) return ($('import-file') as HTMLInputElement).click();
});

panel.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.reflect !== undefined) {
    store.setReflection(ui.day, t.value);
    return;
  }
  if (t.dataset.ex) {
    const split = ui.split ?? store.session(ui.day)?.split ?? splitFor(ui.day);
    if (!split) return;
    store.ensureSession(ui.day, split);
    const raw = t.value.replace(',', '.').trim();
    const v = raw === '' ? null : Number(raw);
    store.setSet(ui.day, t.dataset.ex, Number(t.dataset.i), t.dataset.f as 'reps' | 'weight', v != null && Number.isFinite(v) ? v : null);
  }
});

// re-render on blur so PR badges update after typing
panel.addEventListener('focusout', () => setTimeout(() => {
  const a = document.activeElement as HTMLElement | null;
  if (!a || !panel.contains(a) || (a.tagName !== 'INPUT' && a.tagName !== 'TEXTAREA')) render(true);
}, 0));

panel.addEventListener('change', (e) => {
  const t = e.target as HTMLElement;
  if (t.matches('[data-exsel]')) {
    ui.exId = (t as HTMLSelectElement).value;
    render(true);
  }
  if (t.id === 'import-file') importBackup((t as HTMLInputElement).files?.[0]);
});

// ---------- Planting ----------

function beginPlant(groupKey: string) {
  const g = groupInventory(inventory(store.state)).find((x) => x.key === groupKey);
  if (!g || !world) return;
  const tok = g.tokens[0];
  ui.placingToken = tok.token;
  const seed = Math.floor(Math.random() * 1e9);
  world.startPlacing(tok.kind, seed, tok.species);
  (world as any)._seed = seed;
  $('place-title').textContent = `${g.label}${tok.kind === 'flower' ? '' : ' ✦'}`;
  $('place-bar').hidden = false;
  setSheet('hidden');
}

function endPlant() {
  ui.placingToken = null;
  $('place-bar').hidden = true;
  setSheet('peek');
}

$('place-rotate').addEventListener('click', () => world?.rotateGhost());
$('place-cancel').addEventListener('click', () => {
  world?.cancelPlacing();
  endPlant();
});
$('place-confirm').addEventListener('click', () => {
  if (!world || !ui.placingToken) return;
  const tok = inventory(store.state).find((t) => t.token === ui.placingToken);
  const spot = world.confirmPlacing();
  if (tok && spot) {
    store.place({ token: tok.token, kind: tok.kind, species: tok.species, x: spot.x, z: spot.z, rot: spot.rot, seed: (world as any)._seed });
  }
  endPlant();
  sound.chime('plant');
  const left = inventory(store.state).length;
  toast(left ? `Planted. ${left} more waiting.` : 'Planted. Your garden grows.');
});

// ---------- View controls ----------

function syncViewButton() {
  const ov = world?.mode === 'overview';
  $('btn-view').textContent = ov ? '⌂' : '◎';
  $('btn-view').setAttribute('aria-label', ov ? 'Back to walking' : "Bird's-eye view");
  $('zoom').hidden = !ov;
}
$('btn-view').addEventListener('click', () => {
  world?.toggleOverview();
  syncViewButton();
});
$('zoom').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('[data-zoom]') as HTMLElement | null;
  if (!b || !world) return;
  world.overviewZoom = Math.min(70, Math.max(10, world.overviewZoom + Number(b.dataset.zoom) * 8));
});

// ---------- Backup ----------

function exportBackup() {
  store.saveNow();
  const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
  const name = `garden-backup-${todayKey()}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    nav.share({ files: [file], title: 'Garden backup' }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importBackup(f?: File) {
  if (!f) return;
  try {
    const s = JSON.parse(await f.text()) as State;
    if (s.version !== 1 || !s.days || !s.placed) throw new Error('bad file');
    if (!confirm('Replace everything on this phone with this backup?')) return;
    store.replace(s);
    toast('Backup restored');
  } catch {
    toast('That file is not a garden backup');
  }
}

// ---------- Store → world + UI ----------

store.subscribe((s) => {
  world?.sync(s.placed);
  if (world && world.weather !== weatherNow()) world.setWeather(weatherNow(), s.settings.timeOfDay);
  world?.setHouseLevel(houseLevelFor(wonDays(s).length));
  render();
});

// roll over to a new day if the app stays open past midnight
let lastToday = todayKey();
setInterval(() => {
  const now = todayKey();
  if (now !== lastToday) {
    if (ui.day === lastToday) ui.day = now;
    lastToday = now;
    world?.setWeather(weatherNow(), store.state.settings.timeOfDay);
    render(true);
  }
}, 30_000);

render(true);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
