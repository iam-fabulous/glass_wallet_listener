export interface WalletInfo {
  address: string;
  privateKey: string; // Hex-encoded private key
}

export type TransactionStatus = "success" | "failed";


export interface SuiTransactionEvent {
  digest: string;
  status: TransactionStatus;
  sender: string;
  fullTransactionResponse: any; // Keep the full response for deep analysis if needed
}
