/**
 * 导游英语影子跟读 PWA
 * Modules: scenic_qa / service_norms / emergency / general_knowledge / e2c (+ curated c2e seed)
 */

const SPEEDS = [0.8, 1.0, 1.1];
const DAILY_GOAL = 20;
const STORAGE_KEY = "guide-shadow-v1";

const MODULE_META = {
  scenic_qa: {
    label: "景点问答",
    strategy: "shadowing",
    blurb: "100LS 影子跟读 · 导游腔清晰略慢",
    banner: "听 3 遍 → 小声跟 3 遍 → 录 1 遍纠音 → 过关",
  },
  service_norms: {
    label: "导游规范",
    strategy: "roleplay",
    blurb: "脚本记忆 + 角色扮演（你=地陪）",
    banner: "先能开口用，再抠发音。欢迎辞等模板优先过关。",
  },
  emergency: {
    label: "应变能力",
    strategy: "task",
    blurb: "DLI 任务导向 · 步骤语块 First / Then",
    banner: "先看情景 → 口述步骤 → 再跟读标准答（别死背整篇）",
  },
  general_knowledge: {
    label: "综合知识",
    strategy: "keywords",
    blurb: "关键词锚点 · 三句骨架",
    banner: "定义一句 + 例子一句 + 评价一句。重点跟读答案正文。",
  },
  c2e: {
    label: "汉译英",
    strategy: "interpret",
    blurb: "听–译–对 循环",
    banner: "先看中文说英文 → 再听标准英文学舌跟读",
  },
  e2c: {
    label: "英译汉",
    strategy: "interpret",
    blurb: "听–译–对 循环",
    banner: "先听美音英文 → 说中文 → 对照范文",
  },
};

/** Curated commute-first packs (Danxia + welcome) */
const SEED_FILTERS = {
  danxia: (s) => s.module === "scenic_qa" && s.spot === "Danxia",
  welcome: (s) => s.id.startsWith("service_norms-welcome"),
};

let corpus = { modules: {}, sentences: [] };
let queue = [];
let index = 0;
let speedIdx = 1;
let loopOn = false;
let showZh = true;
let recording = false;
let mediaRecorder = null;
let recognition = null;
let state = loadState();

const $ = (id) => document.getElementById(id);
const audioEl = () => $("audio");

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return {
    today: todayKey(),
    todayPassed: 0,
    progress: {}, // id -> { listen, shadow, passed }
    weakWords: {}, // word -> count
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function saveState() {
  if (state.today !== todayKey()) {
    state.today = todayKey();
    state.todayPassed = 0;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function prog(id) {
  if (!state.progress[id]) state.progress[id] = { listen: 0, shadow: 0, passed: false };
  return state.progress[id];
}

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $(`view-${name}`).classList.add("active");
}

function current() {
  return queue[index] || null;
}

function audioUrl(s) {
  if (!s?.audio) return null;
  // s.audio like "audio/scenic_qa/xxx.mp3"
  return s.audio;
}

async function playSentence() {
  const s = current();
  if (!s) return;
  stopSpeech();
  const a = audioEl();
  a.pause();
  a.onended = null;
  a.onerror = null;
  const url = audioUrl(s);
  let usedFile = false;
  if (url) {
    usedFile = await new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      a.onerror = () => finish(false);
      a.onloadeddata = () => {
        if (a.duration && isFinite(a.duration) && a.duration > 0.2) finish(true);
        else finish(false);
      };
      a.src = url;
      a.load();
      setTimeout(() => finish(a.readyState >= 2), 2500);
    });
    if (usedFile) {
      try {
        a.playbackRate = SPEEDS[speedIdx];
        a.onended = () => {
          $("btn-play").textContent = "▶";
          $("btn-play").classList.remove("playing");
          if (loopOn) playSentence();
        };
        await a.play();
      } catch {
        usedFile = false;
      }
    }
  }
  if (!usedFile) {
    speakFallback(s.en);
  }
  $("btn-play").textContent = "⏸";
  $("btn-play").classList.add("playing");
  const p = prog(s.id);
  p.listen += 1;
  saveState();
  renderPlayerMeta();
}

function stopSpeech() {
  if (window.speechSynthesis) speechSynthesis.cancel();
}

function speakFallback(text) {
  if (!window.speechSynthesis) {
    alert("当前浏览器不支持语音，请先生成 MP3 音频。");
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = SPEEDS[speedIdx];
  const voices = speechSynthesis.getVoices();
  const us = voices.find((v) => /en-US/i.test(v.lang) && /neural|google|samantha|jenny|aria/i.test(v.name))
    || voices.find((v) => /en-US/i.test(v.lang));
  if (us) u.voice = us;
  u.onend = () => {
    $("btn-play").textContent = "▶";
    $("btn-play").classList.remove("playing");
    if (loopOn) playSentence();
  };
  speechSynthesis.speak(u);
}

function pausePlay() {
  const a = audioEl();
  if (!a.paused) {
    a.pause();
    $("btn-play").textContent = "▶";
    $("btn-play").classList.remove("playing");
    return;
  }
  if (window.speechSynthesis?.speaking) {
    speechSynthesis.cancel();
    $("btn-play").textContent = "▶";
    $("btn-play").classList.remove("playing");
    return;
  }
  playSentence();
}

function renderHome() {
  if (state.today !== todayKey()) {
    state.today = todayKey();
    state.todayPassed = 0;
    saveState();
  }
  $("today-goal").textContent = `${state.todayPassed} / ${DAILY_GOAL} 句`;
  $("today-bar").style.width = `${Math.min(100, (state.todayPassed / DAILY_GOAL) * 100)}%`;

  const counts = {};
  for (const s of corpus.sentences) {
    counts[s.module] = (counts[s.module] || 0) + 1;
  }

  const grid = $("module-grid");
  grid.innerHTML = "";

  // Seed shortcuts first
  const seeds = [
    { id: "seed-danxia", title: "★ 丹霞问答（通勤首包）", desc: "种子精练 · 影子跟读", filter: "danxia", module: "scenic_qa" },
    { id: "seed-welcome", title: "★ 欢迎辞（开口必说）", desc: "规范模板 · 角色扮演", filter: "welcome", module: "service_norms" },
  ];
  for (const seed of seeds) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mod";
    btn.innerHTML = `<strong>${seed.title}</strong><span>${seed.desc}</span><span class="tag">${MODULE_META[seed.module].banner}</span>`;
    btn.onclick = () => openQueue(corpus.sentences.filter(SEED_FILTERS[seed.filter]), seed.title, seed.module);
    grid.appendChild(btn);
  }

  for (const [key, meta] of Object.entries(MODULE_META)) {
    const n = counts[key] || 0;
    if (!n && key !== "c2e") continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mod";
    btn.innerHTML = `<strong>${meta.label}</strong><span>${meta.blurb} · ${n} 句</span><span class="tag">${meta.strategy}</span>`;
    btn.onclick = () => openQueue(
      corpus.sentences.filter((s) => s.module === key),
      meta.label,
      key
    );
    grid.appendChild(btn);
  }
}

function openQueue(list, title, moduleKey) {
  if (!list.length) {
    alert("该模块暂无句子，请先运行语料抽取。");
    return;
  }
  // Prefer sentences with usable English for shadowing
  queue = list.filter((s) => (s.en || "").trim().length > 8);
  if (!queue.length) queue = list;
  index = 0;
  $("player-title").textContent = title;
  const meta = MODULE_META[moduleKey] || MODULE_META.scenic_qa;
  $("player-strategy").textContent = meta.blurb;
  $("mode-banner").textContent = meta.banner;
  $("view-player").dataset.module = moduleKey;
  showView("player");
  renderSentence();
}

function renderSentence() {
  const s = current();
  if (!s) return;
  const moduleKey = $("view-player").dataset.module || s.module;
  $("score-panel").classList.add("hidden");
  $("en-text").textContent = s.en || "";
  $("zh-text").textContent = s.zh || s.questionZh || "";
  // 口译汉译英：默认先看中文题干，再跟读英文
  if (moduleKey === "c2e") {
    showZh = true;
    $("zh-text").textContent = s.questionZh || s.zh || "";
    $("btn-toggle-zh").textContent = "中";
  }
  $("zh-text").classList.toggle("hidden", !showZh);
  const qParts = [];
  if (s.spot) qParts.push(`[${s.spot}]`);
  if (moduleKey === "emergency" || moduleKey === "service_norms") {
    if (s.questionZh) qParts.push(s.questionZh);
    else if (s.questionEn) qParts.push(s.questionEn);
  } else if (s.questionZh) {
    qParts.push(s.questionZh);
  }
  $("q-label").textContent = qParts.join(" · ");
  const fw = $("focus-words");
  fw.innerHTML = "";
  (s.focusWords || []).forEach((w) => {
    const b = document.createElement("b");
    b.textContent = w;
    fw.appendChild(b);
  });
  renderPlayerMeta();
  const url = audioUrl(s);
  if (url) {
    audioEl().src = url;
    audioEl().playbackRate = SPEEDS[speedIdx];
  }
}

function renderPlayerMeta() {
  const s = current();
  if (!s) return;
  $("pos-label").textContent = `${index + 1} / ${queue.length}`;
  const p = prog(s.id);
  $("ls-label").textContent = `听 ${p.listen} · 跟 ${p.shadow}${p.passed ? " · 已过关" : ""}`;
  $("btn-loop").classList.toggle("on", loopOn);
  $("btn-speed").textContent = `${SPEEDS[speedIdx].toFixed(1)}x`;
}

function go(delta) {
  stopSpeech();
  audioEl().pause();
  $("btn-play").textContent = "▶";
  $("btn-play").classList.remove("playing");
  index = (index + delta + queue.length) % queue.length;
  renderSentence();
}

function markPass() {
  const s = current();
  if (!s) return;
  const p = prog(s.id);
  if (!p.passed) {
    p.passed = true;
    state.todayPassed += 1;
  }
  saveState();
  renderPlayerMeta();
  renderHome();
  if (index < queue.length - 1) go(1);
}

/* —— Pronunciation: Web Speech Recognition compare —— */
function normalizeWords(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scorePronunciation(expected, heard) {
  const exp = normalizeWords(expected);
  const got = new Set(normalizeWords(heard));
  if (!exp.length) return { score: 0, missing: [], heard };
  const missing = exp.filter((w) => w.length > 2 && !got.has(w));
  const hit = exp.length - missing.length;
  const score = Math.round((hit / exp.length) * 100);
  return { score, missing, heard };
}

function addWeakWords(words) {
  for (const w of words) {
    state.weakWords[w] = (state.weakWords[w] || 0) + 1;
  }
  saveState();
}

async function startRecord() {
  const s = current();
  if (!s) return;
  if (recording) {
    stopRecord();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    // Fallback: just record audio for self-listen
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        $("score-panel").classList.remove("hidden");
        $("score-num").textContent = "自听";
        $("score-detail").textContent = "本机不支持语音识别，已录音供你对照标准音自查。";
        $("weak-list").innerHTML = `<audio controls src="${url}"></audio>`;
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      recording = true;
      $("btn-record").textContent = "⏹ 结束录音";
      $("mic-hint").textContent = "说完后点结束，回放自查";
      return;
    } catch {
      alert("无法使用麦克风，请在系统设置中允许本站录音。");
      return;
    }
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (ev) => {
    const heard = ev.results[0][0].transcript;
    const result = scorePronunciation(s.en, heard);
    $("score-panel").classList.remove("hidden");
    $("score-num").textContent = `${result.score}`;
    $("score-detail").textContent = `识别：${heard || "（未识别到）"}`;
    const box = $("weak-list");
    box.innerHTML = "";
    if (result.missing.length) {
      result.missing.slice(0, 8).forEach((w) => {
        const el = document.createElement("span");
        el.className = "weak-hit";
        el.textContent = w;
        box.appendChild(el);
      });
      addWeakWords(result.missing.slice(0, 8));
    } else {
      box.textContent = "本句关键词基本命中，继续影子跟读！";
    }
    const p = prog(s.id);
    p.shadow += 1;
    if (result.score >= 80 && !p.passed) {
      p.passed = true;
      state.todayPassed += 1;
    }
    saveState();
    renderPlayerMeta();
    renderHome();
  };
  recognition.onerror = () => {
    $("mic-hint").textContent = "识别失败，请靠近麦克风再说一遍";
    recording = false;
    $("btn-record").textContent = "🎤 跟读纠音";
  };
  recognition.onend = () => {
    recording = false;
    $("btn-record").textContent = "🎤 跟读纠音";
    $("mic-hint").textContent = "录音后用语音识别对比标准句，标出弱项词";
  };
  recording = true;
  $("btn-record").textContent = "⏹ 说完松手…";
  $("mic-hint").textContent = "请朗读屏幕上的英文句…";
  recognition.start();
}

function stopRecord() {
  if (recognition) {
    try { recognition.stop(); } catch { /* ignore */ }
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  recording = false;
  $("btn-record").textContent = "🎤 跟读纠音";
}

function renderWeak() {
  const entries = Object.entries(state.weakWords).sort((a, b) => b[1] - a[1]);
  const ul = $("weak-ul");
  ul.innerHTML = "";
  $("weak-empty").style.display = entries.length ? "none" : "block";
  for (const [w, c] of entries.slice(0, 50)) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${w}</span><span class="count">×${c}</span>`;
    ul.appendChild(li);
  }
}

async function loadCorpus() {
  const res = await fetch("./data/corpus.json");
  corpus = await res.json();
  ensureWelcomeSeed();
}

function ensureWelcomeSeed() {
  const has = corpus.sentences.some((s) => s.id.startsWith("service_norms-welcome"));
  if (has) return;
  // already in extract seed usually
}

function bind() {
  $("btn-back").onclick = () => { stopSpeech(); audioEl().pause(); showView("home"); renderHome(); };
  $("btn-back-weak").onclick = () => showView("home");
  $("btn-back-install").onclick = () => showView("home");
  $("btn-install-help").onclick = () => showView("install");
  $("btn-weak").onclick = () => { renderWeak(); showView("weak"); };
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
  $("btn-prev").onclick = () => go(-1);
  $("btn-next").onclick = () => go(1);
  $("btn-play").onclick = () => pausePlay();
  $("btn-loop").onclick = () => { loopOn = !loopOn; renderPlayerMeta(); };
  $("btn-speed").onclick = () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    audioEl().playbackRate = SPEEDS[speedIdx];
    renderPlayerMeta();
  };
  $("btn-listen").onclick = () => {
    const s = current();
    if (!s) return;
    prog(s.id).listen += 1;
    saveState();
    playSentence();
  };
  $("btn-shadow").onclick = () => {
    const s = current();
    if (!s) return;
    prog(s.id).shadow += 1;
    saveState();
    renderPlayerMeta();
  };
  $("btn-record").onclick = () => startRecord();
  $("btn-pass").onclick = () => markPass();

  // Media Session for headset buttons when supported
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("previoustrack", () => go(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => go(1));
    navigator.mediaSession.setActionHandler("play", () => playSentence());
    navigator.mediaSession.setActionHandler("pause", () => pausePlay());
  }
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (e) {
    console.warn("SW register failed", e);
  }
}

async function main() {
  bind();
  await loadCorpus();
  renderHome();
  registerSW();
  if (window.speechSynthesis) speechSynthesis.getVoices();
}

main().catch((e) => {
  console.error(e);
  alert("加载语料失败，请用本地服务器打开 app 目录（见 README）。");
});
