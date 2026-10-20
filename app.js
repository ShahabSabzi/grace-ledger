/* Grace Ledger app logic. Plain JavaScript, no libraries. */
(() => {
  "use strict";

  /* ---------- Data setup ---------- */
  const STORE_KEY = "graceLedger.v1";
  const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI","XXII","XXIII","XXIV","XXV","XXVI","XXVII","XXVIII","XXIX","XXX","XXXI","XXXII"];
  const CAT_LABEL = {
    demigod: "Demigod", great: "Great enemy", field: "Field boss",
    dungeon: "Dungeon boss", evergaol: "Evergaol", dragon: "Dragon", god: "Final boss"
  };

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const regionById = Object.fromEntries(REGIONS.map((r, i) => [r.id, { ...r, order: i }]));

  // Give every boss a stable id and a global progression number.
  const bosses = [];
  REGIONS.forEach(r => {
    BOSSES.filter(b => b.r === r.id).forEach(b => {
      bosses.push({ ...b, id: slug(b.r + "-" + b.n), dlc: !!(b.dlc || r.dlc), order: bosses.length + 1 });
    });
  });
  const bossById = Object.fromEntries(bosses.map(b => [b.id, b]));

  /* ---------- Storage ---------- */
  const newProfile = name => ({
    name, created: Date.now(), level: "", bosses: {},
    settings: { dlc: true, hideFelled: false }
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.profiles && s.active && s.profiles[s.active]) return s;
      }
    } catch (e) { /* storage blocked or broken: start fresh */ }
    const id = "p" + Date.now().toString(36);
    return { active: id, profiles: { [id]: newProfile("First playthrough") } };
  }
  let state = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  const P = () => state.profiles[state.active];
  const rec = id => P().bosses[id] || (P().bosses[id] = {});
  const isFelled = id => !!(P().bosses[id] && P().bosses[id].k);
  const deathsOf = id => (P().bosses[id] && P().bosses[id].d) || 0;
  const visibleBosses = () => bosses.filter(b => P().settings.dlc || !b.dlc);

  /* ---------- Helpers ---------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = ts => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const levelText = r => r.dlc
    ? `Level ${r.lv[0]}+, Scadutree Blessing ${r.blessing}`
    : `Suggested level ${r.lv[0]} to ${r.lv[1]}`;
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // Jump straight to the boss page on the Fextralife wiki.
  // Location tags in brackets are dropped, since the wiki groups repeats on one page.
  // A boss can set its own search text with the "w" field in data/bosses.js.
  function wikiUrl(b) {
    const name = b.w || b.n.replace(/\s*\(.*?\)\s*/g, " ").trim();
    return "https://duckduckgo.com/?q=" + encodeURIComponent("\\" + name + " site:eldenring.wiki.fextralife.com");
  }

  function tipsFor(b) {
    const out = [...(b.tips || [])];
    TYPE_TIPS.forEach(t => { if (b.n.includes(t.match)) out.push(...t.tips); });
    out.push(...(CATEGORY_TIPS[b.c] || []));
    return [...new Set(out)];
  }

  /* ---------- Header tally ---------- */
  function renderTally() {
    const list = visibleBosses();
    const done = list.filter(b => isFelled(b.id)).length;
    $("#tally").innerHTML = `<b>${done}</b> of ${list.length} bosses felled`;
    $("#tallyBar").style.width = (list.length ? (done / list.length) * 100 : 0) + "%";
    $("#profilePill").textContent = P().name;
  }

  /* ---------- Boss list ---------- */
  const filters = new Set();
  const closed = new Set(JSON.parse(sessionStorageGet("gl.closed") || "[]"));
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function matches(b, q) {
    if (filters.has("alive") && isFelled(b.id)) return false;
    if (filters.has("felled") && !isFelled(b.id)) return false;
    if (filters.has("main") && !b.main) return false;
    if (filters.has("night") && !b.night) return false;
    if (filters.has("miss") && !b.miss) return false;
    if (P().settings.hideFelled && !filters.has("felled") && isFelled(b.id)) return false;
    if (!q) return true;
    const hay = (b.n + " " + b.g + " " + b.loc + " " + regionById[b.r].name).toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }

  function rowHTML(b) {
    const d = deathsOf(b.id);
    const tags = [
      b.main ? '<span class="tag main">Main path</span>' : "",
      b.night ? '<span class="tag night">Night</span>' : "",
      b.miss ? '<span class="tag miss">Missable</span>' : ""
    ].join("");
    return `<li class="row${isFelled(b.id) ? " is-felled" : ""}" data-id="${b.id}">
      <button type="button" class="check" data-act="toggle" aria-label="${isFelled(b.id) ? "Unmark" : "Mark"} ${esc(b.n)} as felled" aria-pressed="${isFelled(b.id)}"><i>${CHECK_SVG}</i></button>
      <button type="button" class="row-main" data-act="open">
        <span class="name">${esc(b.n)}</span>
        <span class="sub"><span>Near ${esc(b.g)}</span>${tags}${d ? `<span class="deaths">${d} death${d === 1 ? "" : "s"}</span>` : ""}</span>
      </button>
    </li>`;
  }

  function renderList() {
    const q = $("#search").value.trim().toLowerCase();
    const searching = q.length > 0 || filters.size > 0;
    let html = "";
    let dlcShown = false;
    REGIONS.forEach((r, i) => {
      if (r.dlc && !P().settings.dlc) return;
      const all = bosses.filter(b => b.r === r.id);
      const shown = all.filter(b => matches(b, q));
      if (!shown.length) return;
      if (r.dlc && !dlcShown) {
        html += '<h2 class="dlc-break">Shadow of the Erdtree</h2>';
        dlcShown = true;
      }
      const done = all.filter(b => isFelled(b.id)).length;
      const isClosed = closed.has(r.id) && !searching;
      html += `<section class="chapter${isClosed ? " is-closed" : ""}${done === all.length ? " is-done" : ""}" data-region="${r.id}">
        <button type="button" class="chapter-head" data-act="fold" aria-expanded="${!isClosed}">
          <span class="numeral">${ROMAN[i] || i + 1}</span>
          <span class="chapter-name">${esc(r.name)}<span class="chev" aria-hidden="true">&#9662;</span></span>
          <span class="chapter-count">${done}/${all.length}</span>
          <span class="chapter-meta">${esc(levelText(r))}</span>
          <span class="chapter-bar"><span style="width:${(done / all.length) * 100}%"></span></span>
        </button>
        <ul class="rows">${shown.map(rowHTML).join("")}</ul>
      </section>`;
    });
    $("#list").innerHTML = html || `<div class="empty"><strong>No bosses match</strong>Clear the search or turn off a filter.</div>`;
  }

  $("#list").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "fold") {
      const id = btn.closest(".chapter").dataset.region;
      closed.has(id) ? closed.delete(id) : closed.add(id);
      sessionStorageSet("gl.closed", JSON.stringify([...closed]));
      btn.closest(".chapter").classList.toggle("is-closed");
      btn.setAttribute("aria-expanded", !closed.has(id));
      return;
    }
    const id = btn.closest(".row").dataset.id;
    if (btn.dataset.act === "toggle") toggleFelled(id);
    if (btn.dataset.act === "open") openSheet(id);
  });

  $("#search").addEventListener("input", renderList);
  $("#chips").addEventListener("click", e => {
    const c = e.target.closest(".chip");
    if (!c) return;
    const f = c.dataset.f;
    if (filters.has(f)) filters.delete(f);
    else {
      filters.add(f);
      // Alive and Felled cancel each other.
      if (f === "alive") filters.delete("felled");
      if (f === "felled") filters.delete("alive");
    }
    document.querySelectorAll(".chip").forEach(x => x.classList.toggle("is-on", filters.has(x.dataset.f)));
    renderList();
  });

  /* ---------- Felled toggle with undo ---------- */
  let toastTimer = null;
  let undoFn = null;

  function toggleFelled(id, fromSheet) {
    const r = rec(id);
    const prev = r.k || null;
    r.k = prev ? null : Date.now();
    if (!r.k) delete r.k;
    save();
    const b = bossById[id];
    if (r.k) showFelled();
    if (!fromSheet) toast(r.k ? `${b.n} felled` : `${b.n} marked alive`, () => {
      const rr = rec(id);
      if (prev) rr.k = prev; else delete rr.k;
      save();
      refreshAll();
      if (!$("#sheet").hidden && sheetId === id) openSheet(id);
    });
    refreshAll();
    if (fromSheet) openSheet(id);
  }

  function toast(text, undo) {
    $("#toastText").textContent = text;
    undoFn = undo;
    $("#toastUndo").hidden = !undo;
    $("#toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("#toast").hidden = true; undoFn = null; }, 4500);
  }
  function hideToast() { clearTimeout(toastTimer); $("#toast").hidden = true; undoFn = null; }
  $("#toastUndo").addEventListener("click", () => {
    if (undoFn) undoFn();
    undoFn = null;
    $("#toast").hidden = true;
  });

  function showFelled() {
    const el = $("#felled");
    el.classList.remove("show");
    void el.offsetWidth; // restart the animation
    el.classList.add("show");
  }

  /* ---------- Detail sheet ---------- */
  let sheetId = null;
  let lastFocus = null;

  function openSheet(id) {
    const b = bossById[id];
    const r = regionById[b.r];
    const data = P().bosses[id] || {};
    sheetId = id;
    const tips = tipsFor(b);
    $("#sheetBody").innerHTML = `
      <h2 id="sheetTitle">${esc(b.n)}</h2>
      <p class="where">${esc(r.name)}. ${esc(CAT_LABEL[b.c] || b.c)}${b.main ? ", main path" : ""}${b.night ? ", night only" : ""}. Boss ${b.order} of ${bosses.length}.</p>
      <dl class="facts">
        <dt>How to get there</dt><dd>${esc(b.loc)}</dd>
        <dt>Nearest grace or area</dt><dd>${esc(b.g)}</dd>
        <dt>Level guide</dt><dd>${esc(levelText(r))}</dd>
        ${b.d ? `<dt>Drops</dt><dd>${esc(b.d)}</dd>` : ""}
        ${tips.length ? `<dt>Tips</dt><dd><ul>${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul></dd>` : ""}
      </dl>
      ${b.note ? `<div class="note-warn">${esc(b.note)}</div>` : ""}
      <a class="btn ghost wiki" href="${esc(wikiUrl(b))}" target="_blank" rel="noopener">View on wiki</a>
      <p class="hint wiki-hint">Opens the Fextralife wiki page with pictures and videos.</p>
      <div class="counter">
        <div class="label">Deaths<small>Tap + each time this boss gets you</small></div>
        <button type="button" class="round" data-act="dec" aria-label="Remove a death">&minus;</button>
        <span class="num" id="deathNum">${data.d || 0}</span>
        <button type="button" class="round" data-act="inc" aria-label="Add a death">+</button>
      </div>
      <div class="field">
        <label for="noteBox">Notes</label>
        <textarea id="noteBox" class="notes" placeholder="Build, summons, what worked">${esc(data.n || "")}</textarea>
      </div>
      <button type="button" class="btn${data.k ? " ghost" : ""}" data-act="felled">${data.k ? "Mark as alive" : "Mark as felled"}</button>
      ${data.k ? `<p class="felled-on">Felled ${esc(fmtDate(data.k))}</p>` : ""}
      <button type="button" class="btn ghost" data-act="close">Close</button>`;
    hideToast();
    if ($("#sheet").hidden) lastFocus = document.activeElement;
    $("#scrim").hidden = false;
    $("#sheet").hidden = false;
    document.body.style.overflow = "hidden";
    $("#sheetTitle").setAttribute("tabindex", "-1");
    $("#sheetTitle").focus({ preventScroll: true });
  }

  function closeSheet() {
    saveNote();
    $("#scrim").hidden = true;
    $("#sheet").hidden = true;
    document.body.style.overflow = "";
    sheetId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function saveNote() {
    const box = $("#noteBox");
    if (!box || !sheetId) return;
    const v = box.value.trim();
    const r = rec(sheetId);
    if (v) r.n = v; else delete r.n;
    save();
  }

  $("#sheet").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !sheetId) return;
    const r = rec(sheetId);
    switch (btn.dataset.act) {
      case "inc": r.d = (r.d || 0) + 1; break;
      case "dec": r.d = Math.max(0, (r.d || 0) - 1); if (!r.d) delete r.d; break;
      case "felled": saveNote(); toggleFelled(sheetId, true); return;
      case "close": closeSheet(); return;
    }
    save();
    $("#deathNum").textContent = r.d || 0;
    refreshAll();
  });
  $("#sheet").addEventListener("input", e => { if (e.target.id === "noteBox") { clearTimeout(saveNote.t); saveNote.t = setTimeout(saveNote, 400); } });
  $("#scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

  // Swipe the sheet down to close.
  (() => {
    let y0 = null;
    const sheet = $("#sheet");
    sheet.addEventListener("touchstart", e => {
      const body = $("#sheetBody");
      y0 = body.scrollTop <= 0 ? e.touches[0].clientY : null;
    }, { passive: true });
    sheet.addEventListener("touchend", e => {
      if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) closeSheet();
      y0 = null;
    });
  })();

  /* ---------- Next target ---------- */
  function renderNext() {
    const lvl = parseInt(P().level, 10);
    const alive = visibleBosses().filter(b => !isFelled(b.id));
    const view = $("#view-next");
    if (!alive.length) {
      view.innerHTML = `<div class="empty"><strong>Every boss felled</strong>Start a new playthrough in Settings to track NG+.</div>`;
      return;
    }
    const fits = b => !lvl || regionById[b.r].lv[0] <= lvl;
    const pool = alive.filter(fits);
    const next = pool[0] || alive[0];
    const after = (pool.length ? pool : alive).slice(1, 6);
    const reg = regionById[next.r];
    const regionMiss = alive.filter(b => b.r === next.r && b.miss && b.id !== next.id);
    view.innerHTML = `
      <div class="next-hero">
        <div class="kicker">Next in order${lvl ? `, for level ${lvl}` : ""}</div>
        <h2>${esc(next.n)}</h2>
        <p>${esc(reg.name)}. Near ${esc(next.g)}.</p>
        <p>${esc(next.loc)}</p>
        <div class="row-actions">
          <button type="button" class="btn ghost" data-open="${next.id}">Details</button>
          <button type="button" class="btn" data-fell="${next.id}">Mark felled</button>
        </div>
      </div>
      ${!pool.length && lvl ? `<p class="hint">Every remaining boss sits above level ${lvl}. Showing the next one anyway.</p>` : ""}
      ${regionMiss.length ? `<h3 class="section-title">Missable in ${esc(reg.name)}</h3>
        <ul class="rows">${regionMiss.map(rowHTML).join("")}</ul>` : ""}
      <h3 class="section-title">Up after that</h3>
      <ul class="rows">${after.map(rowHTML).join("")}</ul>
      <p class="hint">Set your rune level in Settings to skip areas above your level.</p>`;
  }
  $("#view-next").addEventListener("click", e => {
    const o = e.target.closest("[data-open]");
    const f = e.target.closest("[data-fell]");
    if (o) return openSheet(o.dataset.open);
    if (f) return toggleFelled(f.dataset.fell);
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".row").dataset.id;
    if (btn.dataset.act === "toggle") toggleFelled(id);
    if (btn.dataset.act === "open") openSheet(id);
  });

  /* ---------- Stats ---------- */
  function renderStats() {
    const list = visibleBosses();
    const felled = list.filter(b => isFelled(b.id));
    const totalDeaths = list.reduce((s, b) => s + deathsOf(b.id), 0);
    const hardest = list.filter(b => deathsOf(b.id) > 0).sort((a, b) => deathsOf(b.id) - deathsOf(a.id)).slice(0, 5);
    const groups = [
      ["Base game", list.filter(b => !b.dlc)],
      ["Shadow of the Erdtree", list.filter(b => b.dlc)],
      ["Main path", list.filter(b => b.main)],
      ["Demigods and final bosses", list.filter(b => b.c === "demigod" || b.c === "god")]
    ].filter(g => g[1].length);

    // Kills per day, newest first, last 7 active days.
    const days = {};
    felled.forEach(b => {
      const k = new Date(P().bosses[b.id].k).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      days[k] = (days[k] || 0) + 1;
    });
    const dayList = Object.entries(days)
      .map(([k, v]) => [k, v, Math.max(...felled.filter(b => new Date(P().bosses[b.id].k).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) === k).map(b => P().bosses[b.id].k))])
      .sort((a, b) => b[2] - a[2]).slice(0, 7);
    const maxDay = Math.max(1, ...dayList.map(d => d[1]));
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

    $("#view-stats").innerHTML = `
      <div class="big-stats">
        <div><b>${felled.length}</b><span>Felled</span></div>
        <div><b>${list.length - felled.length}</b><span>Remaining</span></div>
        <div><b>${totalDeaths}</b><span>Deaths</span></div>
      </div>
      <h3 class="section-title">Progress</h3>
      <ul class="lines">${groups.map(([name, g]) => {
        const d = g.filter(b => isFelled(b.id)).length;
        return `<li><span>${esc(name)}</span><span class="val">${d}/${g.length}</span><span class="meter"><span style="width:${pct(d, g.length)}%"></span></span></li>`;
      }).join("")}</ul>
      <h3 class="section-title">Hardest bosses</h3>
      ${hardest.length ? `<ul class="lines">${hardest.map(b => `<li><span>${esc(b.n)}</span><span class="val">${deathsOf(b.id)} deaths</span></li>`).join("")}</ul>`
        : `<p class="hint">Log deaths on a boss page with the + button. Your toughest fights show up here.</p>`}
      <h3 class="section-title">Kills per day</h3>
      ${dayList.length ? `<ul class="lines">${dayList.map(([k, v]) => `<li><span>${esc(k)}</span><span class="val">${v}</span><span class="meter"><span style="width:${pct(v, maxDay)}%"></span></span></li>`).join("")}</ul>`
        : `<p class="hint">Mark a boss as felled to start the log.</p>`}
      <h3 class="section-title">By region</h3>
      <ul class="lines">${REGIONS.filter(r => P().settings.dlc || !r.dlc).map(r => {
        const g = bosses.filter(b => b.r === r.id);
        const d = g.filter(b => isFelled(b.id)).length;
        return `<li><span>${esc(r.name)}</span><span class="val">${d}/${g.length}</span><span class="meter"><span style="width:${pct(d, g.length)}%"></span></span></li>`;
      }).join("")}</ul>`;
  }

  /* ---------- Settings and profiles ---------- */
  function renderSettings() {
    const p = P();
    const opts = Object.entries(state.profiles)
      .map(([id, pr]) => `<option value="${id}"${id === state.active ? " selected" : ""}>${esc(pr.name)}</option>`).join("");
    $("#view-settings").innerHTML = `
      <h3 class="section-title">Playthrough</h3>
      <div class="field">
        <label for="profileSel">Active playthrough</label>
        <select id="profileSel">${opts}</select>
      </div>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-set="new">New</button>
        <button type="button" class="btn ghost" data-set="rename">Rename</button>
        <button type="button" class="btn ghost" data-set="dup">Duplicate</button>
        <button type="button" class="btn danger" data-set="del">Delete</button>
      </div>
      <div class="field">
        <label for="lvl">Your rune level</label>
        <input id="lvl" type="number" inputmode="numeric" min="1" max="713" placeholder="Example: 45" value="${esc(p.level)}">
      </div>
      <h3 class="section-title">List</h3>
      <label class="switch"><span>Include Shadow of the Erdtree</span><input type="checkbox" id="optDlc" ${p.settings.dlc ? "checked" : ""}></label>
      <label class="switch"><span>Hide felled bosses</span><input type="checkbox" id="optHide" ${p.settings.hideFelled ? "checked" : ""}></label>
      <h3 class="section-title">Backup</h3>
      <p class="hint">Progress lives on this device only. Export a backup before you clear Safari data or switch phones.</p>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-set="export">Export</button>
        <button type="button" class="btn ghost" data-set="import">Import</button>
      </div>
      <button type="button" class="btn danger" data-set="reset">Reset this playthrough</button>
      <p class="foot">${bosses.length} bosses. Grace Ledger is a fan-made tracker, not affiliated with FromSoftware or Bandai Namco.</p>`;
  }

  $("#view-settings").addEventListener("change", e => {
    const t = e.target;
    if (t.id === "profileSel") { state.active = t.value; save(); refreshAll(); renderSettings(); }
    if (t.id === "lvl") { P().level = t.value.trim(); save(); refreshAll(); }
    if (t.id === "optDlc") { P().settings.dlc = t.checked; save(); refreshAll(); }
    if (t.id === "optHide") { P().settings.hideFelled = t.checked; save(); refreshAll(); }
  });

  $("#view-settings").addEventListener("click", e => {
    const b = e.target.closest("[data-set]");
    if (!b) return;
    const act = b.dataset.set;
    if (act === "new") {
      const name = prompt("Name for the new playthrough", "NG+ " + Object.keys(state.profiles).length);
      if (!name) return;
      const id = "p" + Date.now().toString(36);
      state.profiles[id] = newProfile(name.trim());
      state.active = id;
    }
    if (act === "rename") {
      const name = prompt("New name", P().name);
      if (!name) return;
      P().name = name.trim();
    }
    if (act === "dup") {
      const id = "p" + Date.now().toString(36);
      const copy = JSON.parse(JSON.stringify(P()));
      copy.name = P().name + " copy";
      copy.created = Date.now();
      state.profiles[id] = copy;
      state.active = id;
    }
    if (act === "del") {
      if (Object.keys(state.profiles).length === 1) { alert("Keep at least one playthrough. Use Reset to clear it."); return; }
      if (!confirm(`Delete "${P().name}" and all its progress?`)) return;
      delete state.profiles[state.active];
      state.active = Object.keys(state.profiles)[0];
    }
    if (act === "reset") {
      if (!confirm(`Clear every check, death count and note in "${P().name}"?`)) return;
      P().bosses = {};
    }
    if (act === "export") return exportData();
    if (act === "import") return $("#importFile").click();
    save(); refreshAll(); renderSettings();
  });

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: "grace-ledger", version: 1, exported: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grace-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  $("#importFile").addEventListener("change", async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.profiles || !data.active || !data.profiles[data.active]) throw new Error("bad file");
      if (!confirm("Replace all playthroughs on this device with the backup?")) return;
      state = { active: data.active, profiles: data.profiles };
      save(); refreshAll(); renderSettings();
      toast("Backup imported", null);
    } catch (err) {
      alert("This file is not a Grace Ledger backup. Pick a .json file made with Export.");
    }
  });

  $("#profilePill").addEventListener("click", () => switchView("settings"));

  /* ---------- Views ---------- */
  let current = "bosses";
  function switchView(v) {
    current = v;
    hideToast();
    document.querySelectorAll(".view").forEach(s => { s.hidden = s.id !== "view-" + v; });
    document.querySelectorAll(".tab").forEach(t => {
      const on = t.dataset.view === v;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-current", on ? "page" : "false");
    });
    if (v === "next") renderNext();
    if (v === "stats") renderStats();
    if (v === "settings") renderSettings();
    window.scrollTo(0, 0);
  }
  document.querySelector(".tabs").addEventListener("click", e => {
    const t = e.target.closest(".tab");
    if (t) switchView(t.dataset.view);
  });

  function refreshAll() {
    renderTally();
    renderList();
    if (current === "next") renderNext();
    if (current === "stats") renderStats();
  }

  /* ---------- Start ---------- */
  refreshAll();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
