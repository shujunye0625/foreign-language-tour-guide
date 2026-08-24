#!/usr/bin/env python3
"""Extract sentence-level corpus from the 2025 Guangdong guide exam PDF."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "2025 广东英语口试白皮书.pdf"
OUT_PATH = ROOT / "data" / "corpus.json"

MODULE_MARKERS = {
    "一、景点讲解提问": "scenic_qa",
    "二、导游规范服务": "service_norms",
    "三、特殊问题的处理方法": "emergency",
    "四、综合知识题": "general_knowledge",
    "五、汉译英": "c2e",
    "六、英译汉": "e2c",
}

SPOT_KEYWORDS = {
    "Danxia": ["Danxia", "丹霞", "Shaoguan", "Yangyuan", "Jinjiang"],
    "Kaiping": ["Kaiping", "Diaolou", "碉楼", "Zili", "Li Garden", "立园"],
    "SunYatSen": ["Sun Yat-sen", "Memorial Hall", "中山纪念堂", "孙中山"],
    "Nanyue": ["Nanyue", "南越", "Zhao Mo", "赵眜"],
    "ChenFamily": ["Chen Family", "陈家祠", "Chen Clan"],
}


def normalize_spaces(text: str) -> str:
    text = text.replace("\t", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    text = normalize_spaces(text)
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"(])", text)
    merged: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if merged and len(part) < 40 and not part.endswith((".", "!", "?")):
            merged[-1] = f"{merged[-1]} {part}"
        else:
            merged.append(part)
    return merged


def detect_spot(text: str) -> str | None:
    for spot, keys in SPOT_KEYWORDS.items():
        if any(k.lower() in text.lower() for k in keys):
            return spot
    return None


def extract_focus_words(en: str) -> list[str]:
  words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", en)
  stop = {
      "the", "and", "for", "that", "with", "from", "this", "they", "their",
      "have", "been", "were", "when", "where", "what", "which", "about",
      "into", "also", "must", "should", "would", "could", "there", "here",
  }
  picked: list[str] = []
  for w in words:
      low = w.lower()
      if low in stop or len(low) < 4:
          continue
      if low not in [x.lower() for x in picked]:
          picked.append(w)
      if len(picked) >= 5:
          break
  return picked


def read_pdf_text() -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        print("pypdf not installed; using bundled seed extraction only", file=sys.stderr)
        return ""
    reader = PdfReader(str(PDF_PATH))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages)


def parse_qa_blocks(section_text: str, module: str) -> list[dict]:
    lines = [normalize_spaces(l) for l in section_text.splitlines() if normalize_spaces(l)]
    items: list[dict] = []
    i = 0
    q_num = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^-- \d+ of \d+ --$", line):
            i += 1
            continue
        if re.match(r"^\d+\.\s", line) and re.search(r"[A-Za-z]{4,}", line):
            q_num_match = re.match(r"^(\d+)\.", line)
            q_num = int(q_num_match.group(1)) if q_num_match else q_num + 1
            question_en = re.sub(r"^\d+\.\s*", "", line)
            i += 1
            answer_en_parts: list[str] = []
            question_zh = ""
            answer_zh_parts: list[str] = []
            while i < len(lines):
                nxt = lines[i]
                if re.match(r"^\d+\.\s", nxt) and (
                    re.search(r"[A-Za-z]{4,}", nxt) or re.search(r"[\u4e00-\u9fff]", nxt)
                ):
                    break
                if re.match(r"^-- \d+ of \d+ --$", nxt):
                    i += 1
                    continue
                if re.match(r"^[一二三四五六]、", nxt):
                    break
                if re.match(r"^Reference\s+Example", nxt, re.I):
                    break
                if re.search(r"[\u4e00-\u9fff]", nxt) and not re.search(r"[A-Za-z]{4,}", nxt):
                    if not question_zh and ("？" in nxt or "?" in nxt or "请" in nxt or "试" in nxt):
                        question_zh = re.sub(r"^\d+[\.．]?\s*", "", nxt)
                    else:
                        answer_zh_parts.append(re.sub(r"^答[：:]\s*", "", nxt))
                elif re.search(r"[A-Za-z]", nxt):
                    if nxt.startswith("(") or nxt.startswith("Reference"):
                        answer_en_parts.append(nxt)
                    elif not answer_en_parts and question_en.endswith("?"):
                        answer_en_parts.append(nxt)
                    else:
                        answer_en_parts.append(nxt)
                i += 1
            answer_en = normalize_spaces(" ".join(answer_en_parts))
            answer_zh = normalize_spaces(" ".join(answer_zh_parts))
            if answer_en:
                spot = detect_spot(f"{question_en} {answer_en}")
                for si, sent in enumerate(split_sentences(answer_en)):
                    sid = f"{module}-q{q_num:02d}-s{si+1:02d}"
                    items.append({
                        "id": sid,
                        "module": module,
                        "questionNo": q_num,
                        "sentenceNo": si + 1,
                        "type": "answer",
                        "spot": spot,
                        "questionEn": question_en,
                        "questionZh": question_zh,
                        "en": sent,
                        "zh": answer_zh if si == 0 else "",
                        "audio": f"audio/{module}/{sid}.mp3",
                        "focusWords": extract_focus_words(sent),
                    })
            continue
        i += 1
    return items


def seed_corpus() -> list[dict]:
    """Hand-curated high-quality seed for Danxia + welcome speech."""
    return [
        {
            "id": "scenic_qa-q01-s01",
            "module": "scenic_qa",
            "questionNo": 1,
            "sentenceNo": 1,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "How does \"Danxia\" landform form in Shaoguan?",
            "questionZh": "韶关的“丹霞”地貌是怎样形成的？",
            "en": "Geological studies show that, twenty-five million years ago, this place was a vast expanse of a low-lying lake.",
            "zh": "地质研究表明，二千五百万年前，这个地方原是一片低平的湖泊。",
            "audio": "audio/scenic_qa/scenic_qa-q01-s01.mp3",
            "focusWords": ["Geological", "million", "expanse", "low-lying"],
        },
        {
            "id": "scenic_qa-q01-s02",
            "module": "scenic_qa",
            "questionNo": 1,
            "sentenceNo": 2,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "How does \"Danxia\" landform form in Shaoguan?",
            "questionZh": "韶关的“丹霞”地貌是怎样形成的？",
            "en": "Later, movements of the earth's crust made it rise above the ground and the water receded away, thus turning it into a mountain.",
            "zh": "后来因地壳运动的作用，地面上升，湖水尽退，形成了高耸的山峰。",
            "audio": "audio/scenic_qa/scenic_qa-q01-s02.mp3",
            "focusWords": ["crust", "receded", "mountain"],
        },
        {
            "id": "scenic_qa-q01-s03",
            "module": "scenic_qa",
            "questionNo": 1,
            "sentenceNo": 3,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "How does \"Danxia\" landform form in Shaoguan?",
            "questionZh": "韶关的“丹霞”地貌是怎样形成的？",
            "en": "The former sediment at the bottom of the lake gradually oxidized and became red rocks.",
            "zh": "原来湖底的沉积物受到氧化作用，变成了红色的岩石。",
            "audio": "audio/scenic_qa/scenic_qa-q01-s03.mp3",
            "focusWords": ["sediment", "oxidized", "rocks"],
        },
        {
            "id": "scenic_qa-q02-s01",
            "module": "scenic_qa",
            "questionNo": 2,
            "sentenceNo": 1,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "Who named such kind of red-rock land configuration Danxia Land-form?",
            "questionZh": "是谁将红色砂石的地貌命名为“丹霞地貌”？",
            "en": "In the 1930s, Professor Chen Guoda of the Sun Yat-sen University made an intensive investigation and study of the geomorphic features of the Danxia Mountain and other red-rock mountains in South China.",
            "zh": "二十世纪30年代，中山大学教授陈国达对丹霞山及华南地区的红石山地作了深入的研究。",
            "audio": "audio/scenic_qa/scenic_qa-q02-s01.mp3",
            "focusWords": ["investigation", "geomorphic", "Danxia"],
        },
        {
            "id": "scenic_qa-q02-s02",
            "module": "scenic_qa",
            "questionNo": 2,
            "sentenceNo": 2,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "Who named such kind of red-rock land configuration Danxia Land-form?",
            "questionZh": "是谁将红色砂石的地貌命名为“丹霞地貌”？",
            "en": "He denominated this kind of red-rock land configuration the \"Danxia Landform\", which was soon approved and universally adopted by the academic circles.",
            "zh": "将这一类红色砂石的地貌命名为“丹霞地貌”，并很快被学术界接受并采用。",
            "audio": "audio/scenic_qa/scenic_qa-q02-s02.mp3",
            "focusWords": ["denominated", "Landform", "academic"],
        },
        {
            "id": "scenic_qa-q03-s01",
            "module": "scenic_qa",
            "questionNo": 3,
            "sentenceNo": 1,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "Why is the sight of the rocks beyond the Jinjiang River named \"The Elephant Crossing the River\"?",
            "questionZh": "为什么在锦江的那些山峰景观被命名为“群象过江”呢？",
            "en": "Those rocks appear to be a herd of elephants wading across the river and coming up to us.",
            "zh": "那些山峰就像一头头大象正要跨越锦江向我们走来。",
            "audio": "audio/scenic_qa/scenic_qa-q03-s01.mp3",
            "focusWords": ["elephants", "wading", "river"],
        },
        {
            "id": "scenic_qa-q03-s02",
            "module": "scenic_qa",
            "questionNo": 3,
            "sentenceNo": 2,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "Why is the sight of the rocks beyond the Jinjiang River named \"The Elephant Crossing the River\"?",
            "questionZh": "为什么在锦江的那些山峰景观被命名为“群象过江”呢？",
            "en": "Their trunks, tusks, ears and eyes are all lifelike.",
            "zh": "象鼻、象牙、象耳、象眼形神俱备。",
            "audio": "audio/scenic_qa/scenic_qa-q03-s02.mp3",
            "focusWords": ["trunks", "tusks", "lifelike"],
        },
        {
            "id": "scenic_qa-q03-s03",
            "module": "scenic_qa",
            "questionNo": 3,
            "sentenceNo": 3,
            "type": "answer",
            "spot": "Danxia",
            "questionEn": "Why is the sight of the rocks beyond the Jinjiang River named \"The Elephant Crossing the River\"?",
            "questionZh": "为什么在锦江的那些山峰景观被命名为“群象过江”呢？",
            "en": "So, this sight is named \"The Elephants Crossing the River\".",
            "zh": "所以，这一景就叫“群象过江”。",
            "audio": "audio/scenic_qa/scenic_qa-q03-s03.mp3",
            "focusWords": ["Elephants", "Crossing", "River"],
        },
        {
            "id": "service_norms-welcome-s01",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 1,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "Good morning, ladies and gentlemen.",
            "zh": "女士们，先生们：早上好！",
            "audio": "audio/service_norms/service_norms-welcome-s01.mp3",
            "focusWords": ["morning", "ladies", "gentlemen"],
        },
        {
            "id": "service_norms-welcome-s02",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 2,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "Welcome to Guangzhou!",
            "zh": "欢迎来到广州！",
            "audio": "audio/service_norms/service_norms-welcome-s02.mp3",
            "focusWords": ["Welcome", "Guangzhou"],
        },
        {
            "id": "service_norms-welcome-s03",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 3,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "My name is ... Our driver's name is ... I work for Guangzhou China International Travel Service.",
            "zh": "我的名字是……我们的司机的名字是……我是中国国际旅行社广州分社的导游。",
            "audio": "audio/service_norms/service_norms-welcome-s03.mp3",
            "focusWords": ["International", "Travel", "Service"],
        },
        {
            "id": "service_norms-welcome-s04",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 4,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "We two have the pleasure of being your guides during your stay in Guangzhou.",
            "zh": "在你们逗留期间我们俩很荣幸做你们的导游。",
            "audio": "audio/service_norms/service_norms-welcome-s04.mp3",
            "focusWords": ["pleasure", "guides", "Guangzhou"],
        },
        {
            "id": "service_norms-welcome-s05",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 5,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "I expect that this is the first trip to Guangzhou for most of you.",
            "zh": "我估计这次是你们大多数人第一次到广州来吧。",
            "audio": "audio/service_norms/service_norms-welcome-s05.mp3",
            "focusWords": ["expect", "Guangzhou"],
        },
        {
            "id": "service_norms-welcome-s06",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 6,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "We'll do our best to make your stay here enjoyable, restful and comfortable.",
            "zh": "在你们逗留广州期间我们会尽力让你们在这里过得愉快、休闲与舒适。",
            "audio": "audio/service_norms/service_norms-welcome-s06.mp3",
            "focusWords": ["enjoyable", "restful", "comfortable"],
        },
        {
            "id": "service_norms-welcome-s07",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 7,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "Please feel free to let us know whatever complaints you may have about our work or the hotel service, so we can improve in good time.",
            "zh": "如有任何关于我们工作或酒店服务等方面的不满意，请不要介意告诉我们，这样我们便可以及时改进。",
            "audio": "audio/service_norms/service_norms-welcome-s07.mp3",
            "focusWords": ["complaints", "service", "improve"],
        },
        {
            "id": "service_norms-welcome-s08",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 8,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "We look forward to your cooperation.",
            "zh": "我们期待着你们的合作。",
            "audio": "audio/service_norms/service_norms-welcome-s08.mp3",
            "focusWords": ["cooperation"],
        },
        {
            "id": "service_norms-welcome-s09",
            "module": "service_norms",
            "questionNo": 5,
            "sentenceNo": 9,
            "type": "script",
            "spot": None,
            "questionEn": "Try to make a welcome speech to a tourist group in the name of a local guide.",
            "questionZh": "试以地陪的身份对旅行团致一段规范的欢迎辞。",
            "en": "Wish you enjoy your tour in our city and have fun.",
            "zh": "愿你们享受这里的旅游，同时玩得开心。",
            "audio": "audio/service_norms/service_norms-welcome-s09.mp3",
            "focusWords": ["enjoy", "tour"],
        },
    ]


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    sentences: list[dict] = []
    seen_ids: set[str] = set()

    for item in seed_corpus():
        sentences.append(item)
        seen_ids.add(item["id"])

    raw = read_pdf_text()
    if raw:
        current_module = None
        sections: dict[str, str] = {mod: "" for mod in MODULE_MARKERS.values()}
        for line in raw.splitlines():
            line = normalize_spaces(line)
            for marker, mod in MODULE_MARKERS.items():
                if marker in line:
                    current_module = mod
                    break
            if current_module:
                sections[current_module] += line + "\n"
        for mod, text in sections.items():
            if not text.strip():
                continue
            for item in parse_qa_blocks(text, mod):
                if item["id"] not in seen_ids:
                    sentences.append(item)
                    seen_ids.add(item["id"])

    modules_meta = {
        "scenic_qa": {"label": "景点问答", "strategy": "shadowing", "description": "100LS影子跟读"},
        "service_norms": {"label": "导游规范", "strategy": "roleplay", "description": "脚本记忆+角色扮演"},
        "emergency": {"label": "应变能力", "strategy": "task", "description": "DLI任务导向应答"},
        "general_knowledge": {"label": "综合知识", "strategy": "keywords", "description": "关键词锚点短答"},
        "c2e": {"label": "汉译英", "strategy": "interpret", "description": "听译对循环"},
        "e2c": {"label": "英译汉", "strategy": "interpret", "description": "听译对循环"},
    }

    payload = {
        "version": 1,
        "source": "2025 广东英语口试白皮书",
        "modules": modules_meta,
        "sentences": sentences,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(sentences)} sentences to {OUT_PATH}")


if __name__ == "__main__":
    main()
