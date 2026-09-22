# Resubmission plan (after rejection #3)

Do these in order. Step 2 starts a ~25 min cloud build, so the App Store
Connect work happens while it runs.

---

## 1. Deploy the account-deletion function  (~3 min)

REQUIRED. Without it "Delete account" leaves the login alive and the
reviewer can sign straight back in — Apple tests this (5.1.1(v)).

```
cd Documents\maxing-ai
git fetch origin
git reset --hard origin/claude/initial-app-setup-YXQuq
npm install
npx supabase functions deploy delete-account
```

✅ Check: Supabase → Edge Functions → `delete-account` is listed.

---

## 2. Start the build  (~25 min, runs in the cloud)

```
eas build --platform ios --profile production
```

Leave the window open. Answer Yes / press Enter to any credentials
prompt. Go do step 3 while it runs.

---

## 3. While it builds — App Store Connect  (~10 min)

**a) Replace the review notes.**
App Store Connect → YourLevel → the 1.0 version page → **App Review
Information → Notes** → delete what's there and paste the contents of
`REVIEW_NOTES.md`. (It no longer tells the reviewer to level up to 5,
which walked them into the paywall.) Fill the two [BRACKETS]. Save.

**b) Check the three Notion links in a PRIVATE browser window:**
- Support: .../YourLevel-Support-3b7b7f726d9880f99606d0a22e2a84c2
- Privacy: .../3a6b7f726d9880ea9fbad0a6eaa19392
- Terms:   .../3a6b7f726d9880469208f5a63a146af4

Each must load without asking for a login. If one asks → Notion page →
Share → Publish.

---

## 4. Send the build to TestFlight

When the terminal says **Build finished**:

```
eas submit --platform ios --profile production
```

Then wait 5–10 minutes for Apple to process it.

---

## 5. Test on your phone  (the important part, ~10 min)

Update YourLevel from TestFlight, then:

**a) Fresh-account tutorial run.** In Supabase → Authentication → Users,
delete your own test user. Then in the app sign up fresh and walk the
ENTIRE walkthrough to "Finish". Four dead-ends were fixed here and this
is the exact path the reviewer takes.
- With Sign in with Apple: you should go straight from Welcome to the
  time picker — NO name screen — and your real name appears on the
  profile.

**b) Login screen.** The Apple button is white with the  logo, sitting
above Google, and Terms / Privacy links show at the bottom.

**c) Map.** Open it from a cold start. If it stutters badly, say so —
it draws ~10,000 elements with no lazy loading and may need work.

**d) Level 100 theme** is now called **Eclipse**, not "Solo Leveling".

---

## 6. Reset the demo account

Supabase → SQL Editor → paste `scripts/reviewer-account.sql`, replace
DEMO_EMAIL_HERE (twice) with `yourlevel.demo@gmail.com` → Run.

✅ Check in the app: Level 4, and Settings → Subscription shows a
**Subscribe** button (not "Subscribed").

---

## 7. Attach the build and submit

1. App Store Connect → 1.0 version page → **Build** section → ⊕ → pick
   the build you just uploaded → **Save**.
2. Top right → **Add for Review**.
3. 🔴 On the summary screen, confirm **Pro Monthly** is listed. If it
   isn't, stop and ask — submitting without it ships a paywall nobody
   can buy from.
4. Answer: encryption → exempt · third-party content → No ·
   Advertising Identifier (IDFA) → **No**.
5. **Submit to App Review.**

---

## Optional tidy-up

The Notion Support page still says referrals give "one free month".
The app now says "a free month of Pro is added to your account" (which
is what actually happens). Update the Notion line so they match.

---

## If it comes back rejected again

Paste the message verbatim. Rejections 1-3 are fixed, and an audit pass
also removed a trademark blocker ("Solo Leveling" theme → "Eclipse")
plus seven ways a reviewer could get permanently stuck.
