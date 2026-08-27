import { validateSentences } from "./parse-paste.js";
import {
  getGuide,
  putGuide,
  putAudio,
  getAudio,
  countGuides,
  MAX_GUIDES,
  STORE_AUDIO,
  openUserDb,
} from "./user-guides.js";

const BACKUP_VERSION = 1;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type = "audio/mpeg") {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function exportGuide(guideId, { includeAudio = false } = {}) {
  const guide = await getGuide(guideId);
  if (!guide) throw new Error("找不到该稿子");

  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    guide: {
      title: guide.title,
      template: guide.template,
      sentences: (guide.sentences || []).map((s) => ({
        en: s.en,
        zh: s.zh || "",
      })),
    },
    audio: {},
  };

  if (includeAudio) {
    for (const s of guide.sentences || []) {
      if (s.audioKey && s.audioStatus === "ready") {
        const blob = await getAudio(s.audioKey);
        if (blob) payload.audio[s.audioKey] = await blobToBase64(blob);
      }
    }
  }

  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

export async function importGuide(file, { regenerateTts = true } = {}) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON 格式无效");
  }
  if (data.version !== BACKUP_VERSION || !data.guide) {
    throw new Error("不支持的备份版本");
  }

  const n = await countGuides();
  if (n >= MAX_GUIDES) {
    const err = new Error(`最多 ${MAX_GUIDES} 篇，请先删除旧稿`);
    err.code = "MAX_GUIDES";
    throw err;
  }

  const sentences = (data.guide.sentences || []).map((s) => ({
    en: (s.en || "").trim(),
    zh: (s.zh || "").trim(),
  }));
  const v = validateSentences(sentences);
  if (!v.ok) throw new Error(v.errors.join("；"));

  const id = crypto.randomUUID();
  const now = new Date().toISOString().slice(0, 10);
  const guideSentences = sentences.map((s, i) => {
    const sid = `user-${id}-s${String(i + 1).padStart(2, "0")}`;
    const audioKey = `audio/${sid}`;
    const hasAudio = !!data.audio?.[audioKey];
    return {
      id: sid,
      en: s.en,
      zh: s.zh,
      audioKey,
      audioStatus: regenerateTts ? "pending" : hasAudio ? "ready" : "system",
    };
  });

  const guide = {
    id,
    title: (data.guide.title || "导入的稿子").trim(),
    template: data.guide.template || "en_zh_lines",
    createdAt: now,
    updatedAt: now,
    sentenceCount: guideSentences.length,
    ttsReadyCount: regenerateTts
      ? 0
      : guideSentences.filter((s) => s.audioStatus === "ready").length,
    sentences: guideSentences,
  };

  await putGuide(guide);

  if (!regenerateTts && data.audio) {
    for (const s of guideSentences) {
      const b64 = data.audio[s.audioKey];
      if (b64 && s.audioStatus === "ready") {
        await putAudio(s.audioKey, base64ToBlob(b64));
      }
    }
  }

  return guide;
}

/** 估算音频占用（供 UI 显示） */
export async function sumAudioBytes() {
  const db = await openUserDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, "readonly");
    const store = tx.objectStore(STORE_AUDIO);
    const req = store.openCursor();
    let total = 0;
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) {
        resolve(total);
        return;
      }
      const v = cur.value;
      if (v?.size) total += v.size;
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
