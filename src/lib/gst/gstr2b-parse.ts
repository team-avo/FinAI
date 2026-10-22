/**
 * Parse a GSTR-2B export into normalized inward-supply invoices.
 *
 * Accepts the government's GSTR-2B JSON (walks the `b2b` section, summing
 * item-level tax per invoice) or a plain array of loose records (for uploads
 * that were pre-flattened, and for tests). Tolerant of field-name variants.
 */

export interface Parsed2bEntry {
  supplierGstin: string;
  supplierName?: string;
  invoiceNumber: string;
  invoiceDate?: string; // as-provided (often dd-mm-yyyy); normalized at store time
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}
function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}
function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

function normalizeLoose(rec: unknown): Parsed2bEntry | null {
  const o = asObj(rec);
  const gstin = str(pick(o, ["supplierGstin", "ctin", "gstin"]));
  const inum = str(pick(o, ["invoiceNumber", "inum", "invno", "invoice_number"]));
  if (!gstin || !inum) return null;
  return {
    supplierGstin: gstin,
    supplierName: str(pick(o, ["supplierName", "trdnm", "name"])),
    invoiceNumber: inum,
    invoiceDate: str(pick(o, ["invoiceDate", "dt", "invoice_date", "date"])),
    taxableValue: round2(num(pick(o, ["taxableValue", "txval", "taxable"]))),
    cgst: round2(num(pick(o, ["cgst", "camt"]))),
    sgst: round2(num(pick(o, ["sgst", "samt"]))),
    igst: round2(num(pick(o, ["igst", "iamt"]))),
  };
}

export function parse2b(raw: unknown): Parsed2bEntry[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeLoose).filter((e): e is Parsed2bEntry => e !== null);
  }

  const root = asObj(raw);
  const data = asObj(root.data);
  const docdata = asObj(data.docdata ?? root.docdata);
  const b2bRaw = docdata.b2b ?? data.b2b ?? root.b2b;
  const b2b = Array.isArray(b2bRaw) ? b2bRaw : [];

  const out: Parsed2bEntry[] = [];
  for (const supRaw of b2b) {
    const sup = asObj(supRaw);
    const gstin = str(pick(sup, ["ctin", "gstin"]));
    const name = str(pick(sup, ["trdnm", "cfs", "name"]));
    const invs = Array.isArray(sup.inv) ? sup.inv : [];
    for (const invRaw of invs) {
      const inv = asObj(invRaw);
      const inum = str(pick(inv, ["inum", "invno"]));
      if (!gstin || !inum) continue;

      let tx = 0, c = 0, s = 0, i = 0;
      const itemsRaw = inv.itms ?? inv.items;
      const items = Array.isArray(itemsRaw) ? itemsRaw : [];
      if (items.length) {
        for (const itRaw of items) {
          const it = asObj(itRaw);
          const d = asObj(it.itm_det ?? it);
          tx += num(d.txval);
          c += num(d.camt);
          s += num(d.samt);
          i += num(d.iamt);
        }
      } else {
        tx = num(pick(inv, ["txval"]));
        c = num(pick(inv, ["camt"]));
        s = num(pick(inv, ["samt"]));
        i = num(pick(inv, ["iamt"]));
      }

      out.push({
        supplierGstin: gstin,
        supplierName: name,
        invoiceNumber: inum,
        invoiceDate: str(pick(inv, ["dt"])),
        taxableValue: round2(tx),
        cgst: round2(c),
        sgst: round2(s),
        igst: round2(i),
      });
    }
  }
  return out;
}

/** Parse a date that may be dd-mm-yyyy (GSTN), dd/mm/yyyy, or ISO. */
export function parse2bDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const t = s.trim();
  const dmy = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(t);
  return Number.isNaN(iso.getTime()) ? null : iso;
}
