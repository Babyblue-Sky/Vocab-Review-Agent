# Switching to clasp (stop copy-pasting code by hand)

This replaces the "copy from GitHub → paste into script.google.com → remember
to pick New Version → remember to check Who has access" routine with a couple
of terminal commands. Do this whenever you have some quiet time — no rush,
and nothing here touches your live script until the `clasp push` step.

## Why

Every recurring bug we chased (calendar link breaking, the 2838/undefined
review page) traced back to the manual sync between this GitHub repo and the
actual Apps Script project. `clasp` (Google's own command-line tool for Apps
Script) pushes files directly from a folder on your computer straight into
the Apps Script project — no copy-paste, no dropdown to get wrong.

## One-time setup

1. **Install Node.js**, if you don't already have it: https://nodejs.org
   (get the "LTS" version, just click through the installer)
2. Open Terminal and install clasp:
   ```
   npm install -g @google/clasp
   ```
3. Log clasp into your Google account:
   ```
   clasp login
   ```
   This opens a browser window — sign in as `tiana.liao74@gmail.com` and
   approve access. (One-time; it remembers you after this.)
4. Turn on the Apps Script API for your account (clasp needs this):
   go to https://script.google.com/home/usersettings and toggle
   **Google Apps Script API** to On.
5. **Get your Script ID:** open the Vocab Review Agent project at
   script.google.com → gear icon (Project Settings) → copy the
   **Script ID** shown there.
6. In your terminal, go into this repo's `apps-script/` folder and run:
   ```
   clasp clone <paste your Script ID here>
   ```
   Do this in a **separate empty folder** first (not directly inside the git
   repo) so it can pull down the real, current `appsscript.json` manifest
   file without any guessing — this repo doesn't have one checked in yet
   since the plain editor hides it by default. Once you have it, copy that
   `appsscript.json` file into `apps-script/` in this repo and commit it —
   from then on clasp has everything it needs to push straight from here.
7. Also copy the `.clasp.json` file that `clasp clone` created into
   `apps-script/` in this repo. It contains your Script ID (not secret, but
   also not something to bother committing differently — just check it in
   like any other config file).

## Day-to-day workflow after this

Whenever `Code.gs` or `Review.html` change in this repo:

```
cd apps-script
git pull
clasp push
```

`clasp push` uploads the files as the live "HEAD" version instantly — no
version dropdown involved. Your existing Web app deployment keeps serving
whatever was last explicitly deployed until you also run:

```
clasp deploy -i <deployment ID> -d "description of this update"
```

(Find `<deployment ID>` once via `clasp deployments` — it's the same
Deployment ID you've already seen in Manage Deployments, the one that
determines your `/exec` URL. Reusing it here is what keeps the URL stable
— this is the command-line equivalent of "New Version," done right every
time.)

## What this fixes

- No more partial/duplicated pastes from copying by hand
- No more picking the wrong option in the Version dropdown
- No more wondering whether "what's in the editor" matches "what's actually
  deployed" — `clasp push` + `clasp deploy -i` make that guarantee for you
