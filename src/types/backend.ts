// src/types/backend.ts
import { TransactionStatus } from "./sui";

// This interface directly maps to a Java POJO
export interface TransactionConfirmationPayload {
  transactionDigest: string; // Maps to String in Java
  status: TransactionStatus; // Maps to String (enum name) in Java, or a custom Java Enum
  senderAddress: string; // Maps to String in Java
  // Optional fields from the transaction, ensure naming consistency (camelCase in TS, can be converted to snake_case in Java with config)
  gasUsedComputationCost?: number; // Maps to Long or BigInteger in Java
  gasUsedStorageCost?: number; // Maps to Long or BigInteger in Java
  gasUsedStorageRebate?: number; // Maps to Long or BigInteger in Java
  timestamp?: string; // Maps to String (ISO format) or java.time.Instant/LocalDateTime in Java
  fullTransactionDetails?: any; // Maps to String (JSON string) or Map<String, Object> in Java
}
