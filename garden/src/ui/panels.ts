// HTML for the four sheet panels. Pure functions of state → markup.

import {
  ALL_EXERCISES,
  FLOWER_COLORS,
  FLOWER_NAMES,
  HOUSE_LEVELS,
  LANDMARK_NAMES,
  SETS_PER_EXERCISE,
  Split,
  TASKS,
  WORKOUTS,
  houseLevelFor,
  landmarkForWin,
  splitFor,
  tasksFor,
} from '../data/config';
import { addDays, prettyDate, shortDate, todayKey, weekday, weekdayName } from '../data/dates';
import {
  State,
  bestStreak,
  currentStreak,
  inventory,
  isWon,
  store,
  summarize,
  wonDays,
  type SetEntry,
  type Token,
} from '../data/store';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const MAX_BACK_DAYS = 7;

export function hud(s: State): string {
  const streak = currentStreak(s);
  const wins = wonDays(s).length;
  const inv = inventory(s).length;
  return `
    <div class="hud-stat"><b>${streak}</b><span>day streak</span></div>
    <div class="hud-sep"></div>
    <div class="hud-stat"><b>${wins}</b><span>days won</span></div>
    ${inv ? `<div class="hud-sep"></div><div class="hud-stat"><b style="color:var(--gold)">${inv}</b><span>to plant</span></div>` : ''}
  `;
}

// ---------- Today ----------

export function today(s: State, day: string): string {
  const tasks = tasksFor(day);
  const entry = store.day(day);
  const doneN = tasks.filter((t) => entry.done[t]).length;
  const won = isWon(s, day);
  const split = splitFor(day);
  const subtitle = split ? `${WORKOUTS[split].title} day` : 'Rest day: shop, reflect, walk';
  const isToday = day === todayKey();
  const minDay = addDays(todayKey(), -MAX_BACK_DAYS);

  const winsBefore = wonDays(s).filter((k) => k < day).length;
  const unlock = LANDMARK_NAMES[landmarkForWin(winsBefore + 1)];

  const cards = tasks
    .map((id) => {
      const t = TASKS[id];
      const done = !!entry.done[id];
      const extra =
        id === 'workout'
          ? `<button class="link" data-goto="workout">Open ${split ? WORKOUTS[split].title.toLowerCase() : ''} workout →</button>`
          : id === 'reflect'
            ? `<textarea data-reflect placeholder="What went well this week?\nWhere did I slip, and why?\nHow many KZBB did I close?\nWhat is my focus for next week?">${esc(entry.reflection ?? '')}</textarea>`
            : '';
      return `
      <div class="card" style="padding:0">
        <button class="task ${done ? 'done' : ''}" data-task="${id}">
          <span class="check">${done ? '✓' : ''}</span>
          <span style="flex:1">
            <div class="task-title">${t.title}</div>
            <div class="task-hint">${t.hint}</div>
            <div class="flower-tag"><i class="swatch" style="background:${FLOWER_COLORS[t.flower]}"></i>${done ? 'Grew' : 'Grows'} a ${FLOWER_NAMES[t.flower].toLowerCase()}</div>
          </span>
        </button>
        ${extra ? `<div style="padding:0 14px 14px 58px">${extra}</div>` : ''}
      </div>`;
    })
    .join('');

  return `
    <div class="row">
      <div style="flex:1">
        <h2>${isToday ? 'Today' : weekdayName(day)}</h2>
        <p class="sub" style="margin:0">${weekdayName(day)} ${prettyDate(day)} · ${subtitle}</p>
      </div>
      <div class="datenav">
        <button data-day="-1" ${day <= minDay ? 'disabled' : ''} aria-label="Previous day">‹</button>
        <button data-day="1" ${isToday ? 'disabled' : ''} aria-label="Next day">›</button>
      </div>
    </div>
    <div class="daybar">${tasks.map((t) => `<i class="${entry.done[t] ? 'on' : ''}"></i>`).join('')}</div>
    ${cards}
    <div class="card ${won ? 'won' : ''}">
      ${
        won
          ? `<b>Day won.</b> <span class="muted">Your flowers and new landmark are waiting in the Garden tab.</span>`
          : `<span class="muted">${doneN}/${tasks.length} done. Complete all ${tasks.length} to win the day and unlock a <b style="color:var(--ink)">${unlock.toLowerCase()}</b>.</span>`
      }
    </div>
    ${!isToday ? `<p class="muted" style="text-align:center">Forgot to tick something? You can fix the last ${MAX_BACK_DAYS} days.</p>` : ''}
  `;
}

// ---------- Workout ----------

function fmtSet(st: SetEntry, mode: string) {
  if (st.reps == null) return '–';
  if (mode === 'reps') return `${st.reps}`;
  if (mode === 'bodyweight') return st.weight ? `+${st.weight}×${st.reps}` : `${st.reps}`;
  return `${st.weight ?? 0}×${st.reps}`;
}

export function workout(s: State, day: string, chosen: Split | null): string {
  const split = chosen ?? s.sessions[day]?.split ?? splitFor(day);
  const chips = (['legs', 'push', 'pull'] as Split[])
    .map((k) => `<button class="chip ${split === k ? 'on' : ''}" data-split="${k}">${WORKOUTS[k].title}</button>`)
    .join('');
  if (!split) {
    return `
      <h2>Sunday</h2>
      <p class="sub">Rest day. Your muscles grow today. Want to log a session anyway?</p>
      <div class="chips">${chips}</div>`;
  }
  const sess = s.sessions[day];
  const finished = !!sess?.finished && sess.split === split;
  const exs = WORKOUTS[split].exercises
    .map((ex) => {
      const last = store.lastFor(ex.id, day);
      const cur = sess && sess.split === split ? (sess.sets[ex.id] ?? []) : [];
      const hist = store.historyFor(ex.id).filter((h) => h.date < day);
      const bestPrev = hist.length ? Math.max(...hist.map((h) => (ex.mode === 'weight' ? summarize(h).bestE1rm : summarize(h).totalReps))) : 0;
      const curSum = summarize({ date: day, sets: cur.filter((x) => x.reps != null) });
      const curScore = ex.mode === 'weight' ? curSum.bestE1rm : curSum.totalReps;
      const isPR = hist.length > 0 && curScore > bestPrev;
      const showWeight = ex.mode !== 'reps';
      const rows = Array.from({ length: SETS_PER_EXERCISE }, (_, i) => {
        const c = cur[i] ?? { reps: null, weight: null };
        const l = last?.sets[i];
        return `
          <span class="n">Set ${i + 1}</span>
          ${
            showWeight
              ? `<input inputmode="decimal" data-ex="${ex.id}" data-i="${i}" data-f="weight" value="${c.weight ?? ''}" placeholder="${l?.weight ?? (ex.mode === 'bodyweight' ? '0' : 'kg')}" aria-label="${ex.name} set ${i + 1} ${ex.mode === 'bodyweight' ? 'added kg' : 'kg'}">`
              : ''
          }
          <input inputmode="numeric" data-ex="${ex.id}" data-i="${i}" data-f="reps" value="${c.reps ?? ''}" placeholder="${l?.reps ?? 'reps'}" aria-label="${ex.name} set ${i + 1} reps">`;
      }).join('');
      return `
        <div class="card">
          <div class="ex-head">
            <span class="ex-name">${ex.name}</span>
            ${isPR ? '<span class="pr">PR</span>' : ''}
          </div>
          <div class="ex-last row">
            <span style="flex:1">${last ? `Last (${shortDate(last.date)}): ${last.sets.map((x) => fmtSet(x, ex.mode)).join(' · ')}` : 'First time. Set your baseline.'}</span>
            ${last ? `<button class="copy-last" data-copy="${ex.id}">Use last</button>` : ''}
          </div>
          <div class="sets ${showWeight ? '' : 'reps-only'}">
            <span></span>${showWeight ? `<span class="lbl">${ex.mode === 'bodyweight' ? '+kg' : 'kg'}</span>` : ''}<span class="lbl">reps</span>
            ${rows}
          </div>
        </div>`;
    })
    .join('');
  return `
    <h2>${WORKOUTS[split].title}</h2>
    <p class="sub">${weekdayName(day)} ${prettyDate(day)} · 3 sets each. Beat last time: one more rep or a bit more weight.</p>
    <div class="chips" style="margin-bottom:14px">${chips}</div>
    ${exs}
    <button class="btn ${finished ? 'ghost' : 'primary'} block" data-finish ${finished ? 'disabled' : ''}>${finished ? 'Workout complete ✓' : 'Finish workout'}</button>
  `;
}

// ---------- Progress ----------

export type Metric = 'e1rm' | 'top' | 'reps';

export function progress(s: State, exId: string, metric: Metric): string {
  const ex = ALL_EXERCISES.find((e) => e.id === exId) ?? ALL_EXERCISES[0];
  const m: Metric = ex.mode === 'weight' ? metric : 'reps';
  const hist = store.historyFor(ex.id).map(summarize);
  const totalWorkouts = Object.values(s.sessions).filter((x) => x.finished).length;
  const planted = s.placed.length;
  const options = (['legs', 'push', 'pull'] as Split[])
    .map(
      (sp) =>
        `<optgroup label="${WORKOUTS[sp].title}">${WORKOUTS[sp].exercises
          .map((e) => `<option value="${e.id}" ${e.id === ex.id ? 'selected' : ''}>${e.name}</option>`)
          .join('')}</optgroup>`,
    )
    .join('');
  const metricChips =
    ex.mode === 'weight'
      ? `<div class="chips" style="margin:10px 0">
          <button class="chip ${m === 'e1rm' ? 'on' : ''}" data-metric="e1rm">Strength (est. 1RM)</button>
          <button class="chip ${m === 'top' ? 'on' : ''}" data-metric="top">Top weight</button>
          <button class="chip ${m === 'reps' ? 'on' : ''}" data-metric="reps">Total reps</button>
        </div>`
      : '<div style="height:10px"></div>';

  const reflections = Object.keys(s.days)
    .filter((k) => weekday(k) === 0 && s.days[k].reflection?.trim())
    .sort()
    .reverse()
    .slice(0, 8)
    .map((k) => `<div class="card"><div class="muted">${prettyDate(k)}</div><div style="white-space:pre-wrap;margin-top:6px;font-size:14px;line-height:1.45">${esc(s.days[k].reflection!)}</div></div>`)
    .join('');

  return `
    <h2>Progress</h2>
    <p class="sub">The garden shows the habit. These numbers show the work.</p>
    <div class="tiles">
      <div class="tile"><b>${currentStreak(s)}</b><span>Current streak</span></div>
      <div class="tile"><b>${bestStreak(s)}</b><span>Best streak</span></div>
      <div class="tile"><b>${totalWorkouts}</b><span>Workouts finished</span></div>
      <div class="tile"><b>${planted}</b><span>Things planted</span></div>
    </div>
    <h3>Lifts</h3>
    <select data-exsel>${options}</select>
    ${metricChips}
    <div class="card">
      <div class="muted" style="margin-bottom:6px">${ex.name}: ${m === 'e1rm' ? 'estimated 1-rep max (kg)' : m === 'top' ? 'heaviest set (kg)' : 'total reps over 3 sets'}</div>
      ${hist.length >= 1 ? `<svg class="chart" id="chart" role="img" aria-label="${ex.name} progress chart"></svg><div class="chart-tip" id="chart-tip">Tap a point for details.</div>` : '<p class="muted">Log this exercise to see the line start climbing.</p>'}
    </div>
    ${
      hist.length
        ? `<table><thead><tr><th>Date</th><th>Sets</th><th>${ex.mode === 'weight' ? 'e1RM' : 'Reps'}</th></tr></thead><tbody>
          ${hist
            .slice()
            .reverse()
            .slice(0, 10)
            .map((h) => {
              const raw = store.historyFor(ex.id).find((x) => x.date === h.date)!;
              return `<tr><td>${shortDate(h.date)}</td><td>${raw.sets.map((x) => fmtSet(x, ex.mode)).join(' · ')}</td><td>${ex.mode === 'weight' ? h.bestE1rm.toFixed(1) : h.totalReps}</td></tr>`;
            })
            .join('')}
        </tbody></table>`
        : ''
    }
    ${reflections ? `<h3>Sunday reflections</h3>${reflections}` : ''}
  `;
}

export function chartData(exId: string, metric: Metric): { date: string; v: number; label: string }[] {
  const ex = ALL_EXERCISES.find((e) => e.id === exId) ?? ALL_EXERCISES[0];
  const m: Metric = ex.mode === 'weight' ? metric : 'reps';
  return store.historyFor(ex.id).map((h) => {
    const sm = summarize(h);
    const v = m === 'e1rm' ? sm.bestE1rm : m === 'top' ? sm.topWeight : sm.totalReps;
    const label = `${prettyDate(h.date)}: ${h.sets.map((x) => fmtSet(x, ex.mode)).join(' · ')}`;
    return { date: h.date, v: Math.round(v * 10) / 10, label };
  });
}

// ---------- Garden ----------

export function groupInventory(tokens: Token[]) {
  const groups = new Map<string, { key: string; label: string; color?: string; tokens: Token[] }>();
  for (const t of tokens) {
    const key = t.kind === 'flower' ? `flower:${t.species}` : t.kind;
    const label = t.kind === 'flower' ? FLOWER_NAMES[t.species!] : LANDMARK_NAMES[t.kind];
    if (!groups.has(key)) groups.set(key, { key, label, color: t.kind === 'flower' ? FLOWER_COLORS[t.species!] : undefined, tokens: [] });
    groups.get(key)!.tokens.push(t);
  }
  // landmarks first: they are the rare ones
  return [...groups.values()].sort((a, b) => Number(!!a.color) - Number(!!b.color));
}

export function garden(s: State): string {
  const inv = groupInventory(inventory(s));
  const wins = wonDays(s).length;
  const lvl = houseLevelFor(wins);
  const next = HOUSE_LEVELS[lvl + 1];
  const prevW = HOUSE_LEVELS[lvl].wins;
  const pct = next ? ((wins - prevW) / (next.wins - prevW)) * 100 : 100;
  const tod = s.settings.timeOfDay;
  const last = s.placed[s.placed.length - 1];

  return `
    <h2>Garden</h2>
    <p class="sub">Every task grows a flower. Every won day brings something bigger. Missed days take nothing away.</p>
    ${
      inv.length
        ? inv
            .map(
              (g) => `
        <div class="card inv">
          <span class="count">${g.tokens.length}</span>
          <span style="flex:1">
            <div class="task-title">${g.color ? `<i class="swatch" style="background:${g.color}"></i> ` : '✦ '}${g.label}</div>
            <div class="muted">${g.color ? `From: ${g.tokens[0].reason.toLowerCase()}` : g.tokens[0].reason}</div>
          </span>
          <button class="btn primary" data-plant="${g.key}">Plant</button>
        </div>`,
            )
            .join('')
        : `<div class="card"><span class="muted">Nothing waiting to be planted. Tick off today's tasks and your flowers will appear here.</span></div>`
    }

    <h3>Your home</h3>
    <div class="card">
      <div class="task-title">${HOUSE_LEVELS[lvl].name}</div>
      ${
        next
          ? `<div class="muted" style="margin-top:4px">${next.wins - wins} more won day${next.wins - wins === 1 ? '' : 's'} until: ${next.name.toLowerCase()}.</div>
             <div class="house-meter"><i style="width:${pct}%"></i></div>`
          : `<div class="muted" style="margin-top:4px">Fully built. You made this real.</div>`
      }
    </div>

    <h3>Light</h3>
    <div class="chips">
      ${(['live', 'morning', 'day', 'evening', 'night'] as const)
        .map((t) => `<button class="chip ${tod === t ? 'on' : ''}" data-tod="${t}">${t === 'live' ? 'Follow the clock' : t[0].toUpperCase() + t.slice(1)}</button>`)
        .join('')}
    </div>

    <h3>Options</h3>
    <div class="chips" style="margin-bottom:10px">
      <button class="chip ${s.settings.quality === 'high' ? 'on' : ''}" data-quality="high">High quality</button>
      <button class="chip ${s.settings.quality === 'battery' ? 'on' : ''}" data-quality="battery">Battery saver</button>
    </div>
    <div class="row" style="flex-wrap:wrap">
      <button class="btn ghost" data-home>Walk to the start</button>
      ${last ? `<button class="btn ghost" data-undo>Undo last planting</button>` : ''}
    </div>

    <h3>Backup</h3>
    <p class="muted">Your garden lives on this phone. Save a backup now and then (Files or iCloud Drive).</p>
    <div class="row">
      <button class="btn ghost" data-export>Save backup</button>
      <button class="btn ghost" data-import>Restore backup</button>
      <input type="file" accept="application/json" id="import-file" hidden>
    </div>
    <p class="muted" style="margin-top:22px;text-align:center">Started ${prettyDate(s.startDate)}.</p>
  `;
}
