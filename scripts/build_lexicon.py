#!/usr/bin/env python3
"""Build data/lexicon/guide-lexicon.json from scenic guides + ECDICT (MIT)."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUIDES_DIR = ROOT / "data" / "scenic_guides"
PATCHES_PATH = ROOT / "data" / "phrase_patches.json"
OUT_PATH = ROOT / "data" / "lexicon" / "guide-lexicon.json"
CACHE_DIR = ROOT / "scripts" / "cache"
ECDICT_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
ECDICT_CACHE = CACHE_DIR / "ecdict.csv"
FREE_DICT = "https://api.dictionaryapi.dev/api/v2/entries/en/{word}"

WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*")
EXCHANGE_RE = re.compile(r"([a-z]+):([^/]+)", re.I)


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def collect_vocabulary():
    lemmas: set[str] = set()
    phrases: set[str] = set()
    first_sentence: dict[str, dict] = {}

    if PATCHES_PATH.exists():
        patches = load_json(PATCHES_PATH)
        if isinstance(patches, dict):
            phrases.update(patches.keys())

    for path in sorted(GUIDES_DIR.glob("*.json")):
        if path.name == "index.json":
            continue
        guide = load_json(path)
        for s in guide.get("sentences") or []:
            sid = s.get("id") or ""
            en = s.get("en") or ""
            zh = s.get("zh") or ""
            ctx = {"sentenceId": sid, "exampleEn": en, "exampleZh": zh}
            for ph in s.get("focusPhrases") or []:
                if ph.strip():
                    phrases.add(ph.strip())
            for tok in WORD_RE.findall(en):
                low = tok.lower()
                if len(low) < 2:
                    continue
                lemmas.add(low)
                if low not in first_sentence:
                    first_sentence[low] = ctx

    return lemmas, phrases, first_sentence


def download_ecdict() -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if ECDICT_CACHE.exists() and ECDICT_CACHE.stat().st_size > 1000:
        return ECDICT_CACHE
    print(f"Downloading ECDICT -> {ECDICT_CACHE} (~66MB, first run only)", flush=True)
    urllib.request.urlretrieve(ECDICT_URL, ECDICT_CACHE)
    return ECDICT_CACHE


def parse_exchange(exchange: str) -> dict[str, str]:
    forms: dict[str, str] = {}
    if not exchange:
        return forms
    for kind, form in EXCHANGE_RE.findall(exchange):
        for part in form.split(","):
            part = part.strip().lower()
            if part:
                forms[part] = kind
    return forms


def load_ecdict_for_lemmas(csv_path: Path, lemmas: set[str]):
    """Single pass: load ECDICT rows needed for guide lemmas (+ inflected forms)."""
    by_word: dict[str, dict] = {}
    form_to_lemma: dict[str, str] = {}
    with csv_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            w = (row.get("word") or "").strip().lower()
            if not w:
                continue
            forms = set(parse_exchange(row.get("exchange") or "").keys())
            if w not in lemmas and not (forms & lemmas):
                continue
            by_word[w] = row
            for form in forms:
                form_to_lemma[form] = w
    return by_word, form_to_lemma


def load_ecdict_index(csv_path: Path):
    """Legacy full index — unused for large csv."""
    return load_ecdict_for_lemmas(csv_path, set())


def clean_field(text: str) -> str:
    return (text or "").replace("\\n", "\n").strip()


def row_to_senses(row: dict, guide_ctx: dict | None) -> list[dict]:
    zh_lines = [x.strip() for x in clean_field(row.get("translation") or "").split("\n") if x.strip()]
    en_lines = [x.strip() for x in clean_field(row.get("definition") or "").split("\n") if x.strip()]
    if not zh_lines and not en_lines:
        return []
    n = max(len(zh_lines), len(en_lines), 1)
    senses = []
    for i in range(min(n, 6)):
        sense: dict = {
            "zh": zh_lines[i] if i < len(zh_lines) else (zh_lines[0] if zh_lines else ""),
            "enDef": en_lines[i] if i < len(en_lines) else (en_lines[0] if en_lines else ""),
        }
        if guide_ctx and i == 0:
            sense["exampleEn"] = guide_ctx.get("exampleEn", "")
            sense["exampleZh"] = guide_ctx.get("exampleZh", "")
            sense["exampleSource"] = "guide"
        senses.append(sense)
    return senses


def patch_to_entry(term: str, patch: dict, guide_ctx: dict | None) -> dict:
    senses = []
    gloss = patch.get("gloss") or ""
    raw = patch.get("senses") or []
    for i, s in enumerate(raw[:4]):
        if isinstance(s, dict):
            senses.append(s)
        else:
            entry = {"zh": gloss if i == 0 else "", "enDef": str(s)}
            if guide_ctx and i == 0:
                entry["exampleEn"] = guide_ctx.get("exampleEn", "")
                entry["exampleZh"] = guide_ctx.get("exampleZh", "")
                entry["exampleSource"] = "guide"
            senses.append(entry)
    if not senses and gloss:
        entry = {"zh": gloss, "enDef": ""}
        if guide_ctx:
            entry["exampleEn"] = guide_ctx.get("exampleEn", "")
            entry["exampleZh"] = guide_ctx.get("exampleZh", "")
            entry["exampleSource"] = "guide"
        senses.append(entry)
    return {"type": "phrase", "ipa": patch.get("ipa") or "", "senses": senses, "inGuide": True}


def fetch_free_dict_examples(word: str) -> list[str]:
    url = FREE_DICT.format(word=urllib.request.quote(word.lower()))
    try:
        with urllib.request.urlopen(url, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError):
        return []
    examples: list[str] = []
    for entry in data if isinstance(data, list) else [data]:
        for m in entry.get("meanings") or []:
            for d in m.get("definitions") or []:
                ex = (d.get("example") or "").strip()
                if ex and ex not in examples:
                    examples.append(ex)
                if len(examples) >= 2:
                    return examples
    return examples


def merge_examples(senses: list[dict], examples: list[str], source: str) -> None:
    if not examples or not senses:
        return
    for i, ex in enumerate(examples[:2]):
        if i < len(senses) and not senses[i].get("exampleEn"):
            senses[i]["exampleEn"] = ex
            senses[i]["exampleSource"] = source


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-fetch-examples", action="store_true")
    args = parser.parse_args()

    lemmas, phrases, first_sentence = collect_vocabulary()
    print(f"Vocabulary: {len(lemmas)} lemmas, {len(phrases)} phrases", flush=True)

    csv_path = download_ecdict()
    ecdict, form_to_lemma = load_ecdict_for_lemmas(csv_path, lemmas)
    patches = load_json(PATCHES_PATH) if PATCHES_PATH.exists() else {}

    lexicon: dict[str, dict] = {}
    missing = []

    for lemma in sorted(lemmas):
        row = ecdict.get(lemma) or ecdict.get(form_to_lemma.get(lemma, ""))
        ctx = first_sentence.get(lemma)
        if not row:
            missing.append(lemma)
            entry = {"ipa": "", "pos": "", "senses": [], "forms": [], "inGuide": True}
            if ctx:
                entry["senses"] = [{
                    "zh": "",
                    "enDef": "",
                    "exampleEn": ctx["exampleEn"],
                    "exampleZh": ctx["exampleZh"],
                    "exampleSource": "guide",
                }]
            lexicon[lemma] = entry
            continue
        senses = row_to_senses(row, ctx)
        forms = list(parse_exchange(row.get("exchange") or "").keys())
        lexicon[lemma] = {
            "ipa": row.get("phonetic") or "",
            "pos": row.get("pos") or "",
            "senses": senses,
            "forms": forms,
            "inGuide": True,
        }

    for ph in sorted(phrases):
        patch = patches.get(ph, {}) if isinstance(patches, dict) else {}
        ctx = None
        for c in first_sentence.values():
            if ph.lower() in (c.get("exampleEn") or "").lower():
                ctx = c
                break
        lexicon[ph] = patch_to_entry(ph, patch, ctx)

    if not args.no_fetch_examples:
        todo = [w for w in lemmas if lexicon.get(w, {}).get("senses")]
        print(f"Fetching build-time examples for {len(todo)} lemmas...", flush=True)
        for i, lemma in enumerate(todo):
            if i and i % 40 == 0:
                print(f"  ...{i}/{len(todo)}", flush=True)
            exs = fetch_free_dict_examples(lemma)
            if exs:
                merge_examples(lexicon[lemma]["senses"], exs, "freedict")
            time.sleep(0.12)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "_meta": {
            "sources": ["ECDICT (MIT)", "guide sentences", "phrase_patches"],
            "lemmaCount": len(lemmas),
            "phraseCount": len(phrases),
            "missingEcdict": len(missing),
        },
        **lexicon,
    }
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size // 1024} KB)", flush=True)
    if missing:
        print(f"  {len(missing)} lemmas not in ECDICT", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
