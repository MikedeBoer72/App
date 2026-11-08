# Bloom Garden

A calm 3D garden that grows every day you keep your word. Built as an iPhone web app (install it to your home screen) with three.js.

## The rules

| Mon–Sat | Sunday (rest and reflection) |
|---|---|
| Morning workout (Legs → Push → Pull, then repeat) | Groceries at Jumbo |
| Ate clean / cooked my own food | Reflect on the week (a short journal) |
| Coffee only, no Monster or energy drinks | Take a walk |
| 2+ KZBB sales | |

- **Every task you tick grows one flower.** Each task has its own flower: workout = red poppy, clean = daisy, coffee only = lavender, KZBB = sunflower, Jumbo = cornflower, reflect = foxglove, walk = wild tulip.
- **Winning a day** (all tasks done) unlocks a landmark: birch, boulders, elderflower bush, oak, stone lantern, pine, bench and cherry blossom. Every 5th won day brings a lily pond and every 10th a waterfall.
- **The house** grows with your total won days: a plot, then a cottage at 3, a porch at 7, a chimney and fence at 14, a second wing at 30, a greenhouse at 60 and a tower at 100. It never shrinks.
- **A missed day takes nothing away.** Only the streak resets. The next day starts with a storm (rain, lightning, thunder). Win that day and the sky clears with a rainbow.
- **Seasons follow the calendar.** Spring brings cherry blossom and falling petals, summer is green and golden, autumn turns the trees yellow and orange with falling leaves, and winter brings snow and bare branches. You can preview a season under Garden → Season.
- **Sound:** every sound is generated in code: wind, birds by day, crickets at night, the waterfall and pond getting louder as you walk closer, rain, thunder, and a chime when you plant something or win the day. It can be switched off under Garden → Sound. On iPhone, the silent switch mutes it.
- You can fix the last 7 days if you forgot to tick something.

## Workouts

Edit `src/data/config.ts` (`WORKOUTS`) to change exercises. Every exercise has 3 sets, and you log kg and reps for each. The last session is shown as placeholders so you know what to beat. The Progress tab charts estimated 1RM, top weight or total reps.

## Controls

- **iPhone:** drag on the left side of the screen to walk (joystick) and on the right side to look around. ◎ switches to the bird's-eye view, where you drag to pan and use +/− to zoom.
- **Desktop:** WASD or the arrow keys, drag to look, Shift to walk faster.

## Data

Everything is stored on the device (localStorage). Use **Garden → Save backup** now and then.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173, also reachable from your phone on the same Wi-Fi
npm run build    # static site in dist/
```

## Put it on your iPhone

The build is a static site, so any static host works:

1. **GitHub Pages:** the workflow in `.github/workflows/garden-pages.yml` builds and deploys it. Enable it under *Settings → Pages → Source: GitHub Actions*. GitHub Pages needs a public repo, or GitHub Pro for a private one.
2. **Netlify Drop (no account setup needed):** run `npm run build`, then drag the `dist` folder onto https://app.netlify.com/drop.

Then open the URL in Safari, tap **Share → Add to Home Screen**, and open it from the icon. It runs full-screen and works offline.
