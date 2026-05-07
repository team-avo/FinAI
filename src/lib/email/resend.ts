import { Resend } from "resend";

// Lazy init so the module doesn't crash at import time when the env is
// missing (dev without .env.local, build prerender steps, etc.).
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured — cannot send email.");
  }
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "FinAI <noreply@finai.advertout.in>";

export async function sendInvoiceEmail({
  to,
  contactName,
  invoiceNumber,
  amount,
  dueDate,
  pdfBuffer,
}: {
  to: string;
  contactName: string;
  invoiceNumber: string;
  amount: string;
  dueDate?: string;
  pdfBuffer?: Buffer;
}) {
  const attachments = pdfBuffer
    ? [
        {
          filename: `${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ]
    : undefined;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Invoice ${invoiceNumber} from AdvertOut`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px;">Invoice ${invoiceNumber}</h2>
        <p style="font-size: 14px; color: #555;">Dear ${contactName},</p>
        <p style="font-size: 14px; color: #555;">
          Please find your invoice attached. The total amount due is <strong>${amount}</strong>
          ${dueDate ? ` due by <strong>${dueDate}</strong>` : ""}.
        </p>
        <p style="font-size: 14px; color: #555;">
          For any queries, please reply to this email.
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 32px;">
          Powered by FinAI — AdvertOut
        </p>
      </div>
    `,
    attachments,
  });
}

export async function sendMagicLinkEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "Sign in to FinAI",
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px;">Sign in to FinAI</h2>
        <p style="font-size: 14px; color: #555;">Click the link below to sign in:</p>
        <a
          href="${url}"
          style="display: inline-block; background: #d4ff00; color: #000; font-weight: 600; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin: 16px 0;"
        >
          Sign in to FinAI
        </a>
        <p style="font-size: 12px; color: #999;">
          This link expires in 15 minutes. If you didn't request this, you can ignore this email.
        </p>
      </div>
    `,
  });
}
