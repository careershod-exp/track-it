# Track It — Android App (Google Play)

This turns the already-live Track It website into a real, installable Android
app using **Trusted Web Activity (TWA)** — Google's own officially-supported
way to package a PWA as a Play Store app. No rewriting of the app itself is
needed; this wraps the site you already have.

Follow these steps in order, on your own computer (not in any AI chat).

## Before you start

You'll need:
- **Node.js** installed (you already used this to run `npm install` earlier
  in this project — same thing). Check with `node --version` in Terminal;
  install from nodejs.org if that fails.
- **Java (JDK 17)** — a free download from
  https://adoptium.net (pick the "Temurin 17 LTS" version for your OS).
  Bubblewrap (the tool below) needs this to build the app.
- About 15 minutes and a stable internet connection (the first build
  downloads the Android SDK, which is a few hundred MB).

## Step 1 — Install Bubblewrap

Bubblewrap is Google's own official command-line tool for exactly this.

```bash
npm install -g @bubblewrap/cli
```

## Step 2 — Initialize the project

Run this in a new empty folder (not inside your `track-it-app` project —
this creates a separate Android project):

```bash
mkdir track-it-android
cd track-it-android
bubblewrap init --manifest=https://www.trackituae.com/manifest.webmanifest
```

It will ask you a series of questions. Answer them exactly like this
(press Enter to accept anything it already guessed correctly from the site):

| Prompt | Answer |
|---|---|
| Domain | `www.trackituae.com` |
| URL path | `/` |
| Application name | `Track It` |
| Short name | `Track It` |
| **Application ID (package name)** | `com.trackituae.app` |
| Display mode | `standalone` |
| Status bar color | `#1c2b22` |
| Splash screen color | `#1c2b22` |
| Icon URL | (it should auto-detect `icon-512.png` — accept it) |
| Maskable icon | (accept the same one if asked) |
| Include app shortcuts | No |
| Signing key | Let it create a new one (see the warning below) |

The first time you run this, it will offer to download the Android SDK and
Java tools automatically — say yes. This is the slow part (a few hundred MB).

## ⚠️ Step 3 — Back up your signing key immediately

Once `init` finishes, you'll have a new file: `android.keystore` (in the
`track-it-android` folder). **This is the single most important file in this
entire process.**

- It's the digital signature that proves every future update to the app
  really came from you.
- **If you lose it, you can never update this app again** — you'd have to
  publish a brand new app listing from scratch and lose all reviews,
  ratings, and install history.
- Copy it somewhere safe right now: a password manager's file storage, a
  private cloud drive, an external drive — anywhere durable, **not just this
  one folder on this one computer**.
- It also asks you to set a keystore password and a key password during
  creation — write those down too. You'll need all three (the file + both
  passwords) for every future update.

## Step 4 — Connect the app to your website (Digital Asset Links)

This is the step that lets the app open your site with **no browser address
bar showing** — Android needs proof you own both the app and the website.

Get your app's unique fingerprint:

```bash
keytool -list -v -keystore android.keystore -alias trackit
```

(It'll ask for the keystore password you set in Step 3.) Look for a line
that says `SHA256:` followed by a long string of pairs like
`14:6D:E9:83:C5:73...` — copy that whole string.

Now, back in your **track-it-app** project (the website code), open:

```
public/.well-known/assetlinks.json
```

Replace `REPLACE_WITH_YOUR_KEYSTORE_SHA256_FINGERPRINT` with the fingerprint
you just copied, keeping the colons. Then push it live the normal way:

```bash
git add .
git commit -m "Add Android app asset links"
git push
```

Once deployed, you can double check it worked by visiting
`https://www.trackituae.com/.well-known/assetlinks.json` in a browser — you
should see the JSON with your real fingerprint in it, not the placeholder.

## Step 5 — Build the app

Back in the `track-it-android` folder:

```bash
bubblewrap build
```

This produces `app-release-bundle.aab` — the actual file you'll upload to
Google Play.

## Step 6 — Create your Google Play Developer account

1. Go to https://play.google.com/console/signup
2. Pay the one-time $25 registration fee
3. Verify your identity (Google may ask for a government ID — normal for
   all new developer accounts)
4. Approval usually takes a few hours to 2 days

## Step 7 — Create the app listing

In the Play Console, click **Create app**, then fill in:
- **App name:** Track It
- **Short description / full description:** what the app does (I can help
  write these if you'd like)
- **App icon**, **feature graphic**, and a few **screenshots** — I can help
  generate these from the app's existing branding
- **Privacy policy URL** — use the in-app Data & Privacy Policy page, or a
  dedicated URL if you'd prefer one
- **Content rating questionnaire** — a short survey Google requires (Track
  It will land in "Everyone" given no mature content)
- Upload the `app-release-bundle.aab` file from Step 5 under **Production**
  → **Create new release**

## Step 8 — Submit for review

Google's review is typically much faster than Apple's — often a few hours
to a couple of days for a straightforward app like this.

## After it's approved

For any future update to the app (a new feature, a bug fix), you don't
repeat this whole process — you just:
1. Bump `appVersionCode` and `appVersionName` in `twa-manifest.json`
2. Run `bubblewrap update` then `bubblewrap build` again
3. Upload the new `.aab` to Play Console as a new release

Your website itself (trackituae.com) can keep being updated normally at any
time through the usual `git push` — those changes show up in the Android
app automatically too, since it's just opening the live site. You only need
to repeat the Play Console upload steps when something about the *app
shell itself* changes (its name, icon, colors, version number) — not for
regular feature updates to the app's content.
