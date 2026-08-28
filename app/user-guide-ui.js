import { ENABLE_USER_GUIDES } from "./config.js";
import {
  parseByTemplate,
  validateSentences,
  mergeSentences,
  deleteSentence,
  splitSentenceAt,
  warnNonAsciiInPureEn,
  MAX_SENTENCES,
  MAX_EN_LEN,
  WARN_EN_LEN,
} from "./parse-paste.js";
import {
  listGuides,
  saveGuide,
  deleteGuide,
  getGuide,
  estimateStorageBytes,
  isQuotaError,
  MAX_GUIDES,
} from "./user-guides.js";
import { generateGuideAudio, regenerateGuideAudio, resetTtsWarning } from "./tts-queue.js";
import { exportGuide, importGuide } from "./guide-backup.js";

/** @type {object} */
let ux = {};

export function initUserGuideUI(context) {
  ux = context;
  if (!ENABLE_USER_GUIDES) return;
  bindUserGuideEvents();
}

export function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  el.style.cssText =
    "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f2844;color:#fff;padding:10px 16px;border-radius:12px;font-size:0.85rem;z-index:200;max-width:90%;text-align:center;border:1px solid #2a3b58;";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function escapeHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function updateStorageHint() {
  const el = ux.$("storage-hint");
  if (!el) return;
  try {
    const { bytes, guideCount } = await estimateStorageBytes();
    const mb = bytes / (1024 * 1024);
    el.textContent = `本机已存 ${guideCount} 篇 · 范读音频约 ${mb.toFixed(1)} MB`;
    el.classList.remove("warn", "danger");
    if (mb >= 150) el.classList.add("danger");
    else if (mb >= 80) el.classList.add("warn");
  } catch {
    el.textContent = "";
  }
}

export async function renderUserGuides() {
  const list = ux.$("user-guide-list");
  const empty = ux.$("user-guide-empty");
  if (!list || !empty) return;
  const guides = await listGuides();
  list.innerHTML = "";
  empty.style.display = guides.length ? "none" : "block";
  for (const g of guides) {
    const wrap = document.createElement("div");
    wrap.className = "user-guide-card-wrap";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.setAttribute("aria-label", "删除");
    del.textContent = "删除";
    del.onclick = async () => {
      if (!confirm(`删除「${g.title}」？范读音频将一并清除。`)) return;
      if (ux.getActiveTtsGuideId() === g.id) ux.setActiveTtsGuideId(null);
      await deleteGuide(g.id);
      if (ux.state.lastUserGuide?.guideId === g.id) {
        ux.state.lastUserGuide = null;
        ux.saveState();
      }
      renderUserGuides();
      ux.renderHome();
      updateStorageHint();
    };

    const actions = document.createElement("div");
    actions.className = "user-guide-actions";

    const regen = document.createElement("button");
    regen.type = "button";
    regen.className = "link-btn";
    regen.textContent = "重生成范读";
    regen.onclick = (e) => {
      e.stopPropagation();
      if (ux.getActiveTtsGuideId() === g.id) {
        toast("该稿正在准备范读，请稍候");
        return;
      }
      ux.setActiveTtsGuideId(g.id);
      resetTtsWarning();
      showTtsProgress();
      regenerateGuideAudio(g.id, makeTtsHooks(g.id, false)).finally(() => {
        if (ux.getActiveTtsGuideId() === g.id) ux.setActiveTtsGuideId(null);
        hideTtsProgress();
        renderUserGuides();
        updateStorageHint();
      });
    };

    const exp = document.createElement("button");
    exp.type = "button";
    exp.className = "link-btn";
    exp.textContent = "导出";
    exp.onclick = async (e) => {
      e.stopPropagation();
      const includeAudio = confirm(
        "是否包含范读音频？\n\n确定 = 含音频（文件可能很大）\n取消 = 仅文本（推荐换机备份）"
      );
      if (includeAudio && !confirm("含音频的 JSON 可能很大，确定继续？")) return;
      await doExport(g.id, includeAudio);
    };

    actions.appendChild(regen);
    actions.appendChild(exp);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "user-guide-card";
    const lastIdx = ux.state.lastUserGuide?.guideId === g.id ? ux.state.lastUserGuide.index + 1 : null;
    const progText = lastIdx ? `上次练到第 ${lastIdx} 句 · ` : "";
    btn.innerHTML = `<strong>${escapeHtml(g.title)}</strong>
      <div class="meta">${g.sentenceCount} 句 · 更新 ${g.updatedAt || ""}</div>
      <div class="status">${progText}范读 ${g.ttsReadyCount || 0}/${g.sentenceCount}</div>`;
    btn.onclick = () => ux.openUserGuide(g.id);
    wrap.appendChild(del);
    wrap.appendChild(btn);
    wrap.appendChild(actions);
    list.appendChild(wrap);
  }
  await updateStorageHint();
}

async function doExport(guideId, includeAudio) {
  try {
    const blob = await exportGuide(guideId, { includeAudio });
    const g = await getGuide(guideId);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(g?.title || "guide").replace(/[/\\?%*:|"<>]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(includeAudio ? "已导出（含音频）" : "已导出（仅文本）");
  } catch (e) {
    toast(e.message || "导出失败");
  }
}

function openPasteWizard() {
  ux.setDraftTemplate("en_zh_lines");
  ux.setDraftSentences([]);
  ux.$("paste-title").value = "";
  ux.$("paste-text").value = "";
  document.querySelectorAll(".tpl-card").forEach((el) => {
    el.classList.toggle("on", el.dataset.template === ux.getDraftTemplate());
  });
  ux.showView("paste-wizard");
}

function goPreview() {
  const title = (ux.$("paste-title").value || "").trim();
  if (!title) {
    alert("请填写讲解标题。");
    return;
  }
  const text = (ux.$("paste-text").value || "").trim();
  if (!text) {
    alert("请粘贴讲解词。");
    return;
  }
  ux.setDraftSentences(parseByTemplate(ux.getDraftTemplate(), text));
  if (!ux.getDraftSentences().length) {
    alert("未能拆出句子，请检查粘贴内容或切换模板。");
    return;
  }
  renderPreview();
  ux.showView("paste-preview");
}

function onDraftEdit() {
  const sentences = [...ux.getDraftSentences()];
  document.querySelectorAll(".preview-item").forEach((li, i) => {
    const en = li.querySelector(".en-edit")?.value ?? "";
    const zh = li.querySelector(".zh-edit")?.value ?? "";
    if (sentences[i]) {
      sentences[i] = {
        en: en.trim(),
        zh: zh.trim(),
        softSplit: sentences[i].softSplit,
      };
    }
  });
  ux.setDraftSentences(sentences);
  renderPreview(false);
}

function renderPreview(scrollTop = true) {
  const ul = ux.$("preview-list");
  const prevScroll = ul.scrollTop;
  ul.innerHTML = "";
  const draftSentences = ux.getDraftSentences();
  draftSentences.forEach((s, i) => {
    const enLen = (s.en || "").trim().length;
    const li = document.createElement("li");
    li.className = "preview-item";
    if (enLen > MAX_EN_LEN) li.classList.add("is-error");
    else if (enLen > WARN_EN_LEN) li.classList.add("is-warn");

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = `#${i + 1} · ${enLen}/${MAX_EN_LEN} 字符`;
    li.appendChild(num);

    const enLabel = document.createElement("label");
    enLabel.className = "preview-field";
    enLabel.innerHTML = "<span>英文</span>";
    const enTa = document.createElement("textarea");
    enTa.className = "en-edit";
    enTa.rows = 2;
    enTa.maxLength = MAX_EN_LEN;
    enTa.value = s.en || "";
    enLabel.appendChild(enTa);
    li.appendChild(enLabel);

    const zhLabel = document.createElement("label");
    zhLabel.className = "preview-field";
    zhLabel.innerHTML = "<span>中文</span>";
    const zhTa = document.createElement("textarea");
    zhTa.className = "zh-edit";
    zhTa.rows = 2;
    zhTa.value = s.zh || "";
    zhLabel.appendChild(zhTa);
    li.appendChild(zhLabel);

    const actions = document.createElement("div");
    actions.className = "preview-actions";
    const splitBtn = document.createElement("button");
    splitBtn.type = "button";
    splitBtn.dataset.act = "split";
    splitBtn.textContent = "拆开此句";
    const mergeBtn = document.createElement("button");
    mergeBtn.type = "button";
    mergeBtn.dataset.act = "merge";
    mergeBtn.textContent = "与下句合并";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.dataset.act = "del";
    delBtn.textContent = "删除";
    actions.appendChild(splitBtn);
    actions.appendChild(mergeBtn);
    actions.appendChild(delBtn);
    li.appendChild(actions);

    enTa.addEventListener("input", onDraftEdit);
    zhTa.addEventListener("input", onDraftEdit);
    splitBtn.onclick = () => {
      onDraftEdit();
      const before = ux.getDraftSentences().length;
      const next = splitSentenceAt(ux.getDraftSentences(), i);
      if (next.length <= before) {
        toast("无法再拆开，请手动编辑或在句中加入标点");
        return;
      }
      if (next.length > MAX_SENTENCES) {
        toast(`拆开后将超过 ${MAX_SENTENCES} 句上限`);
        return;
      }
      ux.setDraftSentences(next);
      renderPreview();
    };
    mergeBtn.onclick = () => {
      onDraftEdit();
      ux.setDraftSentences(mergeSentences(ux.getDraftSentences(), i));
      renderPreview();
    };
    delBtn.onclick = () => {
      ux.setDraftSentences(deleteSentence(ux.getDraftSentences(), i));
      renderPreview();
    };
    ul.appendChild(li);
  });
  const n = draftSentences.length;
  ux.$("preview-stats").textContent = `共 ${n} 句 · 最多 ${MAX_SENTENCES} 句 · 单句上限 ${MAX_EN_LEN} 字符 · 超过 ${WARN_EN_LEN} 提示偏长`;
  const v = validateSentences(draftSentences);
  const extra =
    ux.getDraftTemplate() === "pure_en" ? warnNonAsciiInPureEn(draftSentences) : [];
  const warnings = [...v.warnings, ...extra];
  const wEl = ux.$("preview-warnings");
  const eEl = ux.$("preview-errors");
  wEl.textContent = warnings.join("；");
  wEl.classList.toggle("hidden", !warnings.length);
  eEl.textContent = v.errors.join("；");
  eEl.classList.toggle("hidden", !v.errors.length);
  ux.$("btn-preview-save").disabled = !v.ok;
  if (!scrollTop) ul.scrollTop = prevScroll;
}

function addDraftSentence() {
  const next = [...ux.getDraftSentences(), { en: "", zh: "" }];
  if (next.length > MAX_SENTENCES) {
    toast(`最多 ${MAX_SENTENCES} 句`);
    return;
  }
  ux.setDraftSentences(next);
  renderPreview();
}

function showTtsProgress() {
  ux.$("tts-progress")?.classList.remove("hidden");
  ux.$("tts-progress-text").textContent = "正在准备范读…";
  ux.$("tts-progress-fill").style.width = "0%";
}

function hideTtsProgress() {
  ux.$("tts-progress")?.classList.add("hidden");
}

function makeTtsHooks(guideId, autoEnter) {
  return {
    onProgress: ({ done, total, ready }) => {
      const pct = total ? Math.round((done / total) * 100) : 0;
      ux.$("tts-progress-fill").style.width = `${pct}%`;
      ux.$("tts-progress-text").textContent = `范读准备中 ${ready}/${total}`;
      if (ux.getGuideMode() === "user" && ux.getGuide()?.id === guideId && ux.getGuideLoaderHandle()) {
        ux.getGuideLoaderHandle()
          .syncFromDb()
          .then(() => {
            ux.getGuide()._userMeta.ttsReadyCount = ready;
            ux.updateUserTtsBar();
            ux.renderGuideReader();
            ux.highlightGuide(false);
          });
      }
      renderUserGuides();
    },
    onFirstReady: () => {
      if (autoEnter && !ux.getUserGuideEntered()) {
        ux.setUserGuideEntered(true);
        hideTtsProgress();
        ux.openUserGuide(guideId, 0);
      }
    },
    onSentenceReady: async (idx) => {
      if (ux.getGuideMode() === "user" && ux.getGuide()?.id === guideId && ux.getGuideLoaderHandle()) {
        const s = ux.getGuide().sentences[idx];
        if (s) await ux.getGuideLoaderHandle().refreshSentence(s.id);
        ux.renderGuideReader();
        ux.highlightGuide(false);
      }
    },
  };
}

async function saveDraftAndTts() {
  onDraftEdit();
  const title = (ux.$("paste-title").value || "").trim();
  const v = validateSentences(ux.getDraftSentences());
  if (!v.ok) {
    alert(v.errors.join("\n"));
    return;
  }
  resetTtsWarning();
  ux.setUserGuideEntered(false);
  let saved;
  try {
    saved = await saveGuide({
      title,
      template: ux.getDraftTemplate(),
      sentences: ux.getDraftSentences(),
    });
  } catch (e) {
    if (e.code === "MAX_GUIDES") {
      alert(`最多保存 ${MAX_GUIDES} 篇，请删除旧稿后再建。`);
    } else if (isQuotaError(e)) {
      toast("存储空间不足，请导出备份后删除旧稿，或导出时勿含音频。");
    } else {
      alert("保存失败，请重试。");
    }
    return;
  }
  showTtsProgress();
  ux.setActiveTtsGuideId(saved.id);
  startTtsGeneration(saved.id, true);
  updateStorageHint();
}

function startTtsGeneration(guideId, autoEnter) {
  generateGuideAudio(guideId, makeTtsHooks(guideId, autoEnter))
    .then(() => {
      if (ux.getActiveTtsGuideId() === guideId) ux.setActiveTtsGuideId(null);
      hideTtsProgress();
      renderUserGuides();
      if (ux.getGuideMode() === "user" && ux.getGuide()?.id === guideId && ux.getGuideLoaderHandle()) {
        ux.getGuideLoaderHandle().syncFromDb().then(() => ux.updateUserTtsBar());
      }
      updateStorageHint();
    })
    .catch((e) => {
      hideTtsProgress();
      if (isQuotaError(e)) {
        toast("存储空间不足，范读音频未能全部保存，可继续用系统朗读。");
      } else {
        toast("范读生成遇到问题，可稍后重试或继续用系统朗读。");
      }
    });
}

export function resumeBackgroundTts(guideId) {
  getGuide(guideId).then((g) => {
    if (!g) return;
    const pending = (g.sentences || []).some((s) => s.audioStatus === "pending");
    if (pending && ux.getActiveTtsGuideId() !== guideId) {
      ux.setActiveTtsGuideId(guideId);
      showTtsProgress();
      startTtsGeneration(guideId, false);
    }
  });
}

async function onImportFile(file) {
  if (!file) return;
  const regenerate = confirm(
    "导入成功。是否重新生成范读？\n\n确定 = 后台生成 Jenny 范读\n取消 = 立即可用系统朗读"
  );
  try {
    const guide = await importGuide(file, { regenerateTts: regenerate });
    toast(`已导入「${guide.title}」`);
    renderUserGuides();
    ux.renderHome();
    updateStorageHint();
    if (regenerate) {
      ux.setActiveTtsGuideId(guide.id);
      showTtsProgress();
      startTtsGeneration(guide.id, false);
    }
  } catch (e) {
    if (isQuotaError(e)) {
      toast("存储空间不足，请清理旧稿后再导入。");
    } else {
      toast(e.message || "导入失败，请检查 JSON 文件。");
    }
  }
  ux.$("import-guide-input").value = "";
}

function bindUserGuideEvents() {
  ux.$("btn-new-guide")?.addEventListener("click", openPasteWizard);
  ux.$("btn-paste-back")?.addEventListener("click", () => ux.showView("home"));
  ux.$("btn-preview-back")?.addEventListener("click", () => ux.showView("paste-wizard"));
  ux.$("btn-paste-next")?.addEventListener("click", goPreview);
  ux.$("btn-preview-save")?.addEventListener("click", saveDraftAndTts);
  ux.$("btn-preview-add")?.addEventListener("click", addDraftSentence);
  ux.$("btn-paste-clipboard")?.addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      ux.$("paste-text").value = t;
    } catch {
      alert("无法读取剪贴板，请手动粘贴。");
    }
  });
  ux.$("btn-import-guide")?.addEventListener("click", () => ux.$("import-guide-input")?.click());
  ux.$("import-guide-input")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) onImportFile(f);
  });
  document.querySelectorAll(".tpl-card").forEach((el) => {
    el.addEventListener("click", () => {
      ux.setDraftTemplate(el.dataset.template);
      document.querySelectorAll(".tpl-card").forEach((x) => x.classList.toggle("on", x === el));
    });
  });
}
