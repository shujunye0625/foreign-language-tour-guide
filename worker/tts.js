/**
 * Cloudflare Worker — Edge TTS (Jenny) proxy
 * POST /tts { text, voice?, rate? } -> audio/mpeg
 */

const TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const DEFAULT_VOICE = "en-US-JennyNeural";
const DEFAULT_RATE = "-5%";
const MAX_TEXT = 500;

function corsHeaders(origin, allowed) {
  const h = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (allowed.includes(origin) || allowed.includes("*")) {
    h["Access-Control-Allow-Origin"] = origin || "*";
  }
  return h;
}

function isAllowed(origin, env) {
  const list = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) {
    return (
      !origin ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("github.io")
    );
  }
  return list.some((o) => origin === o || origin.startsWith(o));
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSsml(text, voice, rate) {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice></speak>`;
}

async function synthesize(text, voice, rate) {
  const ssml = buildSsml(text, voice, rate);
  const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edges/v1?TrustedClientToken=${TRUSTED_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  return res.arrayBuffer();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!isAllowed(origin, env)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { headers: corsHeaders(origin, [origin]) });
    }

    if (url.pathname !== "/tts" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    if (!isAllowed(origin, env)) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders(origin, []) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders(origin, [origin]) });
    }

    const text = (body.text || "").trim();
    if (!text) {
      return new Response("Empty text", { status: 400, headers: corsHeaders(origin, [origin]) });
    }
    if (text.length > MAX_TEXT) {
      return new Response("Text too long", { status: 400, headers: corsHeaders(origin, [origin]) });
    }

    const voice = body.voice || DEFAULT_VOICE;
    const rate = body.rate || DEFAULT_RATE;

    try {
      const audio = await synthesize(text, voice, rate);
      return new Response(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          ...corsHeaders(origin, [origin]),
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return new Response("TTS failed", { status: 502, headers: corsHeaders(origin, [origin]) });
    }
  },
};
