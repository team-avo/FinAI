import { NextRequest, NextResponse } from "next/server";
import { parseBillFromBuffer } from "@/lib/ocr/bill-parser";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseBillFromBuffer(buffer, file.type);

    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR error:", error);
    const body: Record<string, unknown> = { error: "OCR processing failed" };
    // Temporary, gated diagnostic (?diag=1) to root-cause a prod failure.
    if (req.nextUrl.searchParams.get("diag") === "1") {
      body.detail = String(error).slice(0, 400);
      body.env = {
        GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
      };
    }
    return NextResponse.json(body, { status: 500 });
  }
}
