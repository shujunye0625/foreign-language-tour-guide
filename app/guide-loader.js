import { getGuide, getAudio } from "./user-guides.js";

export async function loadOfficialGuide(spotId, guidesIndex) {
  const meta = guidesIndex.spots.find((s) => s.id === spotId);
  if (!meta) return null;
  const res = await fetch(`./data/scenic_guides/${meta.file}`);
  const guide = await res.json();
  return {
    guide,
    mode: "official",
    meta,
    dispose: () => {},
  };
}

export async function loadUserGuide(guideId) {
  const raw = await getGuide(guideId);
  if (!raw) return null;

  const blobUrls = [];
  const sentences = await Promise.all(
    (raw.sentences || []).map(async (s) => {
      const out = {
        id: s.id,
        en: s.en,
        zh: s.zh || "",
        audio: null,
        audioStatus: s.audioStatus || "pending",
        audioKey: s.audioKey,
      };
      if (s.audioKey && s.audioStatus === "ready") {
        const blob = await getAudio(s.audioKey);
        if (blob) {
          const url = URL.createObjectURL(blob);
          blobUrls.push(url);
          out.audio = url;
        } else {
          out.audioStatus = "pending";
        }
      }
      return out;
    })
  );

  const guide = {
    id: raw.id,
    titleZh: raw.title,
    titleEn: "我的讲解稿",
    blurb: "",
    stops: [],
    sentences,
    _userMeta: {
      ttsReadyCount: raw.ttsReadyCount || 0,
      sentenceCount: raw.sentenceCount || sentences.length,
    },
  };

  return {
    guide,
    mode: "user",
    raw,
    dispose: () => {
      for (const url of blobUrls) URL.revokeObjectURL(url);
    },
    async refreshSentence(sentenceId) {
      const s = raw.sentences.find((x) => x.id === sentenceId);
      if (!s || s.audioStatus !== "ready") return null;
      const blob = await getAudio(s.audioKey);
      if (!blob) return null;
      const gSent = guide.sentences.find((x) => x.id === sentenceId);
      if (!gSent) return null;
      if (gSent.audio) {
        URL.revokeObjectURL(gSent.audio);
        const idx = blobUrls.indexOf(gSent.audio);
        if (idx >= 0) blobUrls.splice(idx, 1);
      }
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);
      gSent.audio = url;
      gSent.audioStatus = "ready";
      return url;
    },
    async syncFromDb() {
      const fresh = await getGuide(guideId);
      if (!fresh) return;
      raw.ttsReadyCount = fresh.ttsReadyCount;
      raw.sentenceCount = fresh.sentenceCount;
      guide._userMeta.ttsReadyCount = fresh.ttsReadyCount;
      guide._userMeta.sentenceCount = fresh.sentenceCount;
      for (const s of fresh.sentences || []) {
        const gSent = guide.sentences.find((x) => x.id === s.id);
        if (!gSent) continue;
        gSent.audioStatus = s.audioStatus;
        if (s.audioStatus === "ready" && !gSent.audio) {
          await this.refreshSentence(s.id);
        }
      }
    },
  };
}
