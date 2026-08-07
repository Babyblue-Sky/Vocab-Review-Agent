/**
 * Tian's Vocabulary Review — Apps Script backend
 * ------------------------------------------------
 * Handles: word/idiom capture (from the extension & bookmarklet),
 * weekly + monthly review scheduling, Google Calendar reminders,
 * and serving the review webpage.
 *
 * SETUP REQUIRED before this will work — see setup guide.
 */

const WORD_BANK_SHEET_ID = '1oxFk0BJTCwdhZAtjJPzw2GCvzbIjUCjkl-iIVQggS0k';
const REVIEW_LOG_SHEET_ID = '1MYNRK0SDayTJjsFp9U34Exmo8RkLajhANYydzdlHaE8';
const CALENDAR_ID = 'tiana.liao74@gmail.com'; // personal calendar only

function getProp_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new Error('Missing script property: ' + key + '. Set it under Project Settings > Script Properties.');
  return value;
}

// ---------- CAPTURE (called by the extension & bookmarklet) ----------

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const word = (body.word || '').trim();
    const type = body.type === 'idiom' ? 'idiom' : 'word';

    if (!word) return jsonResponse_({ error: 'No word provided.' });

    const sheet = SpreadsheetApp.openById(WORD_BANK_SHEET_ID).getSheets()[0];
    const existingRow = findExistingRow_(sheet, word);

    if (existingRow) {
      // Dedup: refresh the date instead of adding a duplicate row.
      sheet.getRange(existingRow, 6).setValue(new Date()); // column F = Date Saved
      const data = sheet.getRange(existingRow, 1, 1, 7).getValues()[0];
      return jsonResponse_({
        status: 'duplicate', word: data[0], definition: data[2], example: data[3], audioUrl: data[4]
      });
    }

    const entry = lookupWord_(word, type);
    sheet.appendRow([word, type, entry.definition, entry.example, entry.audioUrl || '', new Date(), '']);

    return jsonResponse_({ status: 'saved', word: word, definition: entry.definition, example: entry.example, audioUrl: entry.audioUrl });
  } catch (err) {
    return jsonResponse_({ error: err.message });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function findExistingRow_(sheet, word) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === word.toLowerCase()) return i + 1;
  }
  return null;
}

// ---------- DICTIONARY LOOKUP ----------

function lookupWord_(word, type) {
  if (type === 'idiom') return lookupViaClaude_(word, true);

  const mwResult = lookupMerriamWebster_(word);
  if (mwResult) return mwResult;

  return lookupViaClaude_(word, false); // fallback if MW has nothing usable
}

function lookupMerriamWebster_(word) {
  const learnersKey = getProp_('MW_LEARNERS_KEY');
  let json = fetchMW_(word, 'learners', learnersKey);
  let usedLearners = isUsableMWEntry_(json);

  if (!usedLearners) {
    const collegiateKey = getProp_('MW_COLLEGIATE_KEY');
    json = fetchMW_(word, 'collegiate', collegiateKey);
  }
  if (!isUsableMWEntry_(json)) return null;

  const entry = json[0];
  const shortdef = (entry.shortdef && entry.shortdef[0]) || '';

  let example = '';
  try {
    const vis = entry.def[0].sseq[0][0][1].dt.find(function (d) { return d[0] === 'vis'; });
    if (vis) example = vis[1][0].t.replace(/\{it\}|\{\/it\}/g, '');
  } catch (e) { /* no example available */ }

  let audioUrl = extractAudioUrl_(entry);

  // Learner's had a usable definition but no audio field — check Collegiate for audio only.
  if (!audioUrl && usedLearners) {
    const collegiateKey = getProp_('MW_COLLEGIATE_KEY');
    const collegiateJson = fetchMW_(word, 'collegiate', collegiateKey);
    if (isUsableMWEntry_(collegiateJson)) {
      audioUrl = extractAudioUrl_(collegiateJson[0]);
    }
  }

  return { definition: shortdef, example: example, audioUrl: audioUrl };
}

function extractAudioUrl_(entry) {
  try {
    const audio = entry.hwi.prs[0].sound.audio;
    const subdir = audio.indexOf('bix') === 0 ? 'bix'
      : audio.indexOf('gg') === 0 ? 'gg'
      : /^[0-9]/.test(audio) ? 'number'
      : audio.charAt(0);
    return 'https://media.merriam-webster.com/audio/prons/en/us/mp3/' + subdir + '/' + audio + '.mp3';
  } catch (e) {
    return '';
  }
}

function fetchMW_(word, dict, key) {
  const url = 'https://dictionaryapi.com/api/v3/references/' + dict + '/json/' + encodeURIComponent(word) + '?key=' + key;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return JSON.parse(res.getContentText());
}

function isUsableMWEntry_(json) {
  return Array.isArray(json) && json.length > 0 && typeof json[0] === 'object' && json[0].meta;
}

// ---------- CLAUDE FALLBACK (optional — requires its own API key) ----------

function lookupViaClaude_(term, isIdiom) {
  const apiKey = getProp_('ANTHROPIC_API_KEY');
  const prompt = isIdiom
    ? 'Define the English idiom/expression "' + term + '" in one simple sentence, then give one natural example sentence using it. Respond ONLY as JSON: {"definition": "...", "example": "..."}'
    : 'Define the English word "' + term + '" simply, like a learner\'s dictionary would, then give one natural example sentence using it. Respond ONLY as JSON: {"definition": "...", "example": "..."}';

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  const data = JSON.parse(res.getContentText());
  const text = data.content[0].text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);
  return { definition: parsed.definition, example: parsed.example, audioUrl: '' };
}

// ---------- SCHEDULED REVIEWS ----------

function weeklyReviewTrigger() {
  const words = getWordsSince_(7);
  if (words.length === 0) return;
  const sessionId = new Date().getFullYear() + '-W' + getWeekNumber_(new Date());
  logReview_('weekly', words, sessionId);
  createReminder_('Weekly Vocab Review \uD83D\uDCDA', buildReviewUrl_('weekly'), nextSunday_(10));
}

function monthlyReviewCheck() {
  if (!isSecondToLastDayOfMonth_(new Date())) return;
  const words = getWordsThisMonth_();
  if (words.length === 0) return;
  const sessionId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  logReview_('monthly', words, sessionId);

  const when = new Date();
  when.setHours(18, 0, 0, 0); // adjust the time if you'd like the monthly reminder elsewhere
  createReminder_('Monthly Vocab Review \uD83D\uDCD6', buildReviewUrl_('monthly'), when);
}

function getWordsSince_(days) {
  const sheet = SpreadsheetApp.openById(WORD_BANK_SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.slice(1).filter(function (row) { return row[5] instanceof Date && row[5] >= cutoff; });
}

function getWordsThisMonth_() {
  const sheet = SpreadsheetApp.openById(WORD_BANK_SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  return data.slice(1).filter(function (row) {
    return row[5] instanceof Date && row[5].getMonth() === now.getMonth() && row[5].getFullYear() === now.getFullYear();
  });
}

function isSecondToLastDayOfMonth_(date) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === lastDay - 1;
}

function nextSunday_(hour) {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(hour, 0, 0, 0);
  return d;
}

function logReview_(sessionType, words, sessionId) {
  const logSheet = SpreadsheetApp.openById(REVIEW_LOG_SHEET_ID).getSheets()[0];
  logSheet.appendRow([new Date(), sessionType, words.map(function (w) { return w[0]; }).join(', ')]);

  const wordSheet = SpreadsheetApp.openById(WORD_BANK_SHEET_ID).getSheets()[0];
  const data = wordSheet.getDataRange().getValues();
  words.forEach(function (w) {
    const rowIndex = data.findIndex(function (r) { return r[0] === w[0]; });
    if (rowIndex > 0) {
      const cell = wordSheet.getRange(rowIndex + 1, 7);
      const existing = cell.getValue();
      cell.setValue(existing ? existing + ', ' + sessionId : sessionId);
    }
  });
}

function getWeekNumber_(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function createReminder_(title, url, when) {
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  cal.createEvent(title, when, new Date(when.getTime() + 30 * 60000), {
    description: 'Time for your vocab review! Open it here: ' + url
  });
}

function buildReviewUrl_(sessionType) {
  // Prefer the WEB_APP_URL script property (set once in Step 3 of the setup
  // guide) over ScriptApp.getService().getUrl(). That way, calendar reminders
  // always point at the URL you actually deployed and shared with yourself,
  // even if a future redeploy is done incorrectly (e.g. "New deployment"
  // instead of "New version", which mints a different /exec URL).
  const lockedUrl = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  const base = lockedUrl || ScriptApp.getService().getUrl();
  return base + '?session=' + sessionType;
}

// ---------- ONE-TIME SETUP: run this once from the editor ----------

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['weeklyReviewTrigger', 'monthlyReviewCheck'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('weeklyReviewTrigger').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(7).create();
  ScriptApp.newTrigger('monthlyReviewCheck').timeBased().everyDays(1).atHour(6).create();
}

// ---------- REVIEW PAGE ACTIONS (called via google.script.run from Review.html) ----------

function deleteWord(word) {
  const sheet = SpreadsheetApp.openById(WORD_BANK_SHEET_ID).getSheets()[0];
  const row = findExistingRow_(sheet, word);
  if (row) sheet.deleteRow(row);
}

// ---------- SERVE THE REVIEW WEBPAGE ----------

function doGet(e) {
  const sessionType = (e.parameter.session || 'weekly');
  const words = sessionType === 'monthly' ? getWordsThisMonth_() : getWordsSince_(7);

  const wordData = words.map(function (w) {
    return { word: w[0], type: w[1], definition: w[2], example: w[3], audioUrl: w[4] };
  });

  const template = HtmlService.createTemplateFromFile('Review');
  template.wordDataJson = JSON.stringify(wordData);
  template.sessionType = sessionType;
  return template.evaluate().setTitle('Vocabulary Review');
}
