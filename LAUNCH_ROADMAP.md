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

The full policy is already written + tailored: see PRIVACY_POLICY.md in the
repo root. Steps:
- [ ] Fill the 2 placeholders in PRIVACY_POLICY.md: date + support email
      (recommend a dedicated gmail like yourlevel.support@gmail.com, not personal)
- [ ] Host it: notion.so → new page → paste the markdown → Share → Publish →
      copy the public URL (yourlevel.notion.site/...)
- [ ] App Store Connect → YourLevel → App Information → paste the URL into both
      "Privacy Policy URL" and "Support URL"
- [ ] App Store Connect → App Privacy → questionnaire. Collected + linked to
      user, NOT for tracking: Email, Name, Photos(avatar), User Content,
      Purchases. Everything else = Not Collected. Tracking = No.

## 🗺️ ENGAGEMENT ROADMAP (user-approved plan)

Phase 1 (pre-launch) — ✅ SHIPPED eea5c6f: next-unlock teaser + pace ETA,
mystery decorations, first-week quest ladder (migration 007!), world-entry
takeover celebration, streak-aware reminder copy.
Phase 2 — ✅ SHIPPED 727b107: The Journey (/map). World cards in each
theme's identity, conquered/current/next/fog states, YOU ARE HERE marker
+ progress, mystery decoration nodes, auto-scroll to player. Entry: map
icon in dashboard header + tapping the NEXT UNLOCK teaser.
Phase 3 — ✅ SHIPPED d8b564d: streak freeze (earn 1/7 clean days, max 2,
consumed before Second Chance; ❄️ on dashboard), streak milestones
(7/30/100 -> +100/+500/+2000 XP + queued celebration via
pending_streak_milestone), themed share card (view-shot; Share buttons on
level-up / world-entry / milestone), weekly report (/settings/
weekly-report; Stats header calendar icon + Sunday dashboard banner).
MIGRATION 008 required + npm install (react-native-view-shot).

## ⚠️ NEW SINCE LAST BUILD (needs `npm install` + migration 006 + rebuild)

Big feature/fix session (commits 5163c99..c3e923c):
- Stats heatmap actually shows 6 weeks (was collapsing to 1 row)
- Day rolls over WITHOUT restarting the app (foreground + 60s check)
- Bad habit penalty 200 -> 150  → RUN supabase/migrations/006_penalty_150.sql
- Level-up celebration v2: confetti + rays + double haptic + NEW UNLOCK
  cards (themes/decorations crossed by the level-up) with one-tap Apply
- Sound system (expo-audio ~1.1.1 — new dep, run `npm install`):
  tap/complete/levelup/unlock effects + 24s chill music loop,
  Settings → Sound toggles (effects ON, music OFF by default)
- Interactive tutorial: onboarding is now 3 steps; a spotlight
  walkthrough runs on the real dashboard (forced taps: add a task,
  complete it) — only for fresh accounts
- To test the tutorial on an existing device: sign up with a NEW
  account, or it won't trigger (pending flag set at onboarding only)

## ⚠️ NEXT SESSION — START HERE: rebuild to bundle the latest fixes

The app NOW RUNS on TestFlight (the launch crash + the ITMS-90771 build
failure are both fixed and confirmed). Since the last working build, we
committed more changes that are NOT yet in a build:
  - new YL icon (cleaned, full-bleed, alpha stripped) + matched splash
  - first-run onboarding tutorial + name capture (fixes "Guest" name)
  - Social Media screen -> "coming soon" (removed the Rick Roll links)

### Do this first, in order:
1. `cd Documents\maxing-ai`
2. `git fetch origin`
3. `git reset --hard origin/claude/initial-app-setup-YXQuq`
   (forces local = remote; safe — the only local-only file is the
   untracked "supabase saved info.txt", which reset preserves)
4. `eas build --platform ios --profile production`   (build auto-increments)
5. `eas submit --platform ios --profile production`   → pick newest build
6. TestFlight processes it (~10 min) → update on phone → verify:
   - [ ] new icon on the home screen
   - [ ] onboarding tutorial (only shows for NEW accounts — sign in with a
         fresh Apple/Google acct to see it; your own acct already finished it)
   - [ ] Social Media shows "coming soon", no Rick Roll

### Known things that are NOT bugs:
- Subscription price shows €8,99 (not €7,99): Apple's $7.99 USD price TIER
  maps to €8,99 in the EU (VAT + Apple's tier grid). The app correctly shows
  the real localized price. To make it €7,99: App Store Connect → YourLevel →
  Subscriptions → Pro Monthly → Subscription Prices → pick the tier that is
  €7,99 for NL. Otherwise leave it.
- Your own profile shows "Guest": you signed up before the name step existed.
  Fix it in-app: Settings → Account → pencil icon → type your name.

## PHASE 5 — EAS Build → TestFlight  ✅ DONE (app runs on device)

- [x] eas-cli installed, `eas login`, project linked (`eas init`)
- [x] First successful production build + submit to TestFlight
- [x] Installed on phone; launch crash fixed (static EXPO_PUBLIC_ inlining)
- [ ] Re-build with the latest icon/onboarding/social commits (steps above)

## PHASE 6 — Real-device testing on TestFlight (after the rebuild)

Confirmed working so far: app launches, real login, subscription screen
shows real price, social "coming soon". Still to verify on the new build:
- [x] App launches without crashing
- [ ] **Real Apple Sign In** end-to-end sets a proper name (onboarding name step)
- [ ] **Real Google Sign In**
- [ ] **Real subscription purchase** with a sandbox tester account
      (Settings → App Store → sign in as sandbox tester when prompted)
- [ ] Subscribe → `is_subscribed` flips → level gate past 5 unlocks → themes/decorations unlock
- [ ] Restore Purchases works
- [ ] **Overnight daily-reset test**: set day-start ~2 min ahead, leave app,
      confirm tasks/bad-habits wipe + streak logic next "day"
- [ ] Notifications fire at the bracketed times
- [ ] Onboarding flow on a fresh account (tutorial + name + day-start)
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
- [ ] **v1.1 — finish referrals**: the Refer Friends screen shows + shares a
      code, but there is NO code-entry field for new users and NO logic to
      grant the referrer a free month. For launch this is intentionally
      left as display-only (Option A). v1.1: add a referral-code field in
      onboarding + RevenueCat promo/grant logic for the free month.
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
