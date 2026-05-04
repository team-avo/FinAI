import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export interface ParsedBill {
  vendorName?: string;
  date?: string;
  amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalAmount?: number;
  invoiceNumber?: string;
  gstin?: string;
  confidence: "high" | "medium" | "low";
  rawText?: string;
}

const SYSTEM_PROMPT = `You are an expert at extracting structured data from Indian bills, receipts, and invoices.
Extract the following fields if present:
- vendorName: name of the seller/vendor
- date: date of the bill in YYYY-MM-DD format
- amount: base amount before tax (number)
- cgst: CGST amount if present (number)
- sgst: SGST amount if present (number)
- igst: IGST amount if present (number)
- totalAmount: final total amount including all taxes (number)
- invoiceNumber: bill/invoice number if present
- gstin: GSTIN of the vendor if present
- confidence: "high" if you are confident about most fields, "medium" if some fields are uncertain, "low" if the image quality is poor

Return ONLY valid JSON. Do not include markdown code blocks. Example:
{"vendorName":"Swiggy","date":"2025-01-15","amount":450.00,"cgst":0,"sgst":0,"igst":0,"totalAmount":450.00,"invoiceNumber":"SW123456","confidence":"high"}`;

export async function parseBillFromBase64(
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
): Promise<ParsedBill> {
  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: `data:${mediaType};base64,${base64Image}`,
          },
          {
            type: "text",
            text: "Extract the billing information from this image as JSON.",
          },
        ],
      },
    ],
  });

  try {
    const parsed = JSON.parse(text.trim());
    return {
      vendorName: parsed.vendorName,
      date: parsed.date,
      amount: parsed.amount ? Number(parsed.amount) : undefined,
      cgst: parsed.cgst ? Number(parsed.cgst) : undefined,
      sgst: parsed.sgst ? Number(parsed.sgst) : undefined,
      igst: parsed.igst ? Number(parsed.igst) : undefined,
      totalAmount: parsed.totalAmount ? Number(parsed.totalAmount) : undefined,
      invoiceNumber: parsed.invoiceNumber,
      gstin: parsed.gstin,
      confidence: parsed.confidence ?? "low",
      rawText: text,
    };
  } catch {
    return {
      confidence: "low",
      rawText: text,
    };
  }
}

export async function parseBillFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedBill> {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!supportedTypes.includes(mimeType)) {
    return { confidence: "low", rawText: "Unsupported file type" };
  }

  const base64 = buffer.toString("base64");
  return parseBillFromBase64(base64, mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif");
}
