---
name: inworld-tts
description: "Detailed description on how to integrate with in-world tts apis"
---


# Integrate Inworld Text-to-Speech (TTS)

You are helping the user integrate Inworld's Text-to-Speech API into their project. Walk them through the process interactively.

## Step 1: API Key

Ask the user if they already have an Inworld API key. If not, offer them these options:

### Option A: Inworld Portal (manual)
1. Go to https://platform.inworld.ai/api-keys (sign up or sign in if needed)
2. Click "Generate new key" and copy the "Basic (Base64)" authorization key

### Option B: Inworld CLI (recommended for developers)
Install the CLI and authenticate:
```bash
npm install -g @inworld/cli
inworld auth login
```
This opens the browser for OAuth login. After login completes, retrieve the API key:
```bash
inworld auth print-api-key
```

### Set the API key
```bash
export INWORLD_API_KEY='<base64-key-here>'
```

All Inworld APIs authenticate via `Authorization: Basic <key>` header.

## Step 2: Choose TTS approach

Ask the user what kind of TTS integration they need:

1. **Synchronous** — simple request/response, returns complete audio. Good for pre-rendering, batch processing.
2. **HTTP Streaming** — progressive audio delivery, low TTFB. Good for real-time playback.
3. **WebSocket** — persistent connection, lowest latency for repeated synthesis. Good for conversational apps.

## Step 3: Integrate

### Endpoints

- Sync: `POST https://api.inworld.ai/tts/v1/voice`
- Streaming: `POST https://api.inworld.ai/tts/v1/voice:stream`
- WebSocket: `wss://api.inworld.ai/tts/v1/voice:streamBidirectional`

### Synchronous TTS

```bash
curl -X POST https://api.inworld.ai/tts/v1/voice \
  -H "Authorization: Basic $INWORLD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test.",
    "voice_id": "Ashley",
    "model_id": "inworld-tts-2"
  }'
```

**Response:** `{ "audioContent": "<base64-encoded-audio>" }`

Decode base64 `audioContent` to get binary audio (WAV with LINEAR16, or MP3 depending on config).

### Node.js — Synchronous

```javascript
const response = await fetch("https://api.inworld.ai/tts/v1/voice", {
  method: "POST",
  headers: {
    Authorization: `Basic ${process.env.INWORLD_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: "Hello, this is a test.",
    voice_id: "Ashley",
    model_id: "inworld-tts-2",
    audio_config: {
      audio_encoding: "LINEAR16",
      sample_rate_hertz: 48000,
    },
  }),
});

const { audioContent } = await response.json();
const audioBuffer = Buffer.from(audioContent, "base64");
```

### HTTP Streaming (low latency)

Add `Connection: keep-alive` header to reuse TCP+TLS connections. Response is newline-delimited JSON chunks with audio fragments.

```javascript
const response = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
  method: "POST",
  headers: {
    Authorization: `Basic ${process.env.INWORLD_API_KEY}`,
    "Content-Type": "application/json",
    Connection: "keep-alive",
  },
  body: JSON.stringify({
    text: "Hello, this is a test.",
    voice_id: "Ashley",
    model_id: "inworld-tts-2",
    audio_config: {
      audio_encoding: "MP3",
      sample_rate_hertz: 48000,
    },
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = JSON.parse(decoder.decode(value));
  const audio = Buffer.from(chunk.audioContent, "base64");
  // Play or buffer audio chunk...
}
```

### WebSocket TTS

```javascript
import WebSocket from "ws";

const ws = new WebSocket("wss://api.inworld.ai/tts/v1/voice:streamBidirectional", {
  headers: { Authorization: `Basic ${process.env.INWORLD_API_KEY}` },
});

ws.on("open", () => {
  ws.send(JSON.stringify({
    text: "Hello, this is a test.",
    voice_id: "Ashley",
    model_id: "inworld-tts-2",
    audio_config: { audio_encoding: "LINEAR16", sample_rate_hertz: 48000 },
  }));
});

ws.on("message", (data) => {
  const { audioContent } = JSON.parse(data.toString());
  const audio = Buffer.from(audioContent, "base64");
  // Play audio chunk...
});
```

### Key parameters

| Parameter | Description | Examples |
|-----------|-------------|---------|
| `text` | Content to synthesize | any string |
| `voice_id` | Voice identifier | "Ashley", "Dennis", "Sarah", "Hana", "Blake", "Luna" |
| `model_id` | TTS model | "inworld-tts-2" |
| `audio_config.audio_encoding` | Output format | "LINEAR16", "MP3" |
| `audio_config.sample_rate_hertz` | Sample rate | 48000, 24000, 16000 |
| `timestamp_type` | Enable timing data | "WORD" (returns word timestamps, phonemes, visemes) |

### Word timestamps and lip-sync

Add `"timestamp_type": "WORD"` to the request to get per-word timing, phoneme data, and viseme symbols for lip-sync animation.

### Voice cloning

Clone a voice from audio samples:
```
POST https://api.inworld.ai/voices/v1/voices:clone
```

### Voice design

Design a voice from text description (no audio required):
```
POST https://api.inworld.ai/voices/v1/voices:design
```

### Long text handling

For long text, chunk at natural sentence boundaries and synthesize each chunk. The API examples repo demonstrates this pattern with splice point handling.

## Important notes

- First request incurs TCP/TLS overhead; subsequent requests with `Connection: keep-alive` are faster.
- For streaming, skip the 44-byte WAV header in subsequent chunks when using LINEAR16.
- OUTPUT: WAV (LINEAR16) is lossless and best for quality; MP3 is smaller for streaming.

## References

- Quickstart: https://docs.inworld.ai/quickstart-tts
- API reference — Synthesize speech: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech
- API reference — Streaming: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech-stream
- API reference — WebSocket: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech-websocket
- API reference — List voices: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/list-voices
- Voice API — Clone: https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/clone-voice
- Voice API — Design: https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/design-voice
- Code examples (JS): https://github.com/inworld-ai/inworld-api-examples/tree/main/tts/js
- Code examples (Python): https://github.com/inworld-ai/inworld-api-examples/tree/main/tts/python
- TTS Playground: https://platform.inworld.ai/tts-playground
- Full docs index (for AI tools): https://inworld.ai/llms.txt
