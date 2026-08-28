# 用户稿子（我的稿子）

第二期功能：导游可粘贴自己的讲解词，在本机保存文本与 Jenny 范读 MP3，用与官方五景点相同的阅读器听跟练习。

## 隐私

- 稿子全文与 MP3 **只存在本机** IndexedDB（`guide-user-v1`）
- Cloudflare Worker **仅接收单句英文**做 TTS，不保存用户内容
- 数据不会进入 Git 仓库

## 限额

| 项目 | 数值 |
|------|------|
| 最少句数 | 3 |
| 最多句数 | 200（口试单篇建议 25–45，超过 150 句会提示较长） |
| 单句英文硬上限 | **1000** 字符（与 TTS Worker 对齐；超过无法保存） |
| 单句英文软提示 | **280** 字符（偏长，跟读较吃力，仍可保存） |
| 本机最多篇数 | 100 |

粘贴解析：优先按英文真句边界（`.?!` + 大写起句，并保护 `Dr.` / `U.S.` / 小数等）；仅当单条仍超过 1000 时二次按分号/从句标记/空格软切。预览可「拆开此句」。

## 配置 Worker URL

部署 Worker 后，编辑 [`app/config.js`](../app/config.js)：

```javascript
export const TTS_WORKER_URL = "https://guide-tts.<account>.workers.dev/tts";
```

留空则全部使用浏览器系统朗读（`speechSynthesis`）。

## 粘贴模板

1. **一句英一句中**（默认）：奇数行英文、偶数行中文
2. **纯英文**：按英文句号与换行拆句；超过 1000 字符自动二次拆开

## 数据模型

- IndexedDB `guide-user-v1`：stores `guides`（元数据+句子）、`audio`（MP3 Blob）
- localStorage `lastUserGuide`：续练句位
- sentenceId：`user-{uuid}-s01` … 计入今日统计

## 备份与换机

- **导出**：首页稿子卡片 →「导出」。默认仅文本 JSON（推荐换机）；可选含范读音频（文件较大，需二次确认）。
- **导入**：首页「从 JSON 导入」。导入后可选择是否重新生成范读；取消则立即可用系统朗读。
- Schema：`guide-backup-v1`（见 `app/guide-backup.js`）

## 容量提示

- 首页显示本机篇数与范读音频占用（MB）
- 超过 **80 MB** 黄色提示，超过 **150 MB** 红色提示
- 空间不足时会 toast 提示，请先导出备份并删除旧稿

## 国内网络说明

- Jenny 范读经 Cloudflare Worker 合成；`workers.dev` 在国内可能超时
- 单句 **15 秒**超时后自动降级为系统朗读，不影响保存与练习
- 首次使用系统朗读时会提示一次

