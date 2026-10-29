/**
 * Bank feed provider. The cash-flow forecast needs a real account balance;
 * this interface is how we get it. Today a sandbox provider stands in; a real
 * Account Aggregator connection (Finvu / Setu as the TSP) implements the same
 * interface and the rest of the app doesn't change — "build the brain, rent
 * the hands".
 */
export interface BankSnapshot {
  displayName: string;
  balance: number;
  asOf: Date;
}

export interface BankProvider {
  readonly kind: "sandbox" | "aa";
  fetchSnapshot(): Promise<BankSnapshot>;
}

/**
 * Sandbox provider — a plausible current-account balance for demos and tests.
 * Deliberately on the tight side so the forecast has something to warn about;
 * a real business's balance comes from AA.
 */
export class SandboxBankProvider implements BankProvider {
  readonly kind = "sandbox" as const;
  async fetchSnapshot(): Promise<BankSnapshot> {
    return {
      displayName: "HDFC Current ••4821 (sandbox)",
      balance: 92000,
      asOf: new Date(),
    };
  }
}

export function getBankProvider(kind: "sandbox" | "aa" = "sandbox"): BankProvider {
  // Real AA provider slots in here later behind the same interface.
  return new SandboxBankProvider();
}
