const WA_BASE = "https://graph.facebook.com/v21.0";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? "";

export interface WATextMessage {
  to: string;
  text: string;
}

export interface WATemplateMessage {
  to: string;
  template: string;
  language?: string;
  components?: unknown[];
}

async function waFetch(path: string, body: unknown) {
  const res = await fetch(`${WA_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }

  return res.json();
}

export async function sendTextMessage({ to, text }: WATextMessage) {
  return waFetch(`/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  });
}

export async function sendTemplateMessage({ to, template, language = "en", components }: WATemplateMessage) {
  return waFetch(`/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: language },
      components,
    },
  });
}

export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const metaRes = await fetch(`${WA_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (!metaRes.ok) throw new Error("Failed to get media URL");
  const { url } = await metaRes.json();

  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (!mediaRes.ok) throw new Error("Failed to download media");
  const buffer = await mediaRes.arrayBuffer();
  return Buffer.from(buffer);
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const crypto = require("crypto");
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  const hash = crypto.createHmac("sha256", appSecret).update(body).digest("hex");
  return signature === `sha256=${hash}`;
}
