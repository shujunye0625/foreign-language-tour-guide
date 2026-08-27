# -*- coding: utf-8 -*-
"""Rebuild app.js from clean HEAD + Phase 2 patches (UTF-8)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEAD = (ROOT / "_app_head.js").read_text(encoding="utf-8")

IMPORTS = '''
import { ENABLE_USER_GUIDES } from "./app/config.js";
import { initUserGuideUI, renderUserGuides, toast } from "./app/user-guide-ui.js";
import { wasSystemTtsUsed } from "./app/tts-queue.js";
import { loadOfficialGuide, loadUserGuide } from "./app/guide-loader.js";
'''

# Remove vocab vars
src = HEAD.replace(
    "/**\n * 导游英语口语 PWA — 五景点讲解为主线（单文件模块）\n */\n\n",
    "/**\n * 导游英语口语 PWA — 五景点讲解为主线（单文件模块）\n */\n" + IMPORTS + "\n",
)
src = src.replace(
    "/** Vocab */\nlet vocabDeck = [];\nlet vocabIdx = 0;\nlet vocabMode = \"en2zh\";\n\n",
    "",
)

# User guide state
src = src.replace(
    "let dictContext = null;\n\n/** Bank player */",
    """let dictContext = null;

/** User guides */
let guideMode = "official";
let guideLoaderHandle = null;
let activeTtsGuideId = null;
let draftTemplate = "en_zh_lines";
let draftSentences = [];
let userGuideEntered = false;

/** Bank player */""",
)

src = src.replace(
    "    lastGuide: null,\n  };",
    "    lastGuide: null,\n    lastUserGuide: null,\n  };",
)
src = src.replace(
    "  if (typeof s.todaySavedNew !== \"number\") s.todaySavedNew = 0;",
    "  if (typeof s.todaySavedNew !== \"number\") s.todaySavedNew = 0;\n  if (!s.lastUserGuide) s.lastUserGuide = null;",
)

# saveDictTerm - remove weakWords
src = src.replace(
    "  state.weakWords[dictTerm.toLowerCase()] = (state.weakWords[dictTerm.toLowerCase()] || 0) + 1;\n  state.todaySavedNew += 1;",
    "  state.todaySavedNew += 1;",
)

# renderHome - add user guides
src = src.replace(
    "    grid.appendChild(btn);\n  }\n}\n\n/* ── Guide reader ── */",
    "    grid.appendChild(btn);\n  }\n  if (ENABLE_USER_GUIDES) renderUserGuides();\n}\n\n/* ── Guide reader ── */",
)

# Replace openGuide block
OLD_OPEN = re.compile(
    r"async function openGuide\(spotId, resumeIndex\) \{.*?\n\}\n\nfunction renderGuideReader\(\)",
    re.DOTALL,
)
NEW_OPEN = '''async function openGuide(spotId, resumeIndex) {
  return openOfficialGuide(spotId, resumeIndex);
}

async function openOfficialGuide(spotId, resumeIndex) {
  disposeGuideLoader();
  stopAudio();
  const loaded = await loadOfficialGuide(spotId, guidesIndex);
  if (!loaded) return;
  guideLoaderHandle = loaded;
  guideMode = "official";
  guide = loaded.guide;
  if (typeof resumeIndex === "number") {
    gIdx = Math.min(Math.max(0, resumeIndex), guide.sentences.length - 1);
  } else if (state.lastGuide?.spotId === spotId) {
    gIdx = Math.min(state.lastGuide.index || 0, guide.sentences.length - 1);
  } else {
    gIdx = 0;
  }
  setupGuideReader();
  state.lastGuide = { spotId: guide.id, index: gIdx };
  saveState();
}

async function openUserGuide(guideId, resumeIndex) {
  disposeGuideLoader();
  stopAudio();
  const loaded = await loadUserGuide(guideId);
  if (!loaded) {
    alert("找不到该稿子，可能已被删除。");
    return;
  }
  guideLoaderHandle = loaded;
  guideMode = "user";
  guide = loaded.guide;
  if (typeof resumeIndex === "number") {
    gIdx = Math.min(Math.max(0, resumeIndex), guide.sentences.length - 1);
  } else if (state.lastUserGuide?.guideId === guideId) {
    gIdx = Math.min(state.lastUserGuide.index || 0, guide.sentences.length - 1);
  } else {
    gIdx = 0;
  }
  setupGuideReader();
  state.lastUserGuide = { guideId: guide.id, index: gIdx };
  saveState();
  resumeBackgroundTts(guideId);
}

function disposeGuideLoader() {
  if (guideLoaderHandle?.dispose) guideLoaderHandle.dispose();
  guideLoaderHandle = null;
}

function setupGuideReader() {
  gMode = "drill";
  gLoop = true;
  gMeUrl = null;
  $("mode-drill").classList.add("on");
  $("mode-full").classList.remove("on");
  $("btn-guide-loop").classList.add("on");
  $("btn-guide-replay-me").classList.add("hidden");
  $("guide-title").textContent = guide.titleZh;
  $("guide-sub").textContent = guide.titleEn || "";
  $("btn-guide-menu").classList.toggle("hidden", guideMode === "user");
  $("anchor-card").classList.toggle("hidden", guideMode === "user");
  updateUserTtsBar();
  renderGuideReader();
  highlightGuide(true);
  updateGuideChrome();
  if (guideMode === "official") updateAnchor();
  showView("guide");
}

function updateUserTtsBar() {
  const bar = $("guide-tts-bar");
  if (!bar) return;
  if (guideMode !== "user" || !guide?._userMeta) {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");
  const { ttsReadyCount = 0, sentenceCount = 0 } = guide._userMeta;
  $("guide-tts-text").textContent = `范读 ${ttsReadyCount}/${sentenceCount}`;
}

function renderGuideReader()'''

src = OLD_OPEN.sub(NEW_OPEN, src, count=1)

# renderGuideReader pending class
src = src.replace(
    '    pair.className = "pair";\n    pair.dataset.i = String(i);',
    '    pair.className = "pair";\n    if (guideMode === "user" && s.audioStatus === "pending") pair.classList.add("pending");\n    pair.dataset.i = String(i);',
)

# updateGuideChrome
src = src.replace(
    '  $("btn-guide-replay-me").classList.toggle("hidden", !gMeUrl);\n}',
    '  $("btn-guide-replay-me").classList.toggle("hidden", !gMeUrl);\n  updateUserTtsBar();\n}',
)

# persistGuide
src = src.replace(
    """function persistGuide() {
  if (!guide) return;
  state.lastGuide = { spotId: guide.id, index: gIdx };
  saveState();
}""",
    """function persistGuide() {
  if (!guide) return;
  if (guideMode === "user") {
    state.lastUserGuide = { guideId: guide.id, index: gIdx };
  } else {
    state.lastGuide = { spotId: guide.id, index: gIdx };
  }
  saveState();
}""",
)

# playGuide
src = src.replace(
    """async function playGuide() {
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
}""",
    """async function playGuide() {
  const s = curGuide();
  if (!s) return;
  if (guideMode === "user" && s.audioStatus === "pending") {
    toast("这句还在准备范读，请稍候…");
    return;
  }
  stopAudio();
  const a = audioEl();
  let ok = false;
  if (s.audio) ok = await tryPlay(a, s.audio, SPEEDS[gSpeedIdx], onGuideEnded);
  if (!ok) {
    if (guideMode === "user" && s.audioStatus === "system" && wasSystemTtsUsed()) {
      toast("高清范读不可用，已用系统朗读");
    }
    speak(s.en, SPEEDS[gSpeedIdx], onGuideEnded);
  }
  gPlaying = true;
  $("btn-guide-play").textContent = "⏸";
  $("btn-guide-play").classList.add("playing");
}""",
)

# Remove vocab section keep wordbook only
src = re.sub(
    r"/\* ── Vocab ── \*/\n\nfunction buildVocabDeck\(\).*?function renderWeak\(\) \{.*?\n\}\n\n",
    "",
    src,
    flags=re.DOTALL,
)

# bind - remove vocab/weak, fix guide back, add initUserGuideUI
src = src.replace(
    '  $("btn-vocab").onclick = () => openVocab();\n  $("btn-weak").onclick = () => { renderWeak(); showView("weak"); };\n',
    "",
)
src = src.replace(
    '  $("btn-guide-back").onclick = () => { stopAudio(); showView("home"); renderHome(); };',
    '  $("btn-guide-back").onclick = () => { stopAudio(); disposeGuideLoader(); guide = null; showView("home"); renderHome(); };',
)
src = src.replace(
    '  $("btn-back-weak").onclick = () => showView("home");\n',
    "",
)
src = src.replace(
    '  $("btn-back-vocab").onclick = () => showView("home");\n',
    "",
)
src = re.sub(
    r'  \$\("btn-clear-weak"\)\.onclick = \(\) => \{.*?\n  \};\n',
    "",
    src,
    flags=re.DOTALL,
)
src = re.sub(
    r'  \$\("btn-flash-en"\).*?\n  \};\n\}',
    """  initUserGuideUI({
    $,
    showView,
    state,
    saveState,
    renderHome,
    getGuideMode: () => guideMode,
    getGuide: () => guide,
    getGuideLoaderHandle: () => guideLoaderHandle,
    getActiveTtsGuideId: () => activeTtsGuideId,
    setActiveTtsGuideId: (id) => { activeTtsGuideId = id; },
    getUserGuideEntered: () => userGuideEntered,
    setUserGuideEntered: (v) => { userGuideEntered = v; },
    getDraftTemplate: () => draftTemplate,
    setDraftTemplate: (v) => { draftTemplate = v; },
    getDraftSentences: () => draftSentences,
    setDraftSentences: (v) => { draftSentences = v; },
    openUserGuide,
    updateUserTtsBar,
    renderGuideReader,
    highlightGuide,
  });
}""",
    src,
    flags=re.DOTALL,
)

# resumeBackgroundTts - import from user-guide-ui or keep in app.js
# Add resumeBackgroundTts call - it's in openUserGuide, implementation in user-guide-ui
# We need resumeBackgroundTts in app.js or exported from user-guide-ui
# Put resumeBackgroundTts in user-guide-ui and export it, import in app.js

# Add import for resumeBackgroundTts
src = src.replace(
    'import { initUserGuideUI, renderUserGuides, toast } from "./app/user-guide-ui.js";',
    'import { initUserGuideUI, renderUserGuides, toast, resumeBackgroundTts } from "./app/user-guide-ui.js";',
)

(ROOT / "app.js").write_text(src, encoding="utf-8", newline="\n")
print("app.js written", len(src), "chars")
