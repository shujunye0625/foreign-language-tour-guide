# 导游英语影子跟读（手机 PWA）

广东导游资格考试英语口试 · 100LS 影子跟读，专为通勤手机练习。

## 手机访问（GitHub Pages）

部署成功后用手机流量打开：

**https://shujunye0625.github.io/foreign-language-tour-guide/**

添加到主屏幕后，像 App 一样使用。

## 开启 Pages（推送后做一次）

仓库 → **Settings** → **Pages** → **Source** 选 **GitHub Actions**

## 本地预览

双击 `start-server.bat`，或：

```powershell
cd c:\Users\Administrator.DESKTOP-TSASORM\Desktop\tour
python -m http.server 8765 --bind 0.0.0.0
```

- 电脑：http://127.0.0.1:8765/
- 手机（同一 WiFi/热点）：http://电脑IP:8765/

## 生成更多美音音频

```powershell
pip install edge-tts
python scripts/generate_audio.py
```

## 目录说明

| 路径 | 作用 |
|------|------|
| `index.html` / `app.js` / `styles.css` | 手机学习界面 |
| `data/corpus.json` | 句库 |
| `audio/` | 美式 Neural TTS |
| `.github/workflows/deploy-pages.yml` | 自动部署 Pages |
| `scripts/` | 抽语料、生成音频 |
