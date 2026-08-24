# 导游英语影子跟读（手机 PWA）

广东导游资格考试英语口试 · 100LS 影子跟读，专为通勤手机练习。

**免费托管在 GitHub Pages，不需要自己买服务器。**

## 用手机流量打开（GitHub Pages）

部署成功后地址类似：

`https://你的用户名.github.io/仓库名/`

1. 用手机浏览器（流量或 WiFi）打开上面的链接  
2. **添加到主屏幕**  
3. 先把「丹霞问答」「欢迎辞」每句播放一遍（写入离线缓存）  
4. 通勤时可离线听跟读；没缓存的句子需流量在线加载  

## 第一次发布到 GitHub（你只需做一次）

### 1. 安装并登录 GitHub CLI（若尚未登录）

```powershell
gh auth login
```

### 2. 在本项目目录创建仓库并推送

```powershell
cd c:\Users\Administrator.DESKTOP-TSASORM\Desktop\tour
git init
git add .
git commit -m "Initial commit: guide English shadow reading PWA"
gh repo create gd-guide-shadow --public --source=. --remote=origin --push
```

仓库名可改，例如 `gd-guide-shadow`。

### 3. 打开 GitHub Pages

1. 打开仓库 → **Settings** → **Pages**  
2. **Source** 选 **GitHub Actions**  
3. 推送 `main` 后会自动跑工作流 `Deploy GitHub Pages`  
4. 几分钟后在 Settings → Pages 看到访问地址  

也可：仓库 → **Actions** 里手动点 **Run workflow**。

### 4. 手机验证

用流量打开 Pages 地址 → 加到主屏幕 → 练丹霞/欢迎辞。

## 本地预览（可选）

```powershell
cd c:\Users\Administrator.DESKTOP-TSASORM\Desktop\tour
python -m http.server 8080
```

浏览器打开 `http://127.0.0.1:8080/`

## 生成更多美音音频

```powershell
pip install edge-tts
python scripts/generate_audio.py
```

无 MP3 时会回退系统 en-US 语音。

## 目录说明

| 路径 | 作用 |
|------|------|
| `index.html` / `app.js` / `styles.css` | 手机学习界面 |
| `data/corpus.json` | 句库 |
| `audio/` | 美式 Neural TTS |
| `.github/workflows/deploy-pages.yml` | 推送后自动部署 Pages |
| `scripts/` | 抽语料、生成音频 |

白皮书 PDF 默认不上传（见 `.gitignore`），只留在你电脑上。
