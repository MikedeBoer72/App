# ⚠️ IF REJECTED WITH "GUIDELINE 2.1 — INFORMATION NEEDED"

Not a code problem. No rebuild, no new version, no re-uploading a build.
You reply in Resolution Center with a video + notes and the review resumes.

1. Run `scripts/reviewer-account.sql` (demo account → Level 4, NOT
   subscribed, so the reviewer can actually see the purchase flow).
2. Verify: sign into the demo account, confirm it shows Level 4 and that
   Settings → Subscription shows a BUY button (not "Subscribed").
   Don't complete tasks on it — that would level it past the gate.
3. Record the screen video on a physical device (shot list below).
4. Upload it to Google Drive ("anyone with the link") or unlisted YouTube.
   TEST THE LINK IN A PRIVATE WINDOW — if it asks for a login, the
   reviewer can't watch it and you get rejected again.
5. Fill the two [BRACKETS] in REVIEW_NOTES.md (demo password, devices).
6. Paste those notes into App Review Information → Notes on the version
   page (so future submissions never get asked again). Save.
7. Resolution Center → Reply → paste the notes + the video link → Send.

Video shot list (one continuous take, ~3 min):
launch from home screen → login screen → Google sign-in → dashboard →
add a task → complete it (+100 XP) → add a bad habit → mark it done
(-150 XP) → map icon → scroll the map → Settings → Stats → Fonts (switch
theme) → Subscription (LINGER 5s: price, duration, Terms + Privacy links,
tap a link) → Account → Delete account confirmation screen → CANCEL.

---

# Tomorrow's plan — build → fix blockers → submit

Do the steps in this order. Step 1 starts a ~25 min cloud build, so you do
the App Store Connect work WHILE it builds. Nothing here needs code changes.

---

## STEP 1 — Start the build (terminal, ~2 min of typing)

Open PowerShell and paste these one at a time:

```
cd Documents\maxing-ai
git fetch origin
git reset --hard origin/claude/initial-app-setup-YXQuq
npm install
eas build --platform ios --profile production
```

Leave the window open. It builds in the cloud (~20-30 min).
If it asks any credentials question → answer **Yes** / press Enter.

➡️ While it builds, go do STEP 2. Come back when it says **Build finished**.

---

## STEP 2 — Fix the 5 blockers (appstoreconnect.apple.com)

### 2a. Pricing  (fixes "choose a price tier")
Left sidebar → **Pricing and Availability**
- Price: **Free**   ← the APP is free; the €7,99 is the subscription, already set
- Availability: **All countries**
- Save

### 2b. App Privacy  (fixes TWO of the errors)
Left sidebar → **App Privacy**

**First:** paste into the Privacy Policy URL field:
```
https://sudsy-tablecloth-e6b.notion.site/3a6b7f726d9880ea9fbad0a6eaa19392
```

**Then:** click **Get Started** / **Edit** on the data questionnaire.
"Do you collect data from this app?" → **Yes**

Tick EXACTLY these seven. For every single one:
**Linked to identity = YES · Used for tracking = NO**

| Tick | Purpose to choose |
|---|---|
| Contact Info → Email Address | App Functionality |
| Contact Info → Name | App Functionality |
| User Content → Photos or Videos | App Functionality |
| User Content → Other User Content | App Functionality |
| Purchases → Purchase History | App Functionality |
| Identifiers → User ID | App Functionality + Analytics |
| Usage Data → Product Interaction | Analytics |

Leave EVERYTHING else unticked (no Financial Info, no Location, no Health,
no Diagnostics, no Contacts).

Last question "Do you use data for tracking?" → **No**

🔴 **CLICK PUBLISH AT THE END.** If you don't publish, the error stays.

### 2c. Content Rights  (fixes "set up Content Rights Information")
Left sidebar → **App Information** → scroll to **Content Rights**
- "Does your app contain, show, or access third-party content?" → **No**
- While here, check the Privacy Policy URL is filled on this page too
  (same URL as above)
- Save

### 2d. DAC7  (fixes the compliance error)
Top nav → **Business** (older accounts: **Agreements, Tax, and Banking**)
→ find the **DAC7** section → fill the form.

It's an EU tax rule — Apple must report sellers based in the EU.
You'll need:
- Legal name + address
- **Individual:** date of birth + BSN (that's the tax ID / TIN)
- **Business (you have a KvK from the DSA step):** KvK number, RSIN/tax
  number, BTW number if you have one

Fill whichever matches how you enrolled. No waiting period.

---

## STEP 3 — Send the build to TestFlight (terminal)

When STEP 1 says **Build finished**, paste:

```
eas submit --platform ios --profile production
```

Pick the newest build if it asks. Then **wait 5–10 minutes** — Apple has to
process it before it shows up in App Store Connect.

---

## STEP 4 — Attach the build

App Store Connect → **YourLevel** → left sidebar **iOS App → 1.0 Prepare
for Submission** → scroll to the **Build** section → click the **⊕** →
pick the build you just uploaded → Done → **Save** (top right).

If no build appears, it's still processing. Wait 5 more minutes, refresh.

---

## STEP 5 — Final check before submitting

On that same version page, confirm all of this is filled:
- [ ] 5 screenshots
- [ ] Promotional text, Description, Keywords
- [ ] Support URL:
      `https://sudsy-tablecloth-e6b.notion.site/YourLevel-Support-3b7b7f726d9880f99606d0a22e2a84c2`
- [ ] Copyright: `2026 Mike de Boer`
- [ ] Build attached (Step 4)
- [ ] **App Review Information** → Sign-In Information:
      Username: `yourlevel.demo@gmail.com`
      Password: (the demo account's Google password)
- [ ] **Version Release** → "Manually release this version"

---

## STEP 6 — Submit 🚀

1. Top right → **Add for Review**
2. 🔴 **A SUMMARY SCREEN APPEARS. CHECK THAT "PRO MONTHLY" IS LISTED.**
   - If YES → continue.
   - If NO → stop, don't submit, tell Claude. (Submitting without it means
     launching with a paywall nobody can buy from.)
3. Answer the pop-up questions:
   - Export compliance / encryption → probably auto-answered. If asked:
     uses standard HTTPS only → **exempt**
   - Content rights / third-party content → **No**
   - Advertising Identifier (IDFA)? → **No**
4. Click **Submit to App Review**

Status becomes **Waiting for Review**. Done for the day. 🎉

---

## What happens after

- **Waiting for Review** → 24–48h
- **In Review** → a few hours
- Then either:
  - ✅ **Pending Developer Release** — approved! Nothing is public yet.
    You press **Release This Version** on the morning you want to launch.
  - ❌ **Rejected** — normal on a first try. A message appears in
    **Resolution Center**. Copy it word-for-word to Claude; it's almost
    always one small fix, and resubmissions get reviewed faster.

## If the build fails in Step 1
Copy the error and send it to Claude. The widget was already removed to
prevent the previous failure, so a failure now would be something new.
