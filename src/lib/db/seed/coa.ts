/**
 * Default Chart of Accounts for an India-based service business.
 * Uses a structured 4-digit code system aligned with Indian accounting standards.
 */

export interface CoAEntry {
  code: string;
  name: string;
  type: "asset" | "liability" | "income" | "expense" | "equity";
  parentCode?: string;
  isSystem: boolean;
}

export const DEFAULT_COA: CoAEntry[] = [
  // ── ASSETS ────────────────────────────────────────────────────────────
  { code: "1000", name: "Current Assets", type: "asset", isSystem: true },
  { code: "1100", name: "Cash & Bank", type: "asset", parentCode: "1000", isSystem: true },
  { code: "1110", name: "Cash in Hand", type: "asset", parentCode: "1100", isSystem: true },
  { code: "1120", name: "Bank Account", type: "asset", parentCode: "1100", isSystem: true },
  { code: "1130", name: "Petty Cash", type: "asset", parentCode: "1100", isSystem: false },
  { code: "1200", name: "Accounts Receivable", type: "asset", parentCode: "1000", isSystem: true },
  { code: "1300", name: "Advance Payments", type: "asset", parentCode: "1000", isSystem: false },
  { code: "1400", name: "Loans & Advances (Given)", type: "asset", parentCode: "1000", isSystem: false },
  { code: "1500", name: "Input Tax Credit (GST)", type: "asset", parentCode: "1000", isSystem: true },
  { code: "1510", name: "CGST Input Credit", type: "asset", parentCode: "1500", isSystem: true },
  { code: "1520", name: "SGST Input Credit", type: "asset", parentCode: "1500", isSystem: true },
  { code: "1530", name: "IGST Input Credit", type: "asset", parentCode: "1500", isSystem: true },
  { code: "1600", name: "Prepaid Expenses", type: "asset", parentCode: "1000", isSystem: false },
  { code: "1900", name: "Fixed Assets", type: "asset", isSystem: false },
  { code: "1910", name: "Computer & Equipment", type: "asset", parentCode: "1900", isSystem: false },
  { code: "1920", name: "Furniture & Fixtures", type: "asset", parentCode: "1900", isSystem: false },

  // ── LIABILITIES ───────────────────────────────────────────────────────
  { code: "2000", name: "Current Liabilities", type: "liability", isSystem: true },
  { code: "2100", name: "Accounts Payable", type: "liability", parentCode: "2000", isSystem: true },
  { code: "2200", name: "GST Payable", type: "liability", parentCode: "2000", isSystem: true },
  { code: "2210", name: "CGST Payable", type: "liability", parentCode: "2200", isSystem: true },
  { code: "2220", name: "SGST Payable", type: "liability", parentCode: "2200", isSystem: true },
  { code: "2230", name: "IGST Payable", type: "liability", parentCode: "2200", isSystem: true },
  { code: "2300", name: "TDS Payable", type: "liability", parentCode: "2000", isSystem: false },
  { code: "2400", name: "Salary Payable", type: "liability", parentCode: "2000", isSystem: false },
  { code: "2500", name: "Advance from Customers", type: "liability", parentCode: "2000", isSystem: false },
  { code: "2600", name: "Short-term Loans", type: "liability", parentCode: "2000", isSystem: false },
  { code: "2900", name: "Long-term Liabilities", type: "liability", isSystem: false },
  { code: "2910", name: "Long-term Loans", type: "liability", parentCode: "2900", isSystem: false },

  // ── EQUITY ────────────────────────────────────────────────────────────
  { code: "3000", name: "Owner's Equity", type: "equity", isSystem: true },
  { code: "3100", name: "Capital Account", type: "equity", parentCode: "3000", isSystem: true },
  { code: "3200", name: "Retained Earnings", type: "equity", parentCode: "3000", isSystem: true },
  { code: "3300", name: "Current Year Profit / (Loss)", type: "equity", parentCode: "3000", isSystem: true },

  // ── INCOME ────────────────────────────────────────────────────────────
  { code: "4000", name: "Revenue", type: "income", isSystem: true },
  { code: "4100", name: "Service Revenue", type: "income", parentCode: "4000", isSystem: true },
  { code: "4110", name: "Consulting & Advisory", type: "income", parentCode: "4100", isSystem: false },
  { code: "4120", name: "Digital Marketing Services", type: "income", parentCode: "4100", isSystem: false },
  { code: "4130", name: "Design & Creative Services", type: "income", parentCode: "4100", isSystem: false },
  { code: "4140", name: "Technology Services", type: "income", parentCode: "4100", isSystem: false },
  { code: "4150", name: "Project Revenue", type: "income", parentCode: "4100", isSystem: false },
  { code: "4200", name: "Retainer Income", type: "income", parentCode: "4000", isSystem: false },
  { code: "4900", name: "Other Income", type: "income", parentCode: "4000", isSystem: false },
  { code: "4910", name: "Interest Income", type: "income", parentCode: "4900", isSystem: false },

  // ── EXPENSES ──────────────────────────────────────────────────────────
  { code: "5000", name: "Cost of Revenue", type: "expense", isSystem: false },
  { code: "5100", name: "Subcontractor / Freelancer Costs", type: "expense", parentCode: "5000", isSystem: false },
  { code: "5200", name: "Software & Tools (COGS)", type: "expense", parentCode: "5000", isSystem: false },

  { code: "6000", name: "Operating Expenses", type: "expense", isSystem: true },
  { code: "6100", name: "Salaries & Wages", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6110", name: "Salary — Full Time", type: "expense", parentCode: "6100", isSystem: false },
  { code: "6120", name: "Salary — Part Time", type: "expense", parentCode: "6100", isSystem: false },
  { code: "6130", name: "Employee Benefits & PF", type: "expense", parentCode: "6100", isSystem: false },

  { code: "6200", name: "Rent & Facilities", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6210", name: "Office Rent", type: "expense", parentCode: "6200", isSystem: false },
  { code: "6220", name: "Coworking Space", type: "expense", parentCode: "6200", isSystem: false },
  { code: "6230", name: "Utilities", type: "expense", parentCode: "6200", isSystem: false },

  { code: "6300", name: "Technology & Infrastructure", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6310", name: "Cloud Hosting (AWS/GCP/Azure)", type: "expense", parentCode: "6300", isSystem: false },
  { code: "6320", name: "SaaS Subscriptions", type: "expense", parentCode: "6300", isSystem: false },
  { code: "6330", name: "Domain & SSL", type: "expense", parentCode: "6300", isSystem: false },
  { code: "6340", name: "Internet & Telecom", type: "expense", parentCode: "6300", isSystem: false },

  { code: "6400", name: "Marketing & Sales", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6410", name: "Digital Advertising", type: "expense", parentCode: "6400", isSystem: false },
  { code: "6420", name: "Business Development", type: "expense", parentCode: "6400", isSystem: false },
  { code: "6430", name: "Events & Sponsorships", type: "expense", parentCode: "6400", isSystem: false },

  { code: "6500", name: "Travel & Entertainment", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6510", name: "Travel (Flights & Trains)", type: "expense", parentCode: "6500", isSystem: false },
  { code: "6520", name: "Local Transport (Cab/Auto)", type: "expense", parentCode: "6500", isSystem: false },
  { code: "6530", name: "Accommodation (Hotels)", type: "expense", parentCode: "6500", isSystem: false },
  { code: "6540", name: "Meals & Food", type: "expense", parentCode: "6500", isSystem: false },
  { code: "6550", name: "Client Entertainment", type: "expense", parentCode: "6500", isSystem: false },

  { code: "6600", name: "Professional Fees", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6610", name: "Legal & Compliance", type: "expense", parentCode: "6600", isSystem: false },
  { code: "6620", name: "Accounting & CA Fees", type: "expense", parentCode: "6600", isSystem: false },
  { code: "6630", name: "Recruitment & HR", type: "expense", parentCode: "6600", isSystem: false },

  { code: "6700", name: "Office Supplies & Admin", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6710", name: "Stationery & Printing", type: "expense", parentCode: "6700", isSystem: false },
  { code: "6720", name: "Postage & Courier", type: "expense", parentCode: "6700", isSystem: false },

  { code: "6800", name: "Depreciation", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6900", name: "Other Expenses", type: "expense", parentCode: "6000", isSystem: false },
  { code: "6910", name: "Bank Charges", type: "expense", parentCode: "6900", isSystem: false },
  { code: "6920", name: "Miscellaneous", type: "expense", parentCode: "6900", isSystem: false },
];

export const VENDOR_CATEGORY_RULES = [
  { pattern: "swiggy", accountCode: "6540" },
  { pattern: "zomato", accountCode: "6540" },
  { pattern: "uber eats", accountCode: "6540" },
  { pattern: "uber", accountCode: "6520" },
  { pattern: "ola", accountCode: "6520" },
  { pattern: "rapido", accountCode: "6520" },
  { pattern: "airtel", accountCode: "6340" },
  { pattern: "jio", accountCode: "6340" },
  { pattern: "vi ", accountCode: "6340" },
  { pattern: "vodafone", accountCode: "6340" },
  { pattern: "bsnl", accountCode: "6340" },
  { pattern: "aws", accountCode: "6310" },
  { pattern: "amazon web", accountCode: "6310" },
  { pattern: "google cloud", accountCode: "6310" },
  { pattern: "azure", accountCode: "6310" },
  { pattern: "digitalocean", accountCode: "6310" },
  { pattern: "vercel", accountCode: "6320" },
  { pattern: "github", accountCode: "6320" },
  { pattern: "notion", accountCode: "6320" },
  { pattern: "slack", accountCode: "6320" },
  { pattern: "figma", accountCode: "6320" },
  { pattern: "adobe", accountCode: "6320" },
  { pattern: "zoom", accountCode: "6320" },
  { pattern: "gsuite", accountCode: "6320" },
  { pattern: "google workspace", accountCode: "6320" },
  { pattern: "microsoft 365", accountCode: "6320" },
  { pattern: "indigo", accountCode: "6510" },
  { pattern: "air india", accountCode: "6510" },
  { pattern: "vistara", accountCode: "6510" },
  { pattern: "irctc", accountCode: "6510" },
  { pattern: "makemytrip", accountCode: "6510" },
  { pattern: "oyo", accountCode: "6530" },
  { pattern: "taj", accountCode: "6530" },
  { pattern: "marriott", accountCode: "6530" },
];
