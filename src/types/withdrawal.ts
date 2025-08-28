
// This file defines the types for the withdrawal API
export interface WithdrawalRequest {
  recipientName: string;
  recipientAddress: string;
  amount: string; // Amount in MIST (1 SUI = 1,000,000,000 MIST) // Optional unique ID from backend for idempotency
}

export interface WithdrawalResponse {
  recipientName: string;
  success: boolean;
  message: string;
  transactionDigest?: string; 
  error?: string; 
  requestId?: string;
}