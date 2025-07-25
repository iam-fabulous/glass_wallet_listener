
// This file defines the types for the withdrawal API
export interface WithdrawalRequest {
  recipientAddress: string;
  amount: number; // Amount in MIST (1 SUI = 1,000,000,000 MIST) // Optional unique ID from backend for idempotency
}

export interface WithdrawalResponse {
  success: boolean;
  message: string;
  transactionDigest?: string; 
  error?: string; 
  requestId?: string;
}