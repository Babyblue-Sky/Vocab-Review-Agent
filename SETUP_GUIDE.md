# Setup Guide — Vocabulary Review Agent

Follow these steps in order — each one depends on the last.

## Step 1 — Create the Apps Script project

1. Go to **script.google.com** → **New project**
2. Rename the project (top left) to **Vocab Review Agent**
3. When the project opens, you'll already see a file called `Code.gs` in the
   left sidebar under "Files" — click it to open it. It'll have a few lines
   of placeholder code (something like `function myFunction() {}`) already
   in the editor pane on the right — select all of that (Ctrl+A / Cmd+A) and
   delete it. Then unzip `apps-script-files.zip` (from my earlier message),
   open the `Code.gs` file inside it in any text editor (like Notepad or
   TextEdit), copy its entire contents, and paste them into the now-empty
   editor pane in Apps Script
4. Click the **+** next to "Files" in the left sidebar → **HTML** → name it
   exactly `Review` (it becomes `Review.html`) → a new, empty file opens;
   delete any placeholder content. Now go find the `Review.html` file inside
   your unzipped `apps-script-files` folder — **don't double-click it**,
   since that will just open it as a (blank-looking) webpage in your browser.
   Instead, right-click it → **Open with** → choose a plain text editor
   (Notepad on Windows, TextEdit on Mac — if TextEdit opens it formatted
   instead of as code, use Cmd+Shift+T inside TextEdit first to switch it to
   plain text mode). Once you can see the actual code as text, select all,
   copy, and paste it into the empty `Review.html` file in Apps Script

## Step 2 — Add your API keys as Script Properties

1. Click the **gear icon** (Project Settings) on the left sidebar
2. Scroll to **Script Properties** → **Add script property**
3. Add these two (paste your real keys from Merriam-Webster's account page):
   - `MW_LEARNERS_KEY` → your Learner's Dictionary key
   - `MW_COLLEGIATE_KEY` → your Collegiate Dictionary key
4. *(Optional, only if you want the Claude fallback for words/idioms Merriam-Webster
   doesn't have)* Add `ANTHROPIC_API_KEY` → a key from **console.anthropic.com**.
   Important: this is entirely separate from your claude.ai Pro subscription —
   Pro only covers chat usage here, not API usage. The API console works on
   pay-as-you-go credit (commonly a $5 minimum to start), and each fallback
   lookup would draw a small fraction of a cent from that balance. If you skip
   this, lookups that Merriam-Webster can't find will just fail gracefully with
   an error message instead of a definition — everything else still works fine.

   **To find/create the key once you've added credit:**
   1. Go to **console.anthropic.com** and sign in (this may be a separate
      login from claude.ai, or the same one, depending on how your account
      was set up)
   2. In the left sidebar, click **API Keys**
   3. Click **Create Key**
   4. Give it a name (e.g., "Vocab Review Agent") and click **Create**
   5. Copy the key immediately — it's shown only once. If you lose it, you'll
      need to create a new one (the old one can be deleted from that same
      page)
   6. Paste it into the `ANTHROPIC_API_KEY` script property in Apps Script,
      the same way you did for the Merriam-Webster keys.

## Step 3 — Deploy as a Web App

1. Top right: **Deploy** → **New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Settings:
   - **Execute as:** Me
   - **Who has access:** Anyone

   (Important: "Anyone" is required here, not "Only myself" — your extension
   calls this URL with a plain web request that isn't signed into your
   Google account, so "Only myself" would silently block it with a login
   redirect instead of running the script. "Anyone" doesn't expose your data
   broadly in practice, since nobody can reach it without this exact, long,
   unguessable URL — but it's worth knowing it's not authentication-gated
   the way "Only myself" would be.)
4. Click **Deploy**
5. **Authorize** when prompted (it's your own script, acting on your own
   Sheets/Calendar — this is expected and safe)
6. Copy the **Web app URL** it gives you (looks like
   `https://script.google.com/macros/s/AKfycb.../exec`) — you'll need this
   again in Step 5
7. Go back to **Project Settings** (gear icon) → **Script Properties** →
   **Add script property**, and add one more:
   - `WEB_APP_URL` → paste the exact Web app URL you just copied

   (This locks your calendar reminders to this specific URL forever, instead
   of the script re-detecting "the current URL" every time it creates a
   reminder. It matters because of a gotcha explained in Step 7 below — if
   you ever update the code and accidentally create a *new* deployment
   instead of a new version of the existing one, the auto-detected URL would
   silently change and any reminder already sitting on your calendar for a
   future date would stop working. With `WEB_APP_URL` set, that can't happen
   — reminders always use the URL you've told your extension and bookmarks
   about.)

## Step 4 — Set up the schedule (one-time)

1. Back in the Apps Script editor, make sure **`Code.gs`** is the file
   currently open (click it in the left sidebar if it isn't — the function
   dropdown only appears/works when a `.gs` file is active, not when
   `Review.html` is open). Along the top toolbar, near the **Run** button
   (a play/triangle icon ▷) and **Debug** button, there's a small dropdown
   box — it likely already shows some other function name by default (often
   whichever function comes first alphabetically, like `doGet` or `doPost`).
   Click that dropdown and choose **setupTriggers** from the list
2. Click **Run**
3. Authorize again if prompted
4. This creates the two triggers: weekly (Sundays 7am) and a daily check for
   the monthly review (fires only on the 2nd-to-last day of the month)

You can verify these exist anytime under the **clock icon** (Triggers) on the
left sidebar.

## Step 5 — Install the extension

1. Unzip `vocab-capture-personal.zip`
2. Open `config.js` in a text editor, replace `PASTE_YOUR_WEB_APP_URL_HERE`
   with the Web App URL from Step 3
3. In Chrome, go to `chrome://extensions`
4. Turn on **Developer mode** → **Load unpacked** → select the unzipped
   `vocab-capture-personal` folder
5. Test it: double-click a word on any page, or select a phrase and press
   Ctrl+Shift+S (Cmd+Shift+S on Mac)

## Step 6 — Let it run

That's it — from here, the agent runs on its own:
- Every Sunday at 7am, it checks the past week's words and puts a review
  link on your Google Calendar for 10am that day
- On the 2nd-to-last day of each month, it does the same for the whole
  month's words

Come back after a few weeks of real use and we'll refine anything that
needs adjusting.

## Step 7 — Updating the script later (read this before you edit Code.gs again)

When you want to change `Code.gs` or `Review.html` after the initial setup —
whether that's pasting in a fix yourself or pasting in something Claude gave
you — the code in the editor updates immediately, but the **live web app
does not** until you redeploy. There are two very different-looking buttons
for this, and picking the wrong one is what caused the broken calendar
links:

1. Paste in your updated code and save.
2. Click **Deploy** → **Manage deployments**.
3. Find your existing "Web app" deployment in the list and click the
   **pencil (edit) icon** next to it — do **not** click "New deployment".
4. Where it says **Version**, change the dropdown from a specific old
   version to **New version**.
5. Click **Deploy**.

This publishes your changes to the *same* URL you already have saved in
`WEB_APP_URL`, your extension's `config.js`, and anywhere else you've used
it — nothing breaks.

**If you (or an assistant) ever do click "New deployment" by mistake:** you'll
get a brand-new URL. If that happens, you must update it in *three* places
to fully recover: the `WEB_APP_URL` script property (Step 3.7), the
extension's `config.js` (Step 5), and any reminder already sitting on your
calendar for a future date (just edit that calendar event's description, or
delete it — the next scheduled trigger run will create a correct one).
