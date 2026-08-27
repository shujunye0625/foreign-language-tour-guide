export const MIN_SENTENCES = 3;
export const MAX_SENTENCES = 200;
export const MAX_EN_LEN = 500;
export const WARN_SENTENCES = 150;

const ABBREV_RE = /\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|etc|U\.S|U\.K|e\.g|i\.e)\./gi;

function protectAbbrev(text) {
  return text.replace(ABBREV_RE, (m) => m.replace(".", "\u0000"));
}

function restoreDots(text) {
  return text.replace(/\u0000/g, ".");
}

export function parsePureEn(text) {
  const raw = (text || "").trim();
  if (!raw) return [];
  const paragraphs = protectAbbrev(raw)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const sentences = [];
  for (const para of paragraphs) {
    const parts = para.split(/(?<=[.!?])\s+/);
    for (const part of parts) {
      const en = restoreDots(part).trim();
      if (en) sentences.push({ en, zh: "" });
    }
  }
  return sentences;
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
  return sentences;
}

export function parseByTemplate(template, text) {
  if (template === "en_zh_lines") return parseEnZhLines(text);
  return parsePureEn(text);
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
  sentences.forEach((s, i) => {
    const en = (s.en || "").trim();
    if (!en) errors.push(`第 ${i + 1} 句英文为空`);
    else if (en.length > MAX_EN_LEN) {
      errors.push(`第 ${i + 1} 句超过 ${MAX_EN_LEN} 字符，请拆分`);
    }
  });
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
  };
  next.splice(index + 1, 1);
  return next;
}

export function deleteSentence(sentences, index) {
  if (index < 0 || index >= sentences.length) return sentences;
  return sentences.filter((_, i) => i !== index);
}
