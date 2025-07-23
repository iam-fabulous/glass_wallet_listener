export interface WalletInfo {
  address: string;
  privateKey: string; // Hex-encoded private key
}

export type TransactionStatus = "success" | "failed";

// You might extend this with more specific transaction details if needed
export interface SuiTransactionEvent {
  digest: string;
  status: TransactionStatus;
  sender: string;
  // Add more parsed details as required
  fullTransactionResponse: any; // Keep the full response for deep analysis if needed
}
