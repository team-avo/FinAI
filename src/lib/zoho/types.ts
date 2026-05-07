// Subset of Zoho Books API response shapes — only what the FinAI aggregator
// reads. Add fields as we use them.

export interface ZohoApiEnvelope<T> {
  code: number;
  message: string;
  page_context?: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    report_name?: string;
    applied_filter?: string;
  };
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  date: string;            // YYYY-MM-DD
  due_date: string;
  status: string;          // draft | sent | paid | overdue | partially_paid | void | unpaid
  total: number;
  balance: number;         // amount due
  paid_amount?: number;    // sometimes payment_made
  payment_made?: number;
  currency_code?: string;
  is_inclusive_tax?: boolean;
  tax_total?: number;
  cgst_total?: number;
  sgst_total?: number;
  igst_total?: number;
  is_emailed?: boolean;
  gst_treatment?: string;
  place_of_supply?: string;
  email?: string;
  reference_number?: string;
}

export interface ZohoExpense {
  expense_id: string;
  date: string;
  account_id: string;
  account_name: string;
  vendor_id?: string;
  vendor_name?: string;
  amount: number;
  tax_amount?: number;
  total?: number;
  description?: string;
  status?: string;
  reference_number?: string;
  has_attachment?: boolean;
  is_billable?: boolean;
  customer_name?: string;
  paid_through_account_name?: string;
}

export interface ZohoBill {
  bill_id: string;
  bill_number: string;
  vendor_id: string;
  vendor_name: string;
  status: string;          // draft | open | overdue | paid | partial | void
  date: string;
  due_date: string;
  total: number;
  balance: number;
  currency_code?: string;
}

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_type: string;    // customer | vendor | both
  email?: string;
  phone?: string;
  gst_no?: string;
  outstanding_receivable_amount?: number;
  outstanding_payable_amount?: number;
  status?: string;
  billing_address?: { state?: string; state_code?: string; country?: string };
}

export interface ZohoBankAccount {
  account_id: string;
  account_name: string;
  bank_name?: string;
  account_number?: string;
  account_type: string;    // bank | creditcard | cash | other
  currency_code?: string;
  balance: number;
  is_active?: boolean;
}

export interface ZohoCustomerPayment {
  payment_id: string;
  date: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  payment_mode: string;
  reference_number?: string;
  invoice_numbers?: string;
  invoices?: { invoice_id: string; invoice_number: string; amount_applied: number }[];
}

export interface ZohoChartOfAccount {
  account_id: string;
  account_name: string;
  account_code?: string;
  account_type: string;    // income | expense | asset | liability | equity ...
  parent_account_id?: string;
  is_active?: boolean;
}

export interface ZohoOrgInfo {
  organization_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  state?: string;
  state_code?: string;
  country_code?: string;
  currency_code?: string;
  fiscal_year_start_month?: number;
  gstin?: string;
}
