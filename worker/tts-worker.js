/**
 * Cloudflare Worker - Edge TTS Proxy
 * 
 * Provides text-to-speech using Microsoft Edge TTS API.
 * Free, unlimited, neural voice quality.
 * 
 * Usage:
 *   GET /tts?text=Hello&voice=en-US-AriaNeural
 *   
 * Returns: audio/mp3
 */

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

const VOICES = {
    // US English
    "en-US-AriaNeural": { lang: "en-US", gender: "Female" },
    "en-US-GuyNeural": { lang: "en-US", gender: "Male" },
    "en-US-JennyNeural": { lang: "en-US", gender: "Female" },
    "en-US-ChristopherNeural": { lang: "en-US", gender: "Male" },
    // UK English
    "en-GB-SoniaNeural": { lang: "en-GB", gender: "Female" },
    "en-GB-RyanNeural": { lang: "en-GB", gender: "Male" },
    // Australian English
    "en-AU-NatashaNeural": { lang: "en-AU", gender: "Female" },
    "en-AU-WilliamNeural": { lang: "en-AU", gender: "Male" },
};

function generateRequestId() {
    return crypto.randomUUID().replace(/-/g, "");
}

function escapeXml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildSSML(text, voice, rate = 0, pitch = 0) {
    const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`;
    const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${VOICES[voice]?.lang || 'en-US'}">
    <voice name="${voice}">
      <prosody rate="${rateStr}" pitch="${pitchStr}">
        ${escapeXml(text)}
      </prosody>
    </voice>
  </speak>`;
}

async function synthesizeSpeech(text, voice, rate = 0, pitch = 0) {
    return new Promise((resolve, reject) => {
        const requestId = generateRequestId();
        const timestamp = new Date().toISOString();

        const ws = new WebSocket(WSS_URL);
        const audioChunks = [];
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                ws.close();
                reject(new Error("TTS timeout"));
            }
        }, 30000);

        ws.onopen = () => {
            // Send config
            ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{
        "context": {
          "synthesis": {
            "audio": {
              "metadataoptions": { "sentenceBoundaryEnabled": false, "wordBoundaryEnabled": false },
              "outputFormat": "audio-24khz-48kbitrate-mono-mp3"
            }
          }
        }
      }`);

            // Send SSML request
            const ssml = buildSSML(text, voice, rate, pitch);
            ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`);
        };

        ws.onmessage = (event) => {
            if (typeof event.data === "string") {
                if (event.data.includes("Path:turn.end")) {
                    clearTimeout(timeout);
                    resolved = true;
                    ws.close();

                    // Combine audio chunks
                    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const result = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of audioChunks) {
                        result.set(chunk, offset);
                        offset += chunk.length;
                    }

                    resolve(result);
                }
            } else if (event.data instanceof ArrayBuffer) {
                // Binary audio data
                const data = new Uint8Array(event.data);
                // Find "Path:audio" header end
                const headerEnd = findHeaderEnd(data);
                if (headerEnd > 0) {
                    audioChunks.push(data.slice(headerEnd));
                }
            }
        };

        ws.onerror = (error) => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                reject(error);
            }
        };

        ws.onclose = () => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                reject(new Error("WebSocket closed unexpectedly"));
            }
        };
    });
}

function findHeaderEnd(data) {
    // Look for double CRLF indicating end of headers
    for (let i = 0; i < data.length - 3; i++) {
        if (data[i] === 13 && data[i + 1] === 10 && data[i + 2] === 13 && data[i + 3] === 10) {
            return i + 4;
        }
    }
    // Alternative: look for "Path:audio\r\n"
    const str = new TextDecoder().decode(data.slice(0, Math.min(200, data.length)));
    const match = str.match(/Path:audio\r\n/);
    if (match) {
        return match.index + match[0].length + 2; // +2 for additional CRLF
    }
    return -1;
}

export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        const url = new URL(request.url);

        // Health check
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", voices: Object.keys(VOICES) }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        // TTS endpoint
        if (url.pathname === "/tts") {
            const text = url.searchParams.get("text");
            const voice = url.searchParams.get("voice") || "en-US-AriaNeural";
            const rate = parseInt(url.searchParams.get("rate") || "0");
            const pitch = parseInt(url.searchParams.get("pitch") || "0");

            if (!text) {
                return new Response(JSON.stringify({ error: "Missing 'text' parameter" }), {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }

            if (!VOICES[voice]) {
                return new Response(JSON.stringify({
                    error: `Unknown voice: ${voice}`,
                    available: Object.keys(VOICES)
                }), {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }

            try {
                const audio = await synthesizeSpeech(text, voice, rate, pitch);

                return new Response(audio, {
                    headers: {
                        "Content-Type": "audio/mpeg",
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=86400", // Cache for 24h
                    },
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }
        }

        // Default response
        return new Response(JSON.stringify({
            name: "Edge TTS Worker",
            endpoints: {
                "/tts": "GET ?text=Hello&voice=en-US-AriaNeural",
                "/health": "GET - Health check and voice list"
            }
        }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    },
};
