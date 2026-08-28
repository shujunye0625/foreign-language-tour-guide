# 部署 TTS Cloudflare Worker

零预算 Jenny 范读代理，与 `scripts/generate_scenic_audio.py` 同音色参数。

## 前置

- [Cloudflare 账号](https://dash.cloudflare.com/)（免费）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)：`npm i -g wrangler`

## 步骤

```bash
cd worker
wrangler login
wrangler deploy
```

部署成功后记下 URL，例如 `https://guide-tts.<account>.workers.dev`

## 配置前端

编辑 [`app/config.js`](../app/config.js)：

```javascript
export const TTS_WORKER_URL = "https://guide-tts.<account>.workers.dev/tts";
```

## 配置 Origin 白名单

编辑 [`worker/wrangler.toml`](../worker/wrangler.toml) 中 `ALLOWED_ORIGINS`：

```
ALLOWED_ORIGINS = "https://shujunye0625.github.io,http://localhost:8080"
```

## 接口

```
POST /tts
Content-Type: application/json

{ "text": "Good morning.", "voice": "en-US-JennyNeural", "rate": "-5%" }

200 → audio/mpeg
400 → 空文本或超过 1000 字符
403 → Origin 不在白名单
```

> 修改 `worker/tts.js` 中 `MAX_TEXT` 后必须重新 `wrangler deploy`，否则前端已放宽到 1000 时，旧 Worker 仍会拒收 501–1000 字句（范读会降级为系统朗读）。

## 本地测试

```bash
curl -X POST https://guide-tts.<account>.workers.dev/tts \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -d "{\"text\":\"Good morning, everyone.\"}" \
  --output test.mp3
```

验收硬上限（应 200 / 400）：

```bash
# 1000 字符 → 期望 200
python -c "print('a'*1000)" > /tmp/t1000.txt
# 或 PowerShell: ('a'*1000) | Set-Content ... 
```

将 1000 字与 1001 字分别作为 JSON `text` 字段 POST；1001 应返回 400。

## 说明

Worker 通过微软 Edge Read Aloud 端点合成，与 Python `edge-tts` 同源，无需 Azure 付费密钥。
