import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { db } from "@/lib/db/client";
import { invoices, invoiceLines, organizations } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { InvoicePDF } from "@/lib/pdf/invoice-template";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ORG_ID = "advertout";

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, ORG_ID)))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))
    .orderBy(asc(invoiceLines.sortOrder));

  const [org] = await db
    .select({
      name: organizations.name,
      gstin: organizations.gstin,
      address: organizations.address,
      email: organizations.email,
      phone: organizations.phone,
    })
    .from(organizations)
    .where(eq(organizations.id, ORG_ID))
    .limit(1);

  const pdfBuffer = await renderToBuffer(
    createElement(InvoicePDF, {
      invoice,
      lines,
      org: org ?? { name: "AdvertOut" },
    }) as ReactElement<DocumentProps>,
  );

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
    },
  });
}
