# 导游英语影子跟读（手机 PWA）

广东导游资格考试英语口试 · 100LS 影子跟读，专为通勤手机练习。

部署成功后地址：

`https://shujunye0625.github.io/foreign-language-tour-guideguide-/`

## 推送到你的仓库（若尚未推送）

```powershell
cd c:\Users\Administrator.DESKTOP-TSASORM\Desktop\tour
git remote add origin https://github.com/shujunye0625/foreign-language-tour-guideguide-.git
git push -u origin main
```

（若已添加过 `origin`，跳过 `remote add`，直接 `git push -u origin main`。）

推送时会弹出 GitHub 登录；用浏览器登录或 Personal Access Token 即可。

然后：仓库 → **Settings** → **Pages** → Source 选 **GitHub Actions**。

手机打开：`https://shujunye0625.github.io/foreign-language-tour-guideguide-/`

## 第一次发布到 GitHub（你只需做一次）

### 1. 安装并登录 GitHub CLI（若尚未登录）

```powershell
gh auth login
```

### 2. 在本项目目录创建仓库并推送

本仓库已指向：`shujunye0625/foreign-language-tour-guideguide-`

```powershell
cd c:\Users\Administrator.DESKTOP-TSASORM\Desktop\tour
git push -u origin main
```

### 3. 打开 GitHub Pages

1. 打开仓库 → **Settings** → **Pages**  
2. **Source** 选 **GitHub Actions**  
3. 推送 `main` 后会自动跑工作流 `Deploy GitHub Pages`  
4. 几分钟后访问：`https://shujunye0625.github.io/foreign-language-tour-guideguide-/`  

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
