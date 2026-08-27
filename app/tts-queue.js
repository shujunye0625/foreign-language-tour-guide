import { TTS_WORKER_URL, TTS_VOICE, TTS_RATE } from "./config.js";
import { getGuide, updateGuide, putAudio, deleteAudio } from "./user-guides.js";

const PRIORITY_COUNT = 3;
const BATCH_SIZE = 4;
const RETRIES = 2;
const BATCH_DELAY_MS = 100;
const TTS_TIMEOUT_MS = 15000;

let systemTtsWarned = false;

export function resetTtsWarning() {
  systemTtsWarned = false;
}

export function wasSystemTtsUsed() {
  return systemTtsWarned;
}

async function fetchTts(text) {
  if (!TTS_WORKER_URL) return null;
  const res = await fetch(TTS_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: TTS_VOICE, rate: TTS_RATE }),
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob || blob.size < 100) return null;
  return blob;
}

async function synthesizeSentence(sentence) {
  const text = (sentence.en || "").trim();
  if (!text) return { blob: null, status: "system" };
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const blob = await fetchTts(text);
      if (blob) return { blob, status: "ready" };
    } catch {
      /* retry */
    }
    if (attempt < RETRIES) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  if (!systemTtsWarned) systemTtsWarned = true;
  return { blob: null, status: "system" };
}

async function processSentence(guide, idx) {
  const s = guide.sentences[idx];
  if (!s || s.audioStatus === "ready" || s.audioStatus === "system") return s;
  const result = await synthesizeSentence(s);
  try {
    if (result.status === "ready" && result.blob) {
      await putAudio(s.audioKey, result.blob);
      s.audioStatus = "ready";
    } else {
      s.audioStatus = "system";
    }
  } catch {
    s.audioStatus = "system";
  }
  await updateGuide(guide);
  return s;
}

export async function generateGuideAudio(guideId, hooks = {}) {
  const guide = await getGuide(guideId);
  if (!guide?.sentences?.length) return guide;

  const total = guide.sentences.length;
  let done = 0;
  let firstReadyFired = false;

  const tick = () => {
    const ready = guide.sentences.filter((s) => s.audioStatus === "ready").length;
    const playable = guide.sentences.filter((s) => s.audioStatus === "ready" || s.audioStatus === "system").length;
    hooks.onProgress?.({ done, total, ready, playable });
    if (!firstReadyFired && playable >= 1) {
      firstReadyFired = true;
      hooks.onFirstReady?.();
    }
  };

  const runOne = async (idx) => {
    await processSentence(guide, idx);
    done += 1;
    tick();
    hooks.onSentenceReady?.(idx);
  };

  const indices = guide.sentences.map((_, i) => i);
  const priority = indices.slice(0, PRIORITY_COUNT);
  const rest = indices.slice(PRIORITY_COUNT);

  await Promise.all(priority.map((i) => runOne(i)));

  for (let i = 0; i < rest.length; i += BATCH_SIZE) {
    const batch = rest.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((j) => runOne(j)));
    if (i + BATCH_SIZE < rest.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return guide;
}

/** 全文重生成范读：重置 pending 并重新排队 */
export async function regenerateGuideAudio(guideId, hooks = {}) {
  const guide = await getGuide(guideId);
  if (!guide?.sentences?.length) return guide;
  for (const s of guide.sentences) {
    if (s.audioKey) {
      try {
        await deleteAudio(s.audioKey);
      } catch {
        /* ignore */
      }
    }
    s.audioStatus = "pending";
  }
  guide.ttsReadyCount = 0;
  await updateGuide(guide);
  resetTtsWarning();
  return generateGuideAudio(guideId, hooks);
}
