/**
 * Gold-standard checks for app/parse-paste.js
 * Run: node scripts/test_parse_paste.mjs
 *
 * Manual release checklist (after Worker redeploy):
 * 1. Paste pure-en scenic text → sensible splits, save + TTS progress
 * 2. Paste >1000 char blob without periods → auto soft-split, save OK
 * 3. en_zh_lines normal pairing OK
 * 4. en_zh overlong EN → zh on first only; can补中文
 * 5. Merge two sentences past 1000 → save disabled;「拆开此句」recovers
 * 6. Export/import JSON with 999-char sentence OK
 * 7. Import JSON with 1001-char sentence fails clearly
 * 8. Worker curl: 1000 chars → 200; 1001 → 400
 * 9. Bad Worker URL → system TTS fallback still plays
 * 10. Soft-split near 200 sentences → clear max-sentence error
 */
import {
  MAX_EN_LEN,
  WARN_EN_LEN,
  parsePureEn,
  parseEnZhLines,
  splitOverlongEn,
  splitParagraphIntoSentences,
  validateSentences,
  splitSentenceAt,
} from "../app/parse-paste.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("OK:", msg);
  }
}

function padWords(n) {
  const word = "word ";
  let s = "";
  while (s.length < n) s += word;
  s = s.slice(0, n).trimEnd();
  while (s.length < n) s += "x";
  return s;
}

// --- S3: abbreviations ---
{
  const parts = splitParagraphIntoSentences("Dr. Chen arrived. Next stop is open.");
  assert(parts.length === 2, "Dr. Chen… → 2 sentences");
  assert(parts[0].startsWith("Dr. Chen"), "first keeps Dr.");
  assert(parts[1].startsWith("Next"), "second starts Next");
}

{
  const parts = splitParagraphIntoSentences(
    "The U.S. Open is famous. Fans arrive early."
  );
  assert(parts.length === 2, "U.S. Open… → 2 sentences");
  assert(parts[0].includes("U.S."), "keeps U.S.");
}

{
  const parts = splitParagraphIntoSentences(
    "The tower is 3.14 meters tall. Visitors love it."
  );
  assert(parts.length === 2, "decimal 3.14 not split");
  assert(parts[0].includes("3.14"), "keeps 3.14");
}

// --- S1: 800 char no period: one sentence, validate ok, WARN ---
{
  const en = padWords(800);
  const sents = parsePureEn(en);
  assert(sents.length === 1, "800-char no period → 1 sentence after parse");
  assert(sents[0].en.length === 800, "length preserved 800");
  const v = validateSentences([
    { en: sents[0].en, zh: "a" },
    { en: "Short two.", zh: "b" },
    { en: "Short three.", zh: "c" },
  ]);
  assert(v.ok, "800-char sentence validate ok");
  assert(
    v.warnings.some((w) => w.includes("偏长")),
    "800-char has WARN_EN_LEN warning"
  );
}

// --- S2: 2000 char no period → soft split ≤1000 ---
{
  const en = padWords(2000);
  const sents = parsePureEn(en);
  assert(sents.length >= 2, "2000-char → ≥2 sentences");
  assert(
    sents.every((s) => s.en.length <= MAX_EN_LEN),
    "each chunk ≤ MAX_EN_LEN"
  );
  assert(
    sents.every((s) => s.softSplit),
    "softSplit marked"
  );
  const v = validateSentences([
    ...sents,
    ...(sents.length < 3
      ? [
          { en: "Pad alpha.", zh: "" },
          { en: "Pad beta.", zh: "" },
        ].slice(0, 3 - sents.length)
      : []),
  ]);
  assert(v.ok, "soft-split 2000 validate ok");
  assert(
    v.warnings.some((w) => w.includes("自动拆开")),
    "soft-split warning present"
  );
}

// --- semicolon prefer ---
{
  const a = padWords(600);
  const b = padWords(600);
  const en = `${a.trim()}; ${b.trim()}`;
  const parts = splitOverlongEn(en);
  assert(parts.length === 2, "semicolon long → 2 parts");
  assert(parts[0].includes(";") || parts[0].endsWith(";") || !parts[1].startsWith(";"), "split near semicolon");
  // left should be ~600 (around first half)
  assert(parts[0].length <= MAX_EN_LEN && parts[1].length <= MAX_EN_LEN, "both ≤ max");
}

// --- en_zh overlong ---
{
  const en = padWords(1200);
  const text = `${en}\n中文翻译在此。`;
  const sents = parseEnZhLines(text);
  assert(sents.length >= 2, "en_zh 1200 → ≥2");
  assert((sents[0].zh || "").includes("中文"), "zh on first only");
  assert(sents.slice(1).every((s) => !(s.zh || "").trim()), "later zh empty");
  const v = validateSentences([
    ...sents,
    ...(sents.length < 3
      ? [{ en: "Extra one.", zh: "" }, { en: "Extra two.", zh: "" }].slice(
          0,
          3 - sents.length
        )
      : []),
  ]);
  assert(
    v.warnings.some((w) => w.includes("补中文")),
    "补中文 warning"
  );
}

// --- min sentences ---
{
  const v = validateSentences([
    { en: "One.", zh: "" },
    { en: "Two.", zh: "" },
  ]);
  assert(!v.ok && v.errors.some((e) => e.includes("至少")), "min 3 sentences");
}

// --- 1010 without soft split path: validate fails ---
{
  const en = padWords(1010);
  const v = validateSentences([
    { en, zh: "" },
    { en: "Two.", zh: "" },
    { en: "Three.", zh: "" },
  ]);
  assert(!v.ok, "1010 direct validate fails");
  assert(
    v.errors.some((e) => e.includes(String(MAX_EN_LEN))),
    "error mentions MAX_EN_LEN"
  );
}

// --- constants ---
assert(MAX_EN_LEN === 1000, "MAX_EN_LEN === 1000");
assert(WARN_EN_LEN === 280, "WARN_EN_LEN === 280");

// --- splitSentenceAt ---
{
  const base = [
    { en: padWords(600), zh: "甲" },
    { en: "Two.", zh: "乙" },
    { en: "Three.", zh: "丙" },
  ];
  const next = splitSentenceAt(base, 0);
  assert(next.length > 3, "splitSentenceAt increases count");
  assert(next[0].zh === "甲", "zh stays on first after manual split");
}

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll parse-paste tests passed.");
