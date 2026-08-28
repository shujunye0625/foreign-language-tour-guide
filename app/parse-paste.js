export const MIN_SENTENCES = 3;
export const MAX_SENTENCES = 200;
export const MAX_EN_LEN = 1000;
export const WARN_EN_LEN = 280;
export const WARN_SENTENCES = 150;
export const SOFT_CHUNK_TARGET = 500;

const TITLE_ABBREV =
  /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e)\./gi;
const GEO_ABBREV = /\b(?:U\.S|U\.K)\./gi;
const INITIAL_ABBREV = /\b([A-Z])\.(?=\s*[A-Z])/g;
const DECIMAL_RE = /(\d)\.(\d)/g;

const CLAUSE_AFTER_COMMA =
  /,\s+(?:and|but|or|so|yet|which|where|when|while|although|because)\b/gi;

/**
 * Protect abbreviations / decimals so sentence-boundary splits do not fire on them.
 * @returns {{ text: string, restore: (s: string) => string }}
 */
function protectDots(text) {
  const placeholders = [];
  const park = (m) => {
    placeholders.push(m);
    return `\uE000${placeholders.length - 1}\uE001`;
  };
  let t = text;
  t = t.replace(TITLE_ABBREV, park);
  t = t.replace(GEO_ABBREV, park);
  t = t.replace(DECIMAL_RE, park);
  t = t.replace(INITIAL_ABBREV, park);
  return {
    text: t,
    restore: (s) =>
      s.replace(/\uE000(\d+)\uE001/g, (_, i) => placeholders[Number(i)] ?? ""),
  };
}

/** Map Chinese sentence-end punctuation to ASCII for boundary detection (TTS-friendly). */
function normalizeSentenceEnds(text) {
  return text.replace(/。/g, ".").replace(/！/g, "!").replace(/？/g, "?");
}

/**
 * Stage-1: true English sentence boundaries within one paragraph.
 * @param {string} para
 * @returns {string[]}
 */
export function splitParagraphIntoSentences(para) {
  const raw = (para || "").trim();
  if (!raw) return [];
  const normalized = normalizeSentenceEnds(raw);
  const { text, restore } = protectDots(normalized);
  // Prefer boundary with whitespace; also handle dirty paste without space after .!?
  const parts = text.split(/(?<=[.!?])(?:\s+|(?=[A-Z"“'(]))/);
  const out = [];
  for (const part of parts) {
    const en = restore(part).trim();
    if (en) out.push(en);
  }
  return out.length ? out : [restore(text).trim()].filter(Boolean);
}

/**
 * Find best soft-split index (end of left chunk) for overlong text.
 * @param {string} text
 * @param {number} maxLen
 * @returns {number} split after this index (exclusive end of left); -1 if none
 */
function findSoftSplitIndex(text, maxLen) {
  const L = text.length;
  if (L <= maxLen) return -1;
  const mid = Math.floor(L / 2);
  const winLo = Math.floor(L * 0.35);
  const winHi = Math.ceil(L * 0.65);

  const pickBest = (indices) => {
    if (!indices.length) return -1;
    const inWin = indices.filter((i) => i >= winLo && i <= winHi);
    const pool = inWin.length ? inWin : indices;
    let best = pool[0];
    let bestDist = Math.abs(best - mid);
    for (const i of pool) {
      const d = Math.abs(i - mid);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  };

  // 1) semicolon
  {
    const idxs = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if ((c === ";" || c === "；") && i + 1 <= maxLen && L - (i + 1) > 0) {
        let end = i + 1;
        while (end < text.length && text[end] === " ") end++;
        if (end <= maxLen && L - end >= 1) idxs.push(end);
      }
    }
    const b = pickBest(idxs);
    if (b > 0) return b;
  }

  // 2) colon + space
  {
    const idxs = [];
    for (let i = 0; i < text.length - 1; i++) {
      if (text[i] === ":" && /\s/.test(text[i + 1])) {
        let end = i + 1;
        while (end < text.length && /\s/.test(text[end])) end++;
        if (end > 0 && end <= maxLen && L - end >= 1) idxs.push(end);
      }
    }
    const b = pickBest(idxs);
    if (b > 0) return b;
  }

  // 3) comma + coordinating / relative markers
  {
    const idxs = [];
    CLAUSE_AFTER_COMMA.lastIndex = 0;
    let m;
    while ((m = CLAUSE_AFTER_COMMA.exec(text))) {
      // split before the conjunction word (keep ", and …" with right) — plan: split at comma boundary
      // Use index after the matched ", and " so left ends before conjunction… Actually better:
      // left ends at comma inclusive, right starts at "and …"
      const commaAt = m.index;
      const rightStart = commaAt + 1; // start at space after comma — trim later
      // Prefer: left includes up through comma; right is rest after comma
      const end = commaAt + 1;
      if (end <= maxLen && L - end >= 1) idxs.push(end);
    }
    const b = pickBest(idxs);
    if (b > 0) return b;
  }

  // 4) dashes
  {
    const idxs = [];
    const dashRe = /\s+[—–-]\s+/g;
    let m;
    while ((m = dashRe.exec(text))) {
      const end = m.index + m[0].length;
      if (end <= maxLen && L - end >= 1) idxs.push(end);
    }
    const b = pickBest(idxs);
    if (b > 0) return b;
  }

  // 5) whitespace near SOFT_CHUNK_TARGET / mid, ≤ maxLen
  {
    const target = Math.min(SOFT_CHUNK_TARGET, maxLen);
    const idxs = [];
    for (let i = 1; i < text.length && i <= maxLen; i++) {
      if (/\s/.test(text[i - 1]) && !/\s/.test(text[i])) {
        // split before non-space at i means left ends at i (previous char was space)
        // better: left ends after last space before position
      }
    }
    // Collect positions after a whitespace run, where left length ≤ maxLen
    for (let i = 1; i < L; i++) {
      if (/\s/.test(text[i - 1]) && i <= maxLen && L - i >= 1) {
        idxs.push(i);
      }
    }
    if (idxs.length) {
      // Prefer near target, then mid
      let best = idxs[0];
      let bestScore = Infinity;
      for (const i of idxs) {
        const score = Math.abs(i - target) * 1.2 + Math.abs(i - mid);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      return best;
    }
  }

  // 6) hard cut at maxLen
  return maxLen;
}

/**
 * Stage-2: soft-split text longer than MAX_EN_LEN into chunks ≤ maxLen.
 * @param {string} en
 * @param {{ maxLen?: number }} [opts]
 * @returns {string[]}
 */
export function splitOverlongEn(en, opts = {}) {
  const maxLen = opts.maxLen ?? MAX_EN_LEN;
  const raw = (en || "").trim();
  if (!raw) return [];
  if (raw.length <= maxLen) return [raw];

  const chunks = [];
  let rest = raw;
  while (rest.length > maxLen) {
    let idx = findSoftSplitIndex(rest, maxLen);
    if (idx <= 0 || idx >= rest.length) idx = Math.min(maxLen, rest.length);
    let left = rest.slice(0, idx).trim();
    let right = rest.slice(idx).trim();
    if (!left) {
      left = rest.slice(0, maxLen);
      right = rest.slice(maxLen).trim();
    }
    if (!left) break;
    chunks.push(left);
    rest = right;
    if (!rest) break;
  }
  if (rest) chunks.push(rest);
  return chunks.length ? chunks : [raw.slice(0, maxLen)];
}

/**
 * Apply stage-2 to a list of sentence objects; marks softSplit on produced pieces.
 * @param {{ en: string, zh?: string, softSplit?: boolean }[]} sentences
 */
function applyOverlongSoftSplit(sentences) {
  const out = [];
  for (const s of sentences) {
    const en = (s.en || "").trim();
    const zh = s.zh || "";
    if (en.length <= MAX_EN_LEN) {
      out.push({ en, zh, softSplit: !!s.softSplit });
      continue;
    }
    const parts = splitOverlongEn(en);
    parts.forEach((part, i) => {
      out.push({
        en: part,
        zh: i === 0 ? zh : "",
        softSplit: true,
      });
    });
  }
  return out;
}

export function parsePureEn(text) {
  const raw = (text || "").trim();
  if (!raw) return [];
  const paragraphs = raw
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const sentences = [];
  for (const para of paragraphs) {
    for (const en of splitParagraphIntoSentences(para)) {
      sentences.push({ en, zh: "" });
    }
  }
  return applyOverlongSoftSplit(sentences);
}

export function parseEnZhLines(text) {
  const lines = (text || "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const sentences = [];
  for (let i = 0; i < lines.length; i += 2) {
    sentences.push({ en: lines[i], zh: lines[i + 1] || "" });
  }
  return applyOverlongSoftSplit(sentences);
}

export function parseByTemplate(template, text) {
  if (template === "en_zh_lines") return parseEnZhLines(text);
  return parsePureEn(text);
}

/**
 * Manually soft-split one draft sentence at index (preview「拆开此句」).
 * Uses splitOverlongEn; if already ≤ MAX, still tries soft split with maxLen = max(SOFT_CHUNK_TARGET, floor(len/2))
 * when len > WARN_EN_LEN so user can shorten practice units; if len ≤ WARN, splits at soft target anyway when > SOFT_CHUNK_TARGET.
 * Plan: button calls splitOverlongEn — for items still > MAX only needed for hard errors.
 * For UX「拆开此句」on long-but-under-max: split with maxLen = SOFT_CHUNK_TARGET when en.length > SOFT_CHUNK_TARGET.
 * @param {object[]} sentences
 * @param {number} index
 */
export function splitSentenceAt(sentences, index) {
  if (index < 0 || index >= sentences.length) return sentences;
  const s = sentences[index];
  const en = (s.en || "").trim();
  if (!en) return sentences;
  const maxLen =
    en.length > MAX_EN_LEN
      ? MAX_EN_LEN
      : Math.min(SOFT_CHUNK_TARGET, Math.max(40, Math.floor(en.length / 2)));
  const parts = splitOverlongEn(en, { maxLen: Math.max(maxLen, 1) });
  if (parts.length <= 1) {
    // Force mid whitespace split if still one piece
    if (en.length < 2) return sentences;
    const mid = Math.floor(en.length / 2);
    let cut = -1;
    for (let i = mid; i > 0; i--) {
      if (/\s/.test(en[i])) {
        cut = i;
        break;
      }
    }
    if (cut < 0) {
      for (let i = mid; i < en.length; i++) {
        if (/\s/.test(en[i])) {
          cut = i;
          break;
        }
      }
    }
    if (cut < 0) cut = mid;
    parts.length = 0;
    parts.push(en.slice(0, cut).trim(), en.slice(cut).trim());
  }
  const filtered = parts.filter(Boolean);
  if (filtered.length <= 1) return sentences;
  const next = [...sentences];
  const zh = s.zh || "";
  const inserted = filtered.map((part, i) => ({
    en: part,
    zh: i === 0 ? zh : "",
    softSplit: true,
  }));
  next.splice(index, 1, ...inserted);
  return next;
}

export function warnNonAsciiInPureEn(sentences) {
  const warnings = [];
  sentences.forEach((s, i) => {
    const en = (s.en || "").trim();
    if (!en) return;
    let nonAscii = 0;
    for (const ch of en) {
      if (ch.charCodeAt(0) > 127) nonAscii += 1;
    }
    if (nonAscii / en.length > 0.3) {
      warnings.push(`第 ${i + 1} 句含较多非英文字符，请检查`);
    }
  });
  return warnings;
}

export function validateSentences(sentences) {
  const errors = [];
  const warnings = [];
  const n = sentences.length;
  if (n < MIN_SENTENCES) errors.push(`至少需要 ${MIN_SENTENCES} 句（当前 ${n} 句）`);
  if (n > MAX_SENTENCES) errors.push(`最多 ${MAX_SENTENCES} 句，请拆成多篇或删减`);
  if (n > WARN_SENTENCES) {
    warnings.push(`当前 ${n} 句 · 超过 ${WARN_SENTENCES} 句，范读准备时间较久`);
  }

  let softSplitCount = 0;
  let missingZhAfterSplit = 0;
  const hasAnyZh = sentences.some((s) => (s.zh || "").trim());
  sentences.forEach((s, i) => {
    const en = (s.en || "").trim();
    if (!en) errors.push(`第 ${i + 1} 句英文为空`);
    else if (en.length > MAX_EN_LEN) {
      errors.push(`第 ${i + 1} 句超过 ${MAX_EN_LEN} 字符，请拆分或点「拆开此句」`);
    } else if (en.length > WARN_EN_LEN) {
      warnings.push(`第 ${i + 1} 句偏长（${en.length} 字符），跟读较吃力，建议拆开`);
    }
    if (s.softSplit) softSplitCount += 1;
    if (
      hasAnyZh &&
      s.softSplit &&
      i > 0 &&
      !(s.zh || "").trim() &&
      sentences[i - 1]?.softSplit
    ) {
      missingZhAfterSplit += 1;
    }
  });

  if (softSplitCount > 0) {
    warnings.push(`有 ${softSplitCount} 句因过长已自动拆开，请核对`);
  }
  if (missingZhAfterSplit > 0) {
    warnings.push(`有英文过长拆开后中文仅保留在首段，请为后续句补中文`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function mergeSentences(sentences, index) {
  if (index < 0 || index >= sentences.length - 1) return sentences;
  const next = [...sentences];
  const a = next[index];
  const b = next[index + 1];
  next[index] = {
    en: `${a.en} ${b.en}`.trim(),
    zh: [a.zh, b.zh].filter(Boolean).join(" ") || "",
    softSplit: false,
  };
  next.splice(index + 1, 1);
  return next;
}

export function deleteSentence(sentences, index) {
  if (index < 0 || index >= sentences.length) return sentences;
  return sentences.filter((_, i) => i !== index);
}
