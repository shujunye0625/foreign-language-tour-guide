#!/usr/bin/env python3
"""Parse scenic commentary markdown → data/scenic_guides/{id}.json (+ index)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "content" / "scenic-commentaries"
OUT = ROOT / "data" / "scenic_guides"

SPOTS = [
    {
        "id": "danxia",
        "file": "01-danxia.md",
        "titleZh": "丹霞山",
        "titleEn": "Danxia Mountain",
        "blurb": "红石成因 · 群象睡美人 · 阴阳石 · 别传寺",
    },
    {
        "id": "kaiping",
        "file": "02-kaiping.md",
        "titleZh": "开平碉楼",
        "titleEn": "Kaiping Diaolou",
        "blurb": "三大类 · 铭石楼 · 立园 · 修身立本",
    },
    {
        "id": "sun-yat-sen-hall",
        "file": "03-sun-yat-sen-hall.md",
        "titleZh": "中山纪念堂",
        "titleEn": "Sun Yat-sen Memorial Hall",
        "blurb": "生平主线 · 吕彦直 · 无柱声学",
    },
    {
        "id": "nanyue-king-museum",
        "file": "04-nanyue-king-museum.md",
        "titleZh": "南越王墓",
        "titleEn": "Nanyue King Tomb",
        "blurb": "赵眜 · 金印玉印 · 丝缕玉衣 · 句鑃",
    },
    {
        "id": "chen-family-temple",
        "file": "05-chen-family-temple.md",
        "titleZh": "陈家祠",
        "titleEn": "Chen Family Temple",
        "blurb": "礼制明珠 · 爵禄封侯 · 六类工艺 · 舜帝",
    },
]

# Scene hooks for stop directory (guide memory anchors)
SCENE_HOOKS = {
    "danxia": {
        "Opening": "大巴下车 / 景区总览牌",
        "Stop A: How the red land was born — and how it got its scientific name": "红崖剖面 / 成因解说牌",
        "Stop B: China Ruby Park — the big picture in numbers": "观景台俯瞰群峰",
        "Stop 1: Jinjiang River — “The Elephants Crossing the River”": "锦江对岸象形石",
        "Stop 2: Yangyuan Bridge — “The Sleeping Belle”": "阳元桥上看睡美人",
        "Stop 3: Yangyuan Hill and Yangyuan Stone": "阳元石脚下",
        "Stop 4: Yinyuan Cliff — Nature’s Adam and Eve": "阴元石景区",
        "Stop 5: Biechuan Temple and the chameleon dragon": "别传寺 · 大雄宝殿",
        "Closing": "出口 / 集合点",
    },
    "kaiping": {
        "Opening": "开平碉楼村落入口",
        "Stop A: What are they — honors and numbers": "世遗解说牌",
        "Stop B: Why build houses like fortresses?": "碉楼远景",
        "Stop C: Three functional types": "三类碉楼示意图",
        "Stop 1: Zili Village — Mingshilou, the finest": "自力村 · 铭石楼前",
        "Stop 2: Ruishilou and Fangshi Denglou": "瑞石楼 / 方氏灯楼",
        "Stop 3: Li Garden — name, layout, and East meets West": "立园拱门",
        "Closing": "村落出口",
    },
    "sun-yat-sen-hall": {
        "Opening": "纪念堂广场仰视",
        "Stop A: Why this hall stands here": "奠基 / 建堂说明",
        "Stop B: Sun Yat-sen’s life — the story behind the roof": "生平浮雕 / 展板",
        "Stop C: The exterior — Chinese palace, modern bones": "八角外观仰拍点",
        "Stop D: The architect — Lu Yanzhi": "吕彦直介绍牌",
        "Stop E: Inside — 3,238 seats, no blocking pillars": "大堂座席中央",
        "Closing": "大厅出口",
    },
    "nanyue-king-museum": {
        "Opening": "王墓展区入口",
        "Stop A: Who is buried here?": "墓主介绍",
        "Stop B: Discovery and the tomb’s shape": "墓室模型 / 平面图",
        "Stop C: Palace ruins nearby": "宫殿遗址展板",
        "Stop D: Fifteen people buried alive": "殉人展区",
        "Stop E: Seals — gold imperial seal and nine jade seals": "金印 · 玉印展柜",
        "Stop F: The silk jade garment and the giant jade disc": "丝缕玉衣 · 玉璧",
        "Stop G: Bronze — dagger-axe, tiger tally, and chime": "铜戈 · 虎节 · 句鑃",
        "Stop H: A Persian silver box — and why Guangzhou cares": "银盒展柜",
        "Closing": "展区出口",
    },
    "chen-family-temple": {
        "Opening": "陈家祠门前广场",
        "Stop A: Three functions, one pearl": "总览 · 三功能说明",
        "Stop 1: Main entrance — drums, “titles and salaries,” brick stories, door-gods": "正门石鼓 · 砖雕 · 门神",
        "Stop 2: “The Advent of Good Fortune”": "倒福木雕",
        "Stop 3: Lingnan fruits on the balusters": "栏杆岭南佳果",
        "Stop 4: Hen, chicks, and banana leaves — “great property”": "芭蕉鸡群图",
        "Stop 5: A picture that encourages lifelong study": "励志图",
        "Stop 6: The rear hall — Emperor Shun at the top": "后堂舜帝神位",
        "Closing": "祠堂出口",
    },
}

MUST_SAY = {
    "danxia": [
        "Danxia Landform",
        "China Ruby Park",
        "Elephants Crossing the River",
        "Sleeping Belle",
        "Yangyuan Stone",
        "four most famous mountains",
    ],
    "kaiping": [
        "defense, residence, Chinese–Western",
        "communal, residential, watch",
        "Mingshilou",
        "Xiu Shen Li Ben",
        "3,300 / 1,833 / 20",
    ],
    "sun-yat-sen-hall": [
        "Xing Zhong Hui",
        "Tong Meng Hui",
        "1911 Revolution",
        "Lu Yanzhi",
        "3,238 seats",
    ],
    "nanyue-king-museum": [
        "Zhao Mo / Emperor Wen",
        "gold seal with dragon handle",
        "nine jade seals",
        "silk-thread jade garment",
        "Gou Diao",
    ],
    "chen-family-temple": [
        "Pearl of Lingnan Artistic Architecture",
        "Chen Botao / tanhua",
        "Jue Lu Feng Hou",
        "six crafts",
        "Emperor Shun",
    ],
}


def strip_md(text: str) -> str:
    text = text.replace("**", "")
    text = text.replace("*", "")
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.strip()


def extract_focus(text: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\*\*([^*]+)\*\*", text)))


def split_sentences(text: str) -> list[str]:
    text = strip_md(text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    # Keep abbreviations / decimals from splitting
    placeholders: list[str] = []

    def park(m: re.Match) -> str:
        placeholders.append(m.group(0))
        return f"⟦{len(placeholders) - 1}⟧"

    text = re.sub(r"\b(?:Mr|Mrs|Ms|Dr|Prof|St)\.", park, text)
    text = re.sub(r"\b([A-Z])\.", park, text)
    text = re.sub(r"(\d)\.(\d)", park, text)

    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"“])", text)
    out: list[str] = []
    for p in parts:
        for i, ph in enumerate(placeholders):
            p = p.replace(f"⟦{i}⟧", ph)
        p = p.strip()
        if len(p) > 12:
            out.append(p)
    return out


def parse_commentary(md: str) -> list[dict]:
    """Return list of {stopTitle, body} under ## English Commentary."""
    m = re.search(
        r"## English Commentary\s*(.*?)(?=\n---|\n## 记忆锚点|\Z)",
        md,
        re.S,
    )
    if not m:
        raise ValueError("English Commentary section not found")
    body = m.group(1).strip()
    chunks = re.split(r"\n###\s+", body)
    stops = []
    for i, chunk in enumerate(chunks):
        chunk = chunk.strip()
        if not chunk:
            continue
        if i == 0 and not re.match(r"^(Opening|Stop|Closing)\b", chunk):
            # rare: prose before first heading
            title = "Opening"
            content = chunk
        else:
            lines = chunk.split("\n", 1)
            title = lines[0].strip().lstrip("#").strip()
            content = lines[1].strip() if len(lines) > 1 else ""
        stops.append({"title": title, "body": content})
    return stops


def translate_batch(texts: list[str]) -> list[str]:
    """Prefer offline: leave empty; fill via fill_scenic_zh.py or hand edit."""
    return [""] * len(texts)


def build_spot(meta: dict) -> dict:
    md_path = SRC / meta["file"]
    md = md_path.read_text(encoding="utf-8")
    stops_raw = parse_commentary(md)
    hooks = SCENE_HOOKS.get(meta["id"], {})

    sentences = []
    stops = []
    sent_n = 0
    for stop_i, stop in enumerate(stops_raw):
        title = stop["title"]
        stop_id = f"stop-{stop_i}"
        start_idx = len(sentences)
        for para in re.split(r"\n\s*\n", stop["body"]):
            para = para.strip()
            if not para:
                continue
            phrases = extract_focus(para)[:8]
            for sent in split_sentences(para):
                sent_n += 1
                sentences.append(
                    {
                        "id": f"{meta['id']}-s{sent_n:02d}",
                        "en": sent,
                        "zh": "",
                        "stopId": stop_id,
                        "focusPhrases": phrases,
                        "audio": f"audio/scenic_guides/{meta['id']}/{meta['id']}-s{sent_n:02d}.mp3",
                    }
                )
        end_idx = len(sentences) - 1
        if end_idx >= start_idx:
            stops.append(
                {
                    "id": stop_id,
                    "title": strip_md(title),
                    "sceneHook": hooks.get(title) or hooks.get(strip_md(title)) or strip_md(title),
                    "sentenceStart": start_idx,
                    "sentenceEnd": end_idx,
                    "mustSay": [],
                }
            )

    # Attach mustSay to first content stop / distribute key phrases on opening+closing
    must = MUST_SAY.get(meta["id"], [])
    if stops:
        stops[0]["mustSay"] = must[:3]
        if len(stops) > 1:
            stops[-1]["mustSay"] = must[3:] if len(must) > 3 else must[-2:]

    print(f"Translating {meta['id']} ({len(sentences)} sentences)…")
    zhs = translate_batch([s["en"] for s in sentences])
    for s, zh in zip(sentences, zhs):
        s["zh"] = zh

    # Clear per-sentence focus spam: keep unique bold phrases at stop level only for first sentence of stop
    seen_stops = set()
    for s in sentences:
        if s["stopId"] in seen_stops:
            s["focusPhrases"] = []
        else:
            seen_stops.add(s["stopId"])

    return {
        "id": meta["id"],
        "titleZh": meta["titleZh"],
        "titleEn": meta["titleEn"],
        "blurb": meta["blurb"],
        "targetMinutes": 8,
        "stops": stops,
        "sentences": sentences,
        "mustSay": must,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for meta in SPOTS:
        guide = build_spot(meta)
        path = OUT / f"{meta['id']}.json"
        path.write_text(json.dumps(guide, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {path} ({len(guide['sentences'])} sentences, {len(guide['stops'])} stops)")
        index.append(
            {
                "id": meta["id"],
                "titleZh": meta["titleZh"],
                "titleEn": meta["titleEn"],
                "blurb": meta["blurb"],
                "file": f"{meta['id']}.json",
                "sentenceCount": len(guide["sentences"]),
            }
        )
    (OUT / "index.json").write_text(
        json.dumps({"version": 1, "spots": index}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("Done index.json")


if __name__ == "__main__":
    main()
