const GROQ_BASE = "https://api.groq.com/openai/v1";

/** Map an incoming audio MIME type to a filename extension Whisper accepts. */
function extFor(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("ogg")) return "ogg";
  if (m.includes("webm")) return "webm";
  if (m.includes("wav")) return "wav";
  if (m.includes("m4a") || m.includes("mp4") || m.includes("aac")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3") || m.includes("mpga")) return "mp3";
  return "ogg"; // WhatsApp voice notes are OGG/Opus
}

/**
 * Transcribe an audio buffer (e.g. a WhatsApp voice note) to text using Groq's
 * OpenAI-compatible Whisper endpoint. Language is auto-detected, so Hindi and
 * code-mixed "Hinglish" voice notes work. Throws on an API error.
 */
export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const cleanType = mimeType.split(";")[0]?.trim() || "audio/ogg";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: cleanType }), `audio.${extFor(mimeType)}`);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "text");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Groq transcription error (${res.status}): ${await res.text()}`);
  }
  return (await res.text()).trim();
}
