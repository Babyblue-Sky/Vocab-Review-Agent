// Double-click a single word -> save as "word"
document.addEventListener("dblclick", (e) => {
  const selection = window.getSelection().toString().trim();
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(selection)) return; // must look like an actual word, not a stray symbol/number
  saveAndShow(selection, "word", e.pageX, e.pageY);
});

// Ctrl+Shift+S / Cmd+Shift+S (relayed from background.js) -> save selection as "idiom"
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "save-phrase") {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;
    const range = window.getSelection().getRangeAt(0).getBoundingClientRect();
    saveAndShow(selection, "idiom", range.left + window.scrollX, range.bottom + window.scrollY);
  }
});

function saveAndShow(text, type, x, y) {
  showBubble(text, type, x, y, "Looking up...", null);

  fetch(WEBAPP_URL, {
    method: "POST",
    body: JSON.stringify({ word: text, type: type })
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        showBubble(text, type, x, y, "Couldn't save: " + data.error, null);
        return;
      }
      showBubble(text, type, x, y, data.definition, data.example, data.audioUrl, data.status);
    })
    .catch(() => showBubble(text, type, x, y, "Connection error — check your Wi-Fi.", null));
}

function showBubble(word, type, x, y, message, example, audioUrl, status) {
  const existing = document.getElementById("vocab-bubble");
  if (existing) existing.remove();

  const bubble = document.createElement("div");
  bubble.id = "vocab-bubble";
  bubble.innerHTML = `
    <span id="vocab-close">\u2715</span>
    <div class="vocab-type">${type}</div>
    <div class="vocab-word">${word}${audioUrl ? ' <button id="vocab-audio">\uD83D\uDD0A</button>' : ""}</div>
    <div class="vocab-msg">${message}</div>
    ${example ? `<div class="vocab-example">${example}</div>` : ""}
    ${status ? `<div class="vocab-status">${status === "duplicate" ? "Already in your Word Bank \u2014 refreshed date" : "Saved to Word Bank \u2713"}</div>` : ""}
  `;
  bubble.style.left = `${x}px`;
  bubble.style.top = `${y + 16}px`;
  document.body.appendChild(bubble);

  document.getElementById("vocab-close").onclick = () => bubble.remove();
  if (audioUrl) {
    document.getElementById("vocab-audio").onclick = () => new Audio(audioUrl).play();
  }
}
