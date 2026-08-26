/**
 * 导游英语口语 PWA — 五景点讲解为主线（单文件模块）
 */

const SPEEDS = [0.8, 1.0, 1.1];
const STORAGE_KEY = "guide-oral-v2";
const IDB_NAME = "guide-dict-v1";
const IDB_STORE = "entries";

const MODULE_META = {
  scenic_qa: { label: "景点问答", blurb: "题库 · 与讲解互补", banner: "听范读 → 跟读 → 过关" },
  service_norms: { label: "导游规范", blurb: "服务脚本", banner: "先能开口用，再抠发音" },
  emergency: { label: "应变能力", blurb: "情景步骤语块", banner: "先看情景 → 口述 → 跟读" },
  general_knowledge: { label: "综合知识", blurb: "关键词骨架", banner: "定义 + 例子 + 评价" },
  c2e: { label: "汉译英", blurb: "听–译–对", banner: "先看中文说英文 → 再听标准英文" },
  e2c: { label: "英译汉", blurb: "听–译–对", banner: "先听英文 → 说中文 → 对照" },
};

const $ = (id) => document.getElementById(id);

let corpus = { sentences: [] };
let guidesIndex = { spots: [] };
let phrasePatches = {};
let guideLexicon = {};
let lexiconIndex = {};
let lexiconPhrases = [];
let state = loadState();

/** Guide reader */
let guide = null;
let gIdx = 0;
let gMode = "drill";
let gLoop = true;
let gSpeedIdx = 1;
let gPlaying = false;
let gRecorder = null;
let gMeUrl = null;
let dictTerm = "";
let dictSnapshot = null;
let dictContext = null;

/** Bank player */
let queue = [];
let qIdx = 0;
let qLoop = false;
let qSpeedIdx = 1;
let showZh = true;
let qRecorder = null;
let qRecording = false;
let qMeUrl = null;

/** Vocab */
let vocabDeck = [];
let vocabIdx = 0;
let vocabMode = "en2zh";

/* ── Persistence ── */

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultState() {
  return {
    today: todayKey(),
    todayListen: 0,
    todaySentenceIds: [],
    todaySavedNew: 0,
    todayShadow: 0,
    progress: {},
    weakWords: {},
    savedDict: [],
    lastGuide: null,
  };
}

function migrateState(s) {
  if (!Array.isArray(s.todaySentenceIds)) s.todaySentenceIds = [];
  if (typeof s.todaySavedNew !== "number") s.todaySavedNew = 0;
  if (Array.isArray(s.savedDict) && s.savedDict.length && typeof s.savedDict[0] === "string") {
    s.savedDict = s.savedDict.map((term) => ({
      term,
      savedAt: s.today || todayKey(),
      snapshot: null,
    }));
  }
  return s;
}

function loadState() {
  try {
    return migrateState({ ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") });
  } catch {
    return defaultState();
  }
}

function ensureToday() {
  if (state.today !== todayKey()) {
    state.today = todayKey();
    state.todayListen = 0;
    state.todaySentenceIds = [];
    state.todaySavedNew = 0;
    state.todayShadow = 0;
  }
}

function saveState() {
  ensureToday();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function recordListen(sentenceId) {
  if (!sentenceId) return;
  ensureToday();
  prog(sentenceId).listen += 1;
  state.todayListen += 1;
  if (!state.todaySentenceIds.includes(sentenceId)) {
    state.todaySentenceIds.push(sentenceId);
  }
  saveState();
}

function prog(id) {
  if (!state.progress[id]) state.progress[id] = { listen: 0, shadow: 0, passed: false };
  return state.progress[id];
}

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const el = $(`view-${name}`);
  if (el) el.classList.add("active");
}

function audioEl() {
  return $("audio");
}

function audioMe() {
  return $("audio-me");
}

function stopAudio() {
  const a = audioEl();
  a.pause();
  a.onended = null;
  a.onerror = null;
  a.onloadeddata = null;
  if (window.speechSynthesis) speechSynthesis.cancel();
  gPlaying = false;
  const gbp = $("btn-guide-play");
  if (gbp) {
    gbp.textContent = "▶";
    gbp.classList.remove("playing");
  }
  const bp = $("btn-play");
  if (bp) {
    bp.textContent = "▶";
    bp.classList.remove("playing");
  }
}

/* ── Home ── */

function spotStats(spotId, n) {
  let listen = 0;
  let shadow = 0;
  let touched = 0;
  for (let i = 1; i <= n; i++) {
    const id = `${spotId}-s${String(i).padStart(2, "0")}`;
    const p = state.progress[id];
    if (!p) continue;
    listen += p.listen || 0;
    shadow += p.shadow || 0;
    if ((p.listen || 0) + (p.shadow || 0) > 0) touched += 1;
  }
  return { listen, shadow, touched };
}

function renderHome() {
  ensureToday();
  const sentences = state.todaySentenceIds.length;
  const plays = state.todayListen;
  const saved = state.todaySavedNew;
  $("stat-sentences").textContent = String(sentences);
  $("stat-plays").textContent = String(plays);
  $("stat-saved").textContent = String(saved);
  const hint = $("today-hint");
  if (hint) hint.classList.toggle("hidden", sentences + plays + saved > 0);

  const list = $("spot-list");
  list.innerHTML = "";
  for (const spot of guidesIndex.spots) {
    const n = spot.sentenceCount || 0;
    const st = spotStats(spot.id, n);
    let status = "未开始";
    if (n && st.touched >= n) status = "已串讲";
    else if (st.touched > 0) status = `进行中 ${st.touched}/${n}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "spot-card";
    btn.innerHTML = `<strong>${spot.titleZh}</strong>
      <span class="en-title">${spot.titleEn}</span>
      <span class="meta">${spot.blurb} · ${n} 句</span>
      <span class="status">听 ${st.listen} · 跟 ${st.shadow} · ${status}</span>`;
    btn.onclick = () => openGuide(spot.id);
    list.appendChild(btn);
  }

  const counts = {};
  for (const s of corpus.sentences || []) counts[s.module] = (counts[s.module] || 0) + 1;
  const grid = $("module-grid");
  grid.innerHTML = "";
  for (const [key, meta] of Object.entries(MODULE_META)) {
    const n = counts[key] || 0;
    if (!n && key !== "c2e") continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mod";
    btn.innerHTML = `<strong>${meta.label}</strong><span>${meta.blurb} · ${n} 句</span>`;
    btn.onclick = () => openQueue(
      (corpus.sentences || []).filter((s) => s.module === key),
      meta.label,
      key
    );
    grid.appendChild(btn);
  }
}

/* ── Guide reader ── */

async function openGuide(spotId, resumeIndex) {
  stopAudio();
  const meta = guidesIndex.spots.find((s) => s.id === spotId);
  if (!meta) return;
  const res = await fetch(`./data/scenic_guides/${meta.file}`);
  guide = await res.json();
  if (typeof resumeIndex === "number") {
    gIdx = Math.min(Math.max(0, resumeIndex), guide.sentences.length - 1);
  } else if (state.lastGuide?.spotId === spotId) {
    gIdx = Math.min(state.lastGuide.index || 0, guide.sentences.length - 1);
  } else {
    gIdx = 0;
  }
  gMode = "drill";
  gLoop = true;
  gMeUrl = null;
  $("mode-drill").classList.add("on");
  $("mode-full").classList.remove("on");
  $("btn-guide-loop").classList.add("on");
  $("btn-guide-replay-me").classList.add("hidden");
  $("guide-title").textContent = guide.titleZh;
  $("guide-sub").textContent = guide.titleEn;
  renderGuideReader();
  highlightGuide(true);
  updateGuideChrome();
  updateAnchor();
  showView("guide");
  state.lastGuide = { spotId: guide.id, index: gIdx };
  saveState();
}

function renderGuideReader() {
  const root = $("guide-reader");
  root.innerHTML = "";
  const stopMap = Object.fromEntries((guide.stops || []).map((s) => [s.id, s]));
  let lastStop = null;
  guide.sentences.forEach((s, i) => {
    const pair = document.createElement("div");
    pair.className = "pair";
    pair.dataset.i = String(i);
    if (s.stopId !== lastStop) {
      lastStop = s.stopId;
      const stop = stopMap[s.stopId];
      if (stop) {
        const tag = document.createElement("span");
        tag.className = "stop-tag";
        tag.textContent = stop.title;
        pair.appendChild(tag);
      }
    }
    const en = document.createElement("p");
    en.className = "en";
    const ctx = { sentenceId: s.id, en: s.en, zh: s.zh };
    const phrases = [...new Set([...(s.focusPhrases || []), ...lexiconPhrases])];
    en.appendChild(tokenize(s.en, phrases, ctx));
    const zh = document.createElement("p");
    zh.className = "zh";
    zh.textContent = s.zh || "";
    pair.appendChild(en);
    pair.appendChild(zh);
    pair.addEventListener("click", (ev) => {
      if (ev.target.closest(".word")) return;
      gIdx = i;
      persistGuide();
      highlightGuide(true);
      updateGuideChrome();
      updateAnchor();
      playGuide();
    });
    root.appendChild(pair);
  });
}

function tokenize(text, phrases, ctx) {
  const frag = document.createDocumentFragment();
  const sorted = [...phrases].filter(Boolean).sort((a, b) => b.length - a.length);
  let rest = text;
  const pushPlain = (chunk) => {
    chunk.split(/(\s+|[,.;:!?"""''—–-])/).filter(Boolean).forEach((tok) => {
      if (/^[A-Za-z][A-Za-z'-]*$/.test(tok)) frag.appendChild(wordSpan(tok, ctx));
      else frag.appendChild(document.createTextNode(tok));
    });
  };
  while (rest.length) {
    let at = -1;
    let hit = null;
    for (const ph of sorted) {
      const idx = rest.toLowerCase().indexOf(ph.toLowerCase());
      if (idx >= 0 && (at < 0 || idx < at)) {
        at = idx;
        hit = rest.slice(idx, idx + ph.length);
      }
    }
    if (hit == null) {
      pushPlain(rest);
      break;
    }
    if (at > 0) pushPlain(rest.slice(0, at));
    frag.appendChild(wordSpan(hit, ctx));
    rest = rest.slice(at + hit.length);
  }
  return frag;
}

function wordSpan(text, ctx) {
  const span = document.createElement("span");
  span.className = "word";
  span.textContent = text;
  span.onclick = (e) => {
    e.stopPropagation();
    openDict(text.trim(), ctx);
  };
  return span;
}

function highlightGuide(scroll) {
  document.querySelectorAll("#guide-reader .pair").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.i) === gIdx);
  });
  if (scroll) {
    document.querySelector(`#guide-reader .pair[data-i="${gIdx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function updateGuideChrome() {
  if (!guide) return;
  const s = guide.sentences[gIdx];
  $("guide-pos").textContent = `${gIdx + 1} / ${guide.sentences.length}`;
  const p = prog(s.id);
  $("guide-ls").textContent = `听 ${p.listen} · 跟 ${p.shadow}`;
  $("btn-guide-speed").textContent = `${SPEEDS[gSpeedIdx].toFixed(1)}x`;
  $("btn-guide-loop").classList.toggle("on", gLoop);
  $("btn-guide-replay-me").classList.toggle("hidden", !gMeUrl);
}

function updateAnchor() {
  if (!guide) return;
  const s = guide.sentences[gIdx];
  const stop = (guide.stops || []).find((st) => st.id === s.stopId);
  if (!stop) {
    $("anchor-card").classList.add("hidden");
    return;
  }
  $("anchor-card").classList.remove("hidden");
  $("anchor-hook").textContent = `📍 ${stop.sceneHook || stop.title}`;
  const must = (stop.mustSay && stop.mustSay.length)
    ? stop.mustSay
    : (guide.mustSay || []).slice(0, 3);
  $("anchor-must").textContent = must.length ? `Must-say：${must.join(" · ")}` : "";
}

function persistGuide() {
  if (!guide) return;
  state.lastGuide = { spotId: guide.id, index: gIdx };
  saveState();
}

function curGuide() {
  return guide?.sentences?.[gIdx] || null;
}

function tryPlay(a, url, rate, onEnded) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    a.onerror = () => fin(false);
    a.onloadeddata = () => fin(!!(a.duration && isFinite(a.duration) && a.duration > 0.15));
    a.src = url;
    a.load();
    setTimeout(() => fin(a.readyState >= 2), 2500);
  }).then(async (ok) => {
    if (!ok) return false;
    try {
      a.playbackRate = rate;
      a.onended = onEnded;
      await a.play();
      return true;
    } catch {
      return false;
    }
  });
}

function speak(text, rate, onEnded) {
  if (!window.speechSynthesis) {
    alert("浏览器不支持语音，请先生成 MP3。");
    onEnded?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  const voices = speechSynthesis.getVoices();
  const v = voices.find((x) => /en-US/i.test(x.lang) && /neural|google|samantha|jenny|aria/i.test(x.name))
    || voices.find((x) => /en-US/i.test(x.lang));
  if (v) u.voice = v;
  u.onend = onEnded;
  speechSynthesis.speak(u);
}

async function playGuide() {
  const s = curGuide();
  if (!s) return;
  stopAudio();
  const a = audioEl();
  let ok = false;
  if (s.audio) ok = await tryPlay(a, s.audio, SPEEDS[gSpeedIdx], onGuideEnded);
  if (!ok) speak(s.en, SPEEDS[gSpeedIdx], onGuideEnded);
  gPlaying = true;
  $("btn-guide-play").textContent = "⏸";
  $("btn-guide-play").classList.add("playing");
}

function onGuideEnded() {
  const s = curGuide();
  if (s) {
    recordListen(s.id);
    updateGuideChrome();
    renderHome();
  }
  if (gMode === "drill") {
    if (gLoop) {
      playGuide();
      return;
    }
    gPlaying = false;
    $("btn-guide-play").textContent = "▶";
    $("btn-guide-play").classList.remove("playing");
    return;
  }
  if (gIdx < guide.sentences.length - 1) {
    gIdx += 1;
    persistGuide();
    highlightGuide(true);
    updateGuideChrome();
    updateAnchor();
    playGuide();
  } else {
    gPlaying = false;
    $("btn-guide-play").textContent = "▶";
    $("btn-guide-play").classList.remove("playing");
  }
}

function toggleGuidePlay() {
  const a = audioEl();
  if (gPlaying && (!a.paused || speechSynthesis?.speaking)) {
    stopAudio();
    return;
  }
  playGuide();
}

function guideGo(delta) {
  if (!guide) return;
  stopAudio();
  gIdx = Math.min(Math.max(0, gIdx + delta), guide.sentences.length - 1);
  gMeUrl = null;
  $("btn-guide-replay-me").classList.add("hidden");
  persistGuide();
  highlightGuide(true);
  updateGuideChrome();
  updateAnchor();
  if (gMode === "drill") playGuide();
}

async function toggleGuideRecord() {
  const s = curGuide();
  if (!s) return;
  if (gRecorder && gRecorder.state !== "inactive") {
    gRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    gRecorder = new MediaRecorder(stream);
    gRecorder.ondataavailable = (e) => chunks.push(e.data);
    gRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (gMeUrl) URL.revokeObjectURL(gMeUrl);
      gMeUrl = URL.createObjectURL(new Blob(chunks, { type: "audio/webm" }));
      prog(s.id).shadow += 1;
      state.todayShadow += 1;
      saveState();
      updateGuideChrome();
      renderHome();
      $("btn-guide-record").textContent = "跟读";
      $("btn-guide-record").classList.remove("recording");
      $("btn-guide-replay-me").classList.remove("hidden");
      $("guide-mic-hint").textContent = "已录好，可点「回听我的」对照范读";
    };
    gRecorder.start();
    $("btn-guide-record").textContent = "停止";
    $("btn-guide-record").classList.add("recording");
    $("guide-mic-hint").textContent = "录制中…再点一次停止";
  } catch {
    alert("无法使用麦克风，请允许本站录音。");
  }
}

function replayMe() {
  if (!gMeUrl) return;
  stopAudio();
  const a = audioMe();
  a.src = gMeUrl;
  a.play().catch(() => {});
}

function openStops() {
  if (!guide) return;
  const ul = $("stops-ul");
  ul.innerHTML = "";
  for (const stop of guide.stops || []) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<strong>${stop.title}</strong>
      <span class="hook">${stop.sceneHook || ""}</span>
      ${stop.mustSay?.length ? `<span class="must">Must-say：${stop.mustSay.join(" · ")}</span>` : ""}`;
    btn.onclick = () => {
      gIdx = stop.sentenceStart ?? 0;
      persistGuide();
      highlightGuide(true);
      updateGuideChrome();
      updateAnchor();
      closeStops();
      playGuide();
    };
    li.appendChild(btn);
    ul.appendChild(li);
  }
  $("stops-drawer").classList.remove("hidden");
}

function closeStops() {
  $("stops-drawer").classList.add("hidden");
}

/* ── Dictionary ── */

function buildLexiconIndex(lex) {
  const idx = {};
  for (const [key, entry] of Object.entries(lex)) {
    if (key === "_meta") continue;
    idx[key.toLowerCase()] = key;
    for (const f of entry.forms || []) idx[f.toLowerCase()] = key;
  }
  return idx;
}

function lookupLexicon(term) {
  if (!term) return null;
  if (guideLexicon[term]) return { key: term, entry: guideLexicon[term] };
  const low = term.toLowerCase();
  const key = lexiconIndex[low];
  if (key && guideLexicon[key]) return { key, entry: guideLexicon[key] };
  return null;
}

function formatZh(zh) {
  return (zh || "").replace(/\\n/g, " · ").trim();
}

function glossFromEntry(entry) {
  const s = entry?.senses?.[0];
  if (!s) return "";
  return formatZh(s.zh) || s.enDef || "";
}

function savedItem(raw) {
  if (typeof raw === "string") return { term: raw, savedAt: "", snapshot: null };
  return raw;
}

function findSaved(term) {
  const t = term.toLowerCase();
  return state.savedDict.find((x) => savedItem(x).term.toLowerCase() === t) || null;
}

function isDictSaved(term) {
  return !!findSaved(term);
}

function updateDictSaveBtn() {
  const btn = $("btn-dict-save");
  if (!btn) return;
  const saved = dictTerm && isDictSaved(dictTerm);
  btn.textContent = saved ? "已收藏 ✓" : "收藏";
  btn.classList.toggle("saved", saved);
  btn.disabled = !dictSnapshot;
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve) => {
      const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, val) {
  try {
    const db = await idbOpen();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

function findPatch(term) {
  const t = term.toLowerCase();
  for (const [k, v] of Object.entries(phrasePatches)) {
    if (k.toLowerCase() === t) return v;
  }
  for (const [k, v] of Object.entries(phrasePatches)) {
    if (t.includes(k.toLowerCase()) || k.toLowerCase().includes(t)) return v;
  }
  return null;
}

function normalizeDict(entry) {
  const phonetic = entry.phonetic
    || (entry.phonetics || []).map((p) => p.text).find(Boolean)
    || "";
  const audio = (entry.phonetics || []).map((p) => p.audio).find(Boolean);
  const meanings = [];
  for (const m of entry.meanings || []) {
    for (const d of (m.definitions || []).slice(0, 3)) {
      meanings.push({ pos: m.partOfSpeech, def: d.definition, example: d.example || "" });
    }
  }
  return { phonetic, audio, meanings: meanings.slice(0, 8) };
}

function renderLexicon(term, hit) {
  const { entry } = hit;
  $("dict-ipa").textContent = entry.ipa || "";
  const html = (entry.senses || []).map((s, i) => {
    const zh = formatZh(s.zh);
    const parts = [`<div class="sense-block"><p class="sense-zh">${zh || "—"}</p>`];
    if (s.enDef) parts.push(`<p class="sense-en">${s.enDef.replace(/\\n/g, "<br>")}</p>`);
    if (s.exampleEn) {
      parts.push(`<div class="ex">e.g. ${s.exampleEn}</div>`);
      if (s.exampleZh) parts.push(`<div class="ex ctx-zh">${s.exampleZh}</div>`);
    }
    parts.push("</div>");
    return `<h4>${entry.type === "phrase" ? "词组" : (entry.pos || `义项 ${i + 1}`)}</h4>${parts.join("")}`;
  }).join("");
  $("dict-body").innerHTML = html || "<p>无释义</p>";
  dictTerm = term;
  dictSnapshot = { ipa: entry.ipa || "", senses: entry.senses || [], type: entry.type || "word" };
  delete $("dict-body").dataset.audio;
  appendDictContext();
  updateDictSaveBtn();
}

function appendDictContext() {
  if (!dictContext?.zh) return;
  $("dict-body").insertAdjacentHTML("beforeend", `
    <div class="dict-context">
      <strong>本句语境</strong>
      <p>${dictContext.en || ""}</p>
      <p class="ctx-zh">${dictContext.zh}</p>
    </div>`);
}

function renderPatch(term, patch) {
  $("dict-ipa").textContent = patch.ipa || "";
  const senses = (patch.senses || []).map((s) => {
    if (typeof s === "object") return s;
    return { zh: patch.gloss || "", enDef: String(s) };
  });
  if (!senses.length && patch.gloss) senses.push({ zh: patch.gloss, enDef: "" });
  renderLexicon(term, { entry: { ipa: patch.ipa, senses, type: "phrase" } });
  $("dict-body").querySelector(".dict-context")?.remove();
  appendDictContext();
}

function renderDictLegacy(term, payload) {
  $("dict-ipa").textContent = payload.phonetic || "";
  const senses = (payload.meanings || []).map((m) => ({
    zh: m.def,
    enDef: "",
    exampleEn: m.example || "",
  }));
  renderLexicon(term, { entry: { ipa: payload.phonetic, senses, type: "word" } });
  if (payload.audio) $("dict-body").dataset.audio = payload.audio;
}

async function openDict(term, ctx) {
  dictContext = ctx || null;
  dictTerm = term.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, "").trim();
  if (!dictTerm) return;
  $("dict-word").textContent = dictTerm;
  $("dict-ipa").textContent = "";
  $("dict-body").innerHTML = "<p>加载中…</p>";
  $("dict-sheet").classList.remove("hidden");
  dictSnapshot = null;
  updateDictSaveBtn();

  const patch = findPatch(dictTerm);
  if (patch) {
    renderPatch(dictTerm, patch);
    return;
  }

  const hit = lookupLexicon(dictTerm);
  if (hit?.entry?.senses?.length) {
    renderLexicon(dictTerm, hit);
    return;
  }

  const cached = await idbGet(dictTerm.toLowerCase());
  if (cached?.meanings?.length) {
    renderDictLegacy(dictTerm, cached);
    return;
  }

  if (dictContext?.zh) {
    $("dict-ipa").textContent = "";
    $("dict-body").innerHTML = `<p>离线词库暂无该词条。</p>`;
    dictSnapshot = {
      ipa: "",
      senses: [{ zh: dictContext.zh, enDef: "", exampleEn: dictContext.en, exampleZh: dictContext.zh }],
      type: "word",
    };
    appendDictContext();
    updateDictSaveBtn();
    return;
  }

  $("dict-body").innerHTML = "<p>未找到释义。请在有中文讲解的句子里点词。</p>";
  dictSnapshot = null;
  updateDictSaveBtn();
}

function closeDict() {
  $("dict-sheet").classList.add("hidden");
}

function speakDict() {
  const url = $("dict-body").dataset.audio;
  if (url) {
    const a = audioMe();
    a.src = url;
    a.play().catch(() => speak(dictTerm, 1, null));
    return;
  }
  speak(dictTerm, 1, null);
}

function saveDictTerm() {
  if (!dictTerm || !dictSnapshot) return;
  ensureToday();
  const existing = findSaved(dictTerm);
  if (existing) {
    state.savedDict = state.savedDict.filter((x) => savedItem(x).term.toLowerCase() !== dictTerm.toLowerCase());
    saveState();
    updateDictSaveBtn();
    renderHome();
    return;
  }
  state.savedDict.push({
    term: dictTerm,
    savedAt: todayKey(),
    fromSentenceId: dictContext?.sentenceId || "",
    snapshot: dictSnapshot,
  });
  state.weakWords[dictTerm.toLowerCase()] = (state.weakWords[dictTerm.toLowerCase()] || 0) + 1;
  state.todaySavedNew += 1;
  saveState();
  updateDictSaveBtn();
  renderHome();
}

/* ── Bank player ── */

function openQueue(list, title, moduleKey) {
  if (!list.length) {
    alert("该模块暂无句子。");
    return;
  }
  queue = list.filter((s) => (s.en || "").trim().length > 8);
  if (!queue.length) queue = list;
  qIdx = 0;
  $("player-title").textContent = title;
  const meta = MODULE_META[moduleKey] || MODULE_META.scenic_qa;
  $("player-strategy").textContent = meta.blurb;
  $("mode-banner").textContent = meta.banner;
  $("view-player").dataset.module = moduleKey;
  showView("player");
  renderPlayer();
}

function curQ() {
  return queue[qIdx] || null;
}

function renderPlayer() {
  const s = curQ();
  if (!s) return;
  const moduleKey = $("view-player").dataset.module || s.module;
  $("score-panel").classList.add("hidden");
  $("en-text").textContent = s.en || "";
  $("zh-text").textContent = moduleKey === "c2e"
    ? (s.questionZh || s.zh || "")
    : (s.zh || s.questionZh || "");
  $("zh-text").classList.toggle("hidden", !showZh);
  const parts = [];
  if (s.spot) parts.push(`[${s.spot}]`);
  if (s.questionZh) parts.push(s.questionZh);
  $("q-label").textContent = parts.join(" · ");
  const fw = $("focus-words");
  fw.innerHTML = "";
  (s.focusWords || []).forEach((w) => {
    const b = document.createElement("b");
    b.textContent = w;
    fw.appendChild(b);
  });
  const p = prog(s.id);
  $("pos-label").textContent = `${qIdx + 1} / ${queue.length}`;
  $("ls-label").textContent = `听 ${p.listen} · 跟 ${p.shadow}${p.passed ? " · 已过关" : ""}`;
  $("btn-loop").classList.toggle("on", qLoop);
  $("btn-speed").textContent = `${SPEEDS[qSpeedIdx].toFixed(1)}x`;
  if (s.audio) {
    audioEl().src = s.audio;
    audioEl().playbackRate = SPEEDS[qSpeedIdx];
  }
}

async function playPlayer() {
  const s = curQ();
  if (!s) return;
  stopAudio();
  const a = audioEl();
  let ok = false;
  if (s.audio) ok = await tryPlay(a, s.audio, SPEEDS[qSpeedIdx], onPlayerEnded);
  if (!ok) speak(s.en, SPEEDS[qSpeedIdx], onPlayerEnded);
  $("btn-play").textContent = "⏸";
  $("btn-play").classList.add("playing");
}

function onPlayerEnded() {
  const s = curQ();
  if (s) {
    recordListen(s.id);
    renderPlayer();
    renderHome();
  }
  if (qLoop) {
    playPlayer();
    return;
  }
  $("btn-play").textContent = "▶";
  $("btn-play").classList.remove("playing");
}

function togglePlayerPlay() {
  const a = audioEl();
  if (!a.paused || speechSynthesis?.speaking) {
    stopAudio();
    return;
  }
  playPlayer();
}

function goPlayer(delta) {
  stopAudio();
  qIdx = (qIdx + delta + queue.length) % queue.length;
  renderPlayer();
}

function markPass() {
  const s = curQ();
  if (!s) return;
  prog(s.id).passed = true;
  saveState();
  renderPlayer();
  if (qIdx < queue.length - 1) goPlayer(1);
}

async function togglePlayerRecord() {
  const s = curQ();
  if (!s) return;
  if (qRecording) {
    qRecorder?.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    qRecorder = new MediaRecorder(stream);
    qRecorder.ondataavailable = (e) => chunks.push(e.data);
    qRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (qMeUrl) URL.revokeObjectURL(qMeUrl);
      qMeUrl = URL.createObjectURL(new Blob(chunks, { type: "audio/webm" }));
      prog(s.id).shadow += 1;
      state.todayShadow += 1;
      saveState();
      $("score-panel").classList.remove("hidden");
      $("score-num").textContent = "自听";
      $("score-detail").textContent = "已录音，可播放对照范读。";
      $("weak-list").innerHTML = `<audio controls src="${qMeUrl}"></audio>`;
      qRecording = false;
      $("btn-record").textContent = "跟读";
      $("mic-hint").textContent = "录音回听自查（不做纠音评分）";
      renderPlayer();
    };
    qRecorder.start();
    qRecording = true;
    $("btn-record").textContent = "停止";
    $("mic-hint").textContent = "录制中…再点停止";
  } catch {
    alert("无法使用麦克风。");
  }
}

/* ── Vocab ── */

function buildVocabDeck() {
  const items = [];
  for (const raw of state.savedDict) {
    const item = savedItem(raw);
    const snap = item.snapshot;
    const zh = snap?.senses?.[0]?.zh
      ? formatZh(snap.senses[0].zh)
      : (findPatch(item.term)?.gloss || glossFromEntry(lookupLexicon(item.term)?.entry) || "（已收藏）");
    items.push({ en: item.term, zh });
  }
  for (const [w, c] of Object.entries(state.weakWords)) {
    if (items.some((x) => x.en.toLowerCase() === w)) continue;
    const hit = lookupLexicon(w);
    items.push({ en: w, zh: hit ? glossFromEntry(hit.entry) : `弱项 ×${c}` });
  }
  for (const [en, patch] of Object.entries(phrasePatches)) {
    if (items.length >= 48) break;
    if (items.some((x) => x.en.toLowerCase() === en.toLowerCase())) continue;
    items.push({ en, zh: patch.gloss || (patch.senses || [])[0] || "" });
  }
  return items.length ? items : [{ en: "Danxia Landform", zh: "丹霞地貌" }];
}

function renderWordbook() {
  const ul = $("wordbook-ul");
  ul.innerHTML = "";
  const items = [...state.savedDict].reverse().map(savedItem);
  $("wordbook-empty").style.display = items.length ? "none" : "block";
  for (const item of items) {
    const li = document.createElement("li");
    const snap = item.snapshot;
    const gloss = snap?.senses?.[0]?.zh
      ? formatZh(snap.senses[0].zh)
      : (findPatch(item.term)?.gloss || glossFromEntry(lookupLexicon(item.term)?.entry) || "—");
    li.innerHTML = `<strong>${item.term}</strong>
      <div class="gloss">${gloss}</div>
      ${item.savedAt ? `<div class="meta">收藏于 ${item.savedAt}</div>` : ""}`;
    li.onclick = () => openDict(item.term, item.fromSentenceId ? { sentenceId: item.fromSentenceId } : null);
    ul.appendChild(li);
  }
}

function openWordbook() {
  renderWordbook();
  showView("wordbook");
}

function openVocab() {
  vocabDeck = buildVocabDeck();
  vocabIdx = 0;
  vocabMode = "en2zh";
  showView("vocab");
  renderVocab(false);
}

function renderVocab(reveal) {
  const card = vocabDeck[vocabIdx % vocabDeck.length];
  if (!card) return;
  if (vocabMode === "en2zh") {
    $("vocab-front").textContent = card.en;
    $("vocab-back").textContent = card.zh;
  } else if (vocabMode === "zh2en") {
    $("vocab-front").textContent = card.zh;
    $("vocab-back").textContent = card.en;
  } else {
    $("vocab-front").textContent = "（遮句）请口头复述英文，再显示对照";
    $("vocab-back").textContent = `${card.en}\n${card.zh}`;
  }
  $("vocab-back").classList.toggle("hidden", !reveal);
}

function renderWeak() {
  const entries = Object.entries(state.weakWords).sort((a, b) => b[1] - a[1]);
  const ul = $("weak-ul");
  ul.innerHTML = "";
  $("weak-empty").style.display = entries.length ? "none" : "block";
  for (const [w, c] of entries.slice(0, 80)) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${w}</span><span class="count">×${c}</span>`;
    li.onclick = () => openDict(w);
    ul.appendChild(li);
  }
}

/* ── Bind / boot ── */

function bind() {
  $("btn-bank-toggle").onclick = () => {
    const grid = $("module-grid");
    const collapsed = grid.classList.toggle("collapsed");
    $("btn-bank-toggle").classList.toggle("open", !collapsed);
    $("btn-bank-toggle").setAttribute("aria-expanded", collapsed ? "false" : "true");
  };
  $("btn-wordbook").onclick = () => openWordbook();
  $("btn-vocab").onclick = () => openVocab();
  $("btn-weak").onclick = () => { renderWeak(); showView("weak"); };
  $("btn-install-help").onclick = () => showView("install");
  $("btn-back-wordbook").onclick = () => showView("home");

  $("btn-guide-back").onclick = () => { stopAudio(); showView("home"); renderHome(); };
  $("btn-guide-menu").onclick = () => openStops();
  $("btn-stops-close").onclick = () => closeStops();
  $("stops-backdrop").onclick = () => closeStops();

  $("mode-drill").onclick = () => {
    gMode = "drill";
    gLoop = true;
    $("mode-drill").classList.add("on");
    $("mode-full").classList.remove("on");
    $("btn-guide-loop").classList.add("on");
    stopAudio();
  };
  $("mode-full").onclick = () => {
    gMode = "full";
    gLoop = false;
    $("mode-full").classList.add("on");
    $("mode-drill").classList.remove("on");
    $("btn-guide-loop").classList.remove("on");
    stopAudio();
  };

  $("btn-guide-prev").onclick = () => guideGo(-1);
  $("btn-guide-next").onclick = () => guideGo(1);
  $("btn-guide-play").onclick = () => toggleGuidePlay();
  $("btn-guide-loop").onclick = () => {
    gLoop = !gLoop;
    $("btn-guide-loop").classList.toggle("on", gLoop);
  };
  $("btn-guide-speed").onclick = () => {
    gSpeedIdx = (gSpeedIdx + 1) % SPEEDS.length;
    audioEl().playbackRate = SPEEDS[gSpeedIdx];
    updateGuideChrome();
  };
  $("btn-guide-record").onclick = () => toggleGuideRecord();
  $("btn-guide-replay-me").onclick = () => replayMe();

  $("btn-dict-close").onclick = () => closeDict();
  $("dict-backdrop").onclick = () => closeDict();
  $("btn-dict-speak").onclick = () => speakDict();
  $("btn-dict-save").onclick = () => saveDictTerm();

  $("btn-back").onclick = () => { stopAudio(); showView("home"); renderHome(); };
  $("btn-back-weak").onclick = () => showView("home");
  $("btn-back-install").onclick = () => showView("home");
  $("btn-back-vocab").onclick = () => showView("home");
  $("btn-clear-weak").onclick = () => {
    if (confirm("清空弱项词本？")) {
      state.weakWords = {};
      saveState();
      renderWeak();
    }
  };
  $("btn-toggle-zh").onclick = () => {
    showZh = !showZh;
    $("zh-text").classList.toggle("hidden", !showZh);
    $("btn-toggle-zh").textContent = showZh ? "中" : "英";
  };
  $("btn-prev").onclick = () => goPlayer(-1);
  $("btn-next").onclick = () => goPlayer(1);
  $("btn-play").onclick = () => togglePlayerPlay();
  $("btn-loop").onclick = () => { qLoop = !qLoop; renderPlayer(); };
  $("btn-speed").onclick = () => {
    qSpeedIdx = (qSpeedIdx + 1) % SPEEDS.length;
    audioEl().playbackRate = SPEEDS[qSpeedIdx];
    renderPlayer();
  };
  $("btn-record").onclick = () => togglePlayerRecord();
  $("btn-pass").onclick = () => markPass();

  $("btn-flash-en").onclick = () => { vocabMode = "en2zh"; renderVocab(false); };
  $("btn-flash-zh").onclick = () => { vocabMode = "zh2en"; renderVocab(false); };
  $("btn-cloak").onclick = () => { vocabMode = "cloak"; renderVocab(false); };
  $("btn-vocab-reveal").onclick = () => renderVocab(true);
  $("btn-vocab-next").onclick = () => {
    vocabIdx = (vocabIdx + 1) % vocabDeck.length;
    renderVocab(false);
  };
  $("btn-vocab-weak").onclick = () => {
    const card = vocabDeck[vocabIdx % vocabDeck.length];
    if (!card) return;
    const k = card.en.toLowerCase();
    state.weakWords[k] = (state.weakWords[k] || 0) + 1;
    saveState();
  };
}

async function loadData() {
  const [cRes, gRes, pRes, lRes] = await Promise.all([
    fetch("./data/corpus.json"),
    fetch("./data/scenic_guides/index.json"),
    fetch("./data/phrase_patches.json"),
    fetch("./data/lexicon/guide-lexicon.json"),
  ]);
  corpus = await cRes.json();
  guidesIndex = await gRes.json();
  if (pRes.ok) phrasePatches = await pRes.json();
  if (lRes.ok) {
    guideLexicon = await lRes.json();
    lexiconIndex = buildLexiconIndex(guideLexicon);
    lexiconPhrases = Object.keys(guideLexicon).filter(
      (k) => k !== "_meta" && guideLexicon[k].type === "phrase"
    );
  }
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (e) {
    console.warn("SW failed", e);
  }
}

async function main() {
  bind();
  await loadData();
  renderHome();
  registerSW();
  if (window.speechSynthesis) speechSynthesis.getVoices();
}

main().catch((e) => {
  console.error(e);
  alert("加载失败，请用本地服务器打开（见 README）。");
});
