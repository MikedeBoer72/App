# YourLevel — Launch Roadmap

Living checklist from "now" to "live on the App Store." Tick boxes as you go.

## Key facts (so any new session is caught up fast)

- **App name**: YourLevel
- **Bundle ID**: `com.yourlevel.app`
- **Apple ID (enrolled)**: Mikedeboermario@gmail.com
- **Apple Team ID**: MH6W95XU8T
- **App Store Connect App ID (ascAppId)**: 6782592411
- **Sign in with Apple Services ID**: `com.yourlevel.app.signin`
- **Sign in with Apple Key ID**: 6Y3CR8UWKL (the `.p8` is saved on the user's computer)
- **Subscription product ID**: `pro_monthly` ($7.99/month)
- **RevenueCat entitlement**: `pro` (convention in code)
- **Supabase project URL**: https://kzlwvomcbkuwtyssndgu.supabase.co
- **Branch**: `claude/initial-app-setup-YXQuq`
- **Stack**: Expo SDK 54, RN 0.81, Expo Router, Supabase, RevenueCat, Zustand
- **Dev login**: a `__DEV__`-gated "Continue as guest" button exists for Expo Go testing; it is stripped from production builds.
- **Migrations to apply in Supabase** (if a fresh DB): 001–005 in `supabase/migrations/`.

---

## PHASE 1 — Finish App Store Connect financial/legal setup  ✅ DONE

- [x] **Paid Apps Agreement → Active** (contact, bank, W-8BEN tax, DSA trader w/ KvK, ID docs)
- [x] **Apple Small Business Program** enrolled (15% commission)
- [x] **Subscription metadata → "Ready to Submit"** (duration, $7.99 price, localizations,
      review screenshot, tax category). Availability: all countries.

## PHASE 2 — Credentials for RevenueCat

- [ ] **App-Specific Shared Secret**
  - App Store Connect → app → (or Users & Access depending on layout) → generate App-Specific Shared Secret
- [ ] **In-App Purchase Key (.p8)**
  - App Store Connect → Users and Access → Integrations → In-App Purchase → generate key, download `.p8`, note Key ID + Issuer ID

## PHASE 2 — Credentials  ✅ DONE
- [x] App-Specific Shared Secret generated
- [x] In-App Purchase Key (.p8) generated + saved

## PHASE 3 — RevenueCat config  ✅ DONE

- [x] iOS app added, bundle id `com.yourlevel.app`, Shared Secret + IAP key
- [x] Entitlement `pro`, product `pro_monthly`, default offering w/ monthly package
- [x] iOS public API key `appl_sROxEsLTbYfTfpXNxqYClHrlDNV` wired into eas.json env
      (all 3 EXPO_PUBLIC_ vars carried in eas.json for preview + production builds,
      since .env is gitignored and doesn't reach EAS cloud builds)

## PHASE 4 — Privacy policy

- [ ] Generate at termly.io (collect: email, purchase data; no analytics yet)
- [ ] Host on a public Notion page (or real domain)
- [ ] Save the URL — needed in the App Store listing

## PHASE 5 — First EAS Build → TestFlight

- [ ] `npm install -g eas-cli`
- [ ] `eas login`
- [ ] `eas build --platform ios --profile production`
      (runs on Apple cloud, ~15 min; no Mac needed. Will prompt to
      generate a distribution cert + provisioning profile — say yes.)
- [ ] `eas submit --platform ios --profile production` (uploads to TestFlight)
- [ ] Wait for TestFlight processing (~5–15 min), then it appears in the
      TestFlight app on the phone

## PHASE 6 — Real-device testing on TestFlight

- [ ] Install YourLevel via the TestFlight app
- [ ] **Real Apple Sign In** works (host.exp.Exponent error is gone in a real build)
- [ ] **Real Google Sign In** works (production scheme `yourlevel://`)
- [ ] **Real subscription purchase** with a sandbox tester account
      (Settings → App Store → sign in as sandbox tester when prompted)
- [ ] Subscribe → `is_subscribed` flips → level gate past 5 unlocks → themes/decorations unlock
- [ ] Restore Purchases works
- [ ] **Overnight daily-reset test**: set day-start ~2 min ahead, leave app,
      confirm tasks/bad-habits wipe + streak logic next "day"
- [ ] Background fetch + multi-day catch-up (skip the app a couple days)
- [ ] Notifications fire at the bracketed times
- [ ] Avatar upload, name edit, drag-reorder, stats all work on device

## PHASE 7 — App Store listing (assistant drafts copy)

- [ ] Description (must include auto-renewing subscription terms)
- [ ] Keywords (100 char)
- [ ] Promotional text (optional)
- [ ] Support URL (privacy policy page or support@ email page)
- [ ] Marketing URL (optional)
- [ ] **Screenshots** for 6.7" iPhone (3–10): login, dashboard with tasks +
      level circle, stats heatmap, fonts picker, decorations, a premium theme
- [ ] App Privacy questionnaire (data types collected)
- [ ] Age rating questionnaire
- [ ] Category: Productivity (primary) / Health & Fitness (secondary)
- [ ] Price: Free (with IAP)

## PHASE 8 — Submit & review

- [ ] Attach the TestFlight build to the App Store version
- [ ] Provide a **demo account** for the reviewer (or note guest login if present)
      — Apple needs to reach the paywall + main features
- [ ] Submit for review
- [ ] Wait 1–7 days
- [ ] Respond within 24h to any rejection (common: subscription wording,
      privacy strings, demo access). 14-day window before auto-reject.
- [ ] Approved → release (manual or automatic)

## PHASE 9 — Post-launch (week 1+)

- [ ] Sentry crash reporting (free tier)
- [ ] PostHog/Mixpanel analytics (free tier)
- [ ] Remove the `__DEV__` guest button + mock subscribe button is already
      auto-stripped, but verify
- [ ] Watch reviews, reply within 24h
- [ ] Plan v1.1 from real feedback (streak freeze, achievements, widget…)
- [ ] Marketing: r/SoloLeveling, anime/habit TikTok, Twitter; later, outreach
      to Sung Jin-Woo VA (Aleks Le) *after* you have traction + a demo video

---

## Cleanup before final submission (tracked so we don't forget)

- [ ] `__DEV__` guest sign-in button — auto-stripped in prod, but confirm it
      doesn't show in the TestFlight build
- [ ] Mock "$7.99/monthly" subscribe button (screenshot helper) — auto-stripped
      in prod; confirm real RevenueCat button shows in TestFlight
- [ ] Remove `host.exp.Exponent` from Supabase Apple client IDs if it was ever
      added (it wasn't, but double-check)
- [ ] Confirm Supabase Site URL = `yourlevel://` and Redirect URLs include
      `yourlevel://**` (+ `exp://**` is fine to leave for dev)
