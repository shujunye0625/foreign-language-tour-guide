export const IDB_USER = "guide-user-v1";
export const STORE_GUIDES = "guides";
export const STORE_AUDIO = "audio";
export const MAX_GUIDES = 100;

export function openUserDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_USER, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_GUIDES)) {
        db.createObjectStore(STORE_GUIDES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listGuides() {
  const db = await openUserDb();
  const items = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE_GUIDES, "readonly").objectStore(STORE_GUIDES).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function countGuides() {
  return (await listGuides()).length;
}

export async function getGuide(id) {
  const db = await openUserDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_GUIDES, "readonly").objectStore(STORE_GUIDES).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putGuide(guide) {
  const db = await openUserDb();
  const tx = db.transaction(STORE_GUIDES, "readwrite");
  tx.objectStore(STORE_GUIDES).put(guide);
  await txDone(tx);
  return guide;
}

export async function saveGuide({ title, template, sentences }) {
  const n = await countGuides();
  if (n >= MAX_GUIDES) {
    const err = new Error("MAX_GUIDES");
    err.code = "MAX_GUIDES";
    throw err;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString().slice(0, 10);
  const guideSentences = sentences.map((s, i) => {
    const sid = `user-${id}-s${String(i + 1).padStart(2, "0")}`;
    return {
      id: sid,
      en: (s.en || "").trim(),
      zh: (s.zh || "").trim(),
      audioKey: `audio/${sid}`,
      audioStatus: "pending",
    };
  });
  const guide = {
    id,
    title: (title || "").trim(),
    template,
    createdAt: now,
    updatedAt: now,
    sentenceCount: guideSentences.length,
    ttsReadyCount: 0,
    sentences: guideSentences,
  };
  await putGuide(guide);
  return guide;
}

export async function updateGuide(guide) {
  guide.updatedAt = new Date().toISOString().slice(0, 10);
  guide.sentenceCount = guide.sentences?.length || 0;
  guide.ttsReadyCount = (guide.sentences || []).filter((s) => s.audioStatus === "ready").length;
  await putGuide(guide);
  return guide;
}

export async function deleteGuide(id) {
  const guide = await getGuide(id);
  if (!guide) return;
  const db = await openUserDb();
  const tx = db.transaction([STORE_GUIDES, STORE_AUDIO], "readwrite");
  const audioStore = tx.objectStore(STORE_AUDIO);
  for (const s of guide.sentences || []) {
    if (s.audioKey) audioStore.delete(s.audioKey);
  }
  tx.objectStore(STORE_GUIDES).delete(id);
  await txDone(tx);
}

export function isQuotaError(e) {
  return e?.name === "QuotaExceededError" || e?.code === 22 || e?.code === "QUOTA_EXCEEDED";
}

export async function deleteAudio(key) {
  const db = await openUserDb();
  const tx = db.transaction(STORE_AUDIO, "readwrite");
  tx.objectStore(STORE_AUDIO).delete(key);
  await txDone(tx);
}

export async function putAudio(key, blob) {
  const db = await openUserDb();
  try {
    const tx = db.transaction(STORE_AUDIO, "readwrite");
    tx.objectStore(STORE_AUDIO).put(blob, key);
    await txDone(tx);
  } catch (e) {
    if (isQuotaError(e)) {
      const err = new Error("存储空间不足");
      err.code = "QUOTA_EXCEEDED";
      throw err;
    }
    throw e;
  }
}

export async function estimateStorageBytes() {
  const guides = await listGuides();
  const db = await openUserDb();
  const bytes = await new Promise((resolve, reject) => {
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
  return { bytes, guideCount: guides.length };
}

export async function getAudio(key) {
  const db = await openUserDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_AUDIO, "readonly").objectStore(STORE_AUDIO).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
