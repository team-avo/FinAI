import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";

// Styles
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  companyBlock: { flexDirection: "column", gap: 2 },
  companyName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#09090b" },
  companyDetail: { fontSize: 9, color: "#71717a", lineHeight: 1.5 },
  invoiceLabel: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#09090b" },
  invoiceNumber: { fontSize: 12, color: "#71717a", textAlign: "right" },

  // Meta row
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  metaBlock: { flexDirection: "column", gap: 4 },
  metaTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  metaValue: { fontSize: 10, color: "#09090b" },
  metaSubValue: { fontSize: 9, color: "#52525b" },

  // Table
  table: { marginBottom: 24 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  tableHeaderCell: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#71717a", textTransform: "uppercase" },
  tableCell: { fontSize: 10, color: "#09090b" },
  col_desc: { flex: 4 },
  col_hsn: { flex: 1.5 },
  col_qty: { flex: 1, textAlign: "right" },
  col_rate: { flex: 1.5, textAlign: "right" },
  col_tax: { flex: 1, textAlign: "right" },
  col_amount: { flex: 1.5, textAlign: "right" },

  // Totals
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 32,
  },
  totalsBox: {
    width: 220,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  totalLabel: { fontSize: 9, color: "#71717a" },
  totalValue: { fontSize: 9, color: "#09090b", fontFamily: "Helvetica-Bold" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: "#09090b",
  },
  grandTotalLabel: { fontSize: 10, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  grandTotalValue: { fontSize: 10, color: "#d4ff00", fontFamily: "Helvetica-Bold" },

  // GST breakdown
  gstSection: { marginBottom: 24 },
  gstTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  gstTable: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 },
  gstRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  gstCell: { flex: 1, fontSize: 9, color: "#52525b" },
  gstHeaderCell: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold", color: "#71717a" },

  // Notes & footer
  notes: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: "#d4ff00",
  },
  notesLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#71717a", marginBottom: 4 },
  notesText: { fontSize: 9, color: "#52525b", lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
  },
  footerText: { fontSize: 8, color: "#a1a1aa" },
});

function formatINR(val: number) {
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface InvoicePDFProps {
  invoice: {
    id: string;
    number: string;
    contactName: string;
    contactEmail?: string | null;
    contactGstin?: string | null;
    billingAddress?: string | null;
    issueDate: Date;
    dueDate?: Date | null;
    status: string;
    subtotal: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalTax: string;
    total: string;
    amountPaid: string;
    amountDue: string;
    notes?: string | null;
    isInterstate?: number | null;
  };
  lines: Array<{
    id: string;
    description: string;
    hsnCode?: string | null;
    quantity: string;
    rate: string;
    taxRate: string;
    cgstRate: string;
    sgstRate: string;
    igstRate: string;
    taxAmount: string;
    amount: string;
  }>;
  org: {
    name: string;
    gstin?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

export function InvoicePDF({ invoice, lines, org }: InvoicePDFProps) {
  const subtotal = parseFloat(invoice.subtotal);
  const cgst = parseFloat(invoice.cgstAmount);
  const sgst = parseFloat(invoice.sgstAmount);
  const igst = parseFloat(invoice.igstAmount);
  const total = parseFloat(invoice.total);
  const amountPaid = parseFloat(invoice.amountPaid);
  const amountDue = parseFloat(invoice.amountDue);
  const interstate = (invoice.isInterstate ?? 0) === 1;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{org.name}</Text>
            {org.gstin && <Text style={styles.companyDetail}>GSTIN: {org.gstin}</Text>}
            {org.address && <Text style={styles.companyDetail}>{org.address}</Text>}
            {org.email && <Text style={styles.companyDetail}>{org.email}</Text>}
            {org.phone && <Text style={styles.companyDetail}>{org.phone}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
          </View>
        </View>

        {/* Bill To + Dates */}
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaTitle}>Bill To</Text>
            <Text style={styles.metaValue}>{invoice.contactName}</Text>
            {invoice.contactGstin && <Text style={styles.metaSubValue}>GSTIN: {invoice.contactGstin}</Text>}
            {invoice.contactEmail && <Text style={styles.metaSubValue}>{invoice.contactEmail}</Text>}
            {invoice.billingAddress && <Text style={styles.metaSubValue}>{invoice.billingAddress}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaTitle}>Invoice Date</Text>
            <Text style={styles.metaValue}>{format(invoice.issueDate, "dd MMM yyyy")}</Text>
          </View>
          {invoice.dueDate && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaTitle}>Due Date</Text>
              <Text style={styles.metaValue}>{format(invoice.dueDate, "dd MMM yyyy")}</Text>
            </View>
          )}
          <View style={styles.metaBlock}>
            <Text style={styles.metaTitle}>Status</Text>
            <Text style={styles.metaValue}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.col_desc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.col_hsn]}>HSN/SAC</Text>
            <Text style={[styles.tableHeaderCell, styles.col_qty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.col_rate]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.col_tax]}>GST%</Text>
            <Text style={[styles.tableHeaderCell, styles.col_amount]}>Amount</Text>
          </View>
          {lines.map((line, i) => (
            <View key={line.id} style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: "#fafafa" } : {}]}>
              <Text style={[styles.tableCell, styles.col_desc]}>{line.description}</Text>
              <Text style={[styles.tableCell, styles.col_hsn]}>{line.hsnCode ?? "-"}</Text>
              <Text style={[styles.tableCell, styles.col_qty]}>{line.quantity}</Text>
              <Text style={[styles.tableCell, styles.col_rate]}>{formatINR(parseFloat(line.rate))}</Text>
              <Text style={[styles.tableCell, styles.col_tax]}>{line.taxRate}%</Text>
              <Text style={[styles.tableCell, styles.col_amount]}>{formatINR(parseFloat(line.amount))}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatINR(subtotal)}</Text>
            </View>
            {!interstate && cgst > 0 && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>CGST</Text>
                  <Text style={styles.totalValue}>{formatINR(cgst)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>SGST</Text>
                  <Text style={styles.totalValue}>{formatINR(sgst)}</Text>
                </View>
              </>
            )}
            {interstate && igst > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>IGST</Text>
                <Text style={styles.totalValue}>{formatINR(igst)}</Text>
              </View>
            )}
            {amountPaid > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Amount Paid</Text>
                <Text style={styles.totalValue}>-{formatINR(amountPaid)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>
                {amountPaid > 0 ? "Balance Due" : "Total Due"}
              </Text>
              <Text style={styles.grandTotalValue}>
                {formatINR(amountPaid > 0 ? amountDue : total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by FinAI · {org.name}</Text>
          <Text style={styles.footerText}>{invoice.number}</Text>
        </View>
      </Page>
    </Document>
  );
}
