
import { TransactionStatus } from "./sui"; // Ensure this import is correct

// This interface directly maps to a Java POJO
export interface TransactionConfirmationPayload {
  suiTransactionDigest: string; // Renamed from transactionDigest to match the payload in processTransactionEffect
  status: TransactionStatus; // Maps to String (enum name) in Java, or a custom Java Enum
  errorMessage?: string | null; // Added to capture transaction failure reasons
  type: "deposit" | "withdrawal" | "unknown"; // Added to indicate transaction type
  senderAddress: string; // Maps to String in Java
  recipientAddress: string; // Added to explicitly state the recipient
  suiAmountChange: number; // Added to explicitly state the SUI amount change

 
  timestampMs?: string; 
}