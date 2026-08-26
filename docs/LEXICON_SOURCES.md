# Offline lexicon sources (bundled subset in data/lexicon/guide-lexicon.json)

## ECDICT

- **Project:** [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)
- **License:** MIT
- **Use:** Chinese gloss (`translation`), phonetic (`phonetic`), word forms (`exchange`)
- **Build:** `python scripts/build_lexicon.py` downloads `ecdict.csv` into `scripts/cache/` (not committed)

## Guide sentences

- **Source:** `data/scenic_guides/*.json` (project-owned bilingual commentaries)
- **Use:** First-occurrence sentence as `exampleEn` / `exampleZh` where the word appears in the guide

## Phrase patches

- **Source:** `data/phrase_patches.json`
- **Use:** Tour-specific terms (丹霞地貌, 碉楼, etc.) not covered by general dictionaries

## Optional build-time examples

- **Free Dictionary API** (`api.dictionaryapi.dev`) — used only when running `build_lexicon.py` without `--no-fetch-examples`; results are baked into JSON; the app does not call this at runtime.

## Regenerating the lexicon

```bash
python scripts/build_lexicon.py --no-fetch-examples
# or with online example fetch (build machine only):
python scripts/build_lexicon.py
```

Commit `data/lexicon/guide-lexicon.json` after regeneration. Do not commit `scripts/cache/ecdict.csv` (~66MB).
