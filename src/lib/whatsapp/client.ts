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

export interface WADocumentMessage {
  to: string;
  /** Media id from {@link uploadMedia}. */
  mediaId: string;
  /** Filename shown to the recipient (e.g. "Invoice-INV-0042.pdf"). */
  filename: string;
  /** Optional caption shown with the document. */
  caption?: string;
}

/** One interactive reply button. The `id` is echoed back in the webhook when tapped. */
export interface WAReplyButton {
  /** Stable id (≤256 chars) returned verbatim in the inbound reply — encode what it approves. */
  id: string;
  /** Button label the user sees (≤20 chars). */
  title: string;
}

export interface WAButtonMessage {
  to: string;
  /** Prompt text above the buttons (≤1024 chars). */
  body: string;
  /** 1–3 reply buttons. */
  buttons: WAReplyButton[];
  /** Optional short header text. */
  header?: string;
  /** Optional footer text. */
  footer?: string;
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

export async function sendTemplateMessage({
  to,
  template,
  language = "en",
  components,
}: WATemplateMessage) {
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

/**
 * Upload a file to WhatsApp's media store and return its media id. Unlike the
 * JSON message endpoints this is a multipart/form-data POST, so it bypasses
 * `waFetch`. The returned id can be sent with {@link sendDocument} and is valid
 * for ~30 days. Used to push the Zoho invoice PDF to the user for approval.
 */
export async function uploadMedia(
  file: Buffer,
  opts: { filename: string; mimeType?: string },
): Promise<string> {
  const mimeType = opts.mimeType ?? "application/pdf";

  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", mimeType);
  form.set("file", new Blob([new Uint8Array(file)], { type: mimeType }), opts.filename);

  const res = await fetch(`${WA_BASE}/${PHONE_ID}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`WhatsApp media upload failed: ${error}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error(`WhatsApp media upload returned no id: ${JSON.stringify(data)}`);
  }
  return data.id;
}

/** Send a previously-uploaded document (by media id) to the recipient. */
export async function sendDocument({ to, mediaId, filename, caption }: WADocumentMessage) {
  return waFetch(`/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "document",
    document: { id: mediaId, filename, caption },
  });
}

/**
 * Send an interactive message with up to 3 reply buttons (e.g. Approve / Reject).
 * When the user taps one, the webhook receives an `interactive.button_reply`
 * whose `id` is the button's `id` here — that's how the approval resolver maps a
 * tap back to the pending invoice.
 */
export async function sendApprovalButtons({ to, body, buttons, header, footer }: WAButtonMessage) {
  if (buttons.length < 1 || buttons.length > 3) {
    throw new Error(`WhatsApp reply buttons must be 1–3 (got ${buttons.length}).`);
  }
  for (const b of buttons) {
    if (b.title.length > 20) {
      throw new Error(`WhatsApp button title too long (≤20): "${b.title}".`);
    }
    if (b.id.length > 256) {
      throw new Error(`WhatsApp button id too long (≤256): "${b.id}".`);
    }
  }

  return waFetch(`/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(header ? { header: { type: "text", text: header } } : {}),
      body: { text: body },
      ...(footer ? { footer: { text: footer } } : {}),
      action: {
        buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
      },
    },
  });
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const crypto = require("crypto");
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  const hash = crypto.createHmac("sha256", appSecret).update(body).digest("hex");
  return signature === `sha256=${hash}`;
}
