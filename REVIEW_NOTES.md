# App Review Notes — paste into the Notes field / Resolution Center reply

Answers all 8 questions from the Guideline 2.1 "Information Needed" request.
Fill the two [BRACKETS] before sending.

---

ABOUT THE APP (function, audience, value)

YourLevel is a habit tracker that turns daily self-improvement into a
role-playing game. The user adds the tasks they want to do each day and the
bad habits they want to quit. Completing a task earns XP; logging a bad habit
deducts XP. XP raises the user's level, which advances a marker along a
hand-drawn world map and unlocks new visual themes at milestone levels.

Target audience: people roughly 16-35 who abandon conventional habit and
to-do apps because progress feels invisible and unrewarding. The problem it
solves is motivation and consistency: YourLevel makes daily progress visible
(a level, a streak, a journey on a map) so that showing up feels like it
counts. The value is sustained habit adherence through game feedback loops.

The app is single-player. There is no social feed, no messaging and no
sharing of one user's content with another.

---

DEMO ACCOUNT

Sign in with Google using:
  Username: yourlevel.demo@gmail.com
  Password: [DEMO ACCOUNT PASSWORD]

The account is prepared at Level 4 with several days of history so that every
screen is populated, and it is deliberately NOT subscribed so that the
in-app purchase flow can be fully reviewed.

Sign in with Apple is also supported and works identically.

---

HOW TO SET UP AND ACCESS THE MAIN FEATURES

1. Launch the app. On the login screen tap "Continue with Google" and choose
   the demo account above.
2. Dashboard (home screen): the large ring shows the current level and XP
   progress.
   - Tap the "+" beside "Tasks" to add a task, then tap a task's circle to
     complete it. XP is awarded and the ring fills.
   - Tap the "+" beside "Bad Habits", add one, and mark it done to see XP
     deducted (-150 XP) and the streak flagged as at risk.
3. World map: tap the map icon in the top-right of the dashboard header. This
   shows the full level journey through themed worlds.
4. Stats: tap the avatar (top-left) to open Settings, then "Stats".
5. Themes / fonts: avatar (top-left) → "Fonts".
6. Account deletion: avatar (top-left) → "Account" → "Delete account".
   This permanently deletes the account and all associated data.
7. Notifications and day-start time are also under Settings.

---

IN-APP PURCHASE — WHAT IS SOLD AND HOW TO REACH IT

There is exactly one purchasable product:
  Name:      YourLevel Pro (Pro Monthly)
  Product ID: pro_monthly
  Type:      Auto-renewable subscription, 1 month
  Price:     EUR 7,99 / month (localized per storefront by Apple)

What it unlocks: the ability to continue leveling beyond Level 5, and all
premium themes at their milestone levels.

How to navigate to the purchase screen:
  Tap the avatar (top-left) → "Subscription". The screen displays the
  subscription title, duration and localized price, and includes tappable
  links to the Terms of Use and the Privacy Policy. This is the recommended
  route and keeps the rest of the app available.

YourLevel is free to use through Level 5; beyond that a Pro subscription is
required to keep leveling, and the subscription screen is then presented
automatically. That gate is intentional product behaviour, not a bug. The
demo account is supplied at Level 4 so the entire app can be explored
first.

---

EXTERNAL SERVICES, TOOLS AND PLATFORMS USED

- Supabase (supabase.com) — authentication and database. Stores the user's
  profile, tasks, bad habits and daily history.
- Sign in with Apple, and Google Sign-In — authentication providers.
- RevenueCat (revenuecat.com) — manages subscription entitlement state.
  All payments are processed by Apple StoreKit / In-App Purchase. We never
  receive, see or store any payment or card details.
- PostHog (posthog.com) — anonymous product analytics (events such as app
  opened, task completed, level reached). Not used for tracking across other
  apps or websites, and no advertising identifier is used.

No AI services, no third-party data providers and no third-party payment
processors are used.

---

DEVICES AND OPERATING SYSTEMS TESTED

[FILL IN — for example: iPhone 14 Pro running iOS 18.5, tested via TestFlight
on a physical device.]

---

REGIONAL DIFFERENCES

None. The app's features and content are identical in every region and it is
offered in English only. The only regional variation is the subscription
price, which follows Apple's price tier for each storefront.

---

REGULATED INDUSTRY / PROTECTED THIRD-PARTY MATERIAL

The app does not operate in a regulated industry. It provides no medical,
health, financial, legal or professional advice — it is a motivational
habit-tracking tool.

It contains no protected third-party material. All artwork on the world map
and in the interface is generated procedurally in code by the developer; all
fonts are open-source Google Fonts licensed under the SIL Open Font License;
all sounds were produced by the developer.

---

USER-GENERATED CONTENT

Task and bad-habit names are typed by the user and are private to that user's
own account. They are never displayed to, shared with, or discoverable by any
other user. Because no user content is distributed, there is no feed and no
need for reporting or blocking mechanisms.

---

PROMPTS FOR SENSITIVE DATA OR DEVICE CAPABILITIES

- Photo library: requested only at the moment the user taps to choose a
  profile picture (NSPhotoLibraryUsageDescription /
  NSPhotoLibraryAddUsageDescription).
- Notifications: requested only if the user enables daily reminders.

The app does not request location, contacts, camera, microphone, or App
Tracking Transparency, and does not use the advertising identifier.
