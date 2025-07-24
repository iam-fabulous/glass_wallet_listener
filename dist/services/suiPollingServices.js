"use strict";
// import axios from "axios";
// import {
//   SuiClient,
//   getFullnodeUrl,
//   SuiHTTPTransport,
//   SuiTransactionBlockResponse,
//   TransactionEffects,
// } from "@mysten/sui/client";
// import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
// import config from "../config";
// import { logger } from "../utils/logger";
// import { Buffer } from "buffer";
// // Define the TransactionDetails type at the top level for clarity and consistent typing
// type TransactionDetails = {
//   suiTransactionDigest: string;
//   status: string;
//   errorMessage: string | null;
//   type: "deposit" | "withdrawal" | "unknown";
//   senderAddress: string;
//   recipientAddress: string;
//   suiAmountChange: number;
//   timestampMs: bigint; // Explicitly type as bigint
// };
// class SuiPollingService {
//   private client: SuiClient;
//   private primaryKeypair: Ed25519Keypair;
//   private pollIntervalId: NodeJS.Timeout | null = null;
//   // This explicitly declares the type as bigint | null
//   private lastProcessedCheckpoint: bigint | null = null;
//   constructor() {
//     const rpcUrl = getFullnodeUrl(config.suiNetwork);
//     this.client = new SuiClient({
//       transport: new SuiHTTPTransport({
//         url: rpcUrl,
//       }),
//     });
//     logger.info(
//       `SuiPollingService: SuiClient initialized for ${config.suiNetwork} using RPC endpoint: ${rpcUrl}`
//     );
//     this.primaryKeypair = this.loadKeypairFromConfig(config.suiPrivateKey);
//     logger.info(
//       `SuiPollingService: Primary wallet loaded: ${this.primaryKeypair.toSuiAddress()}`
//     );
//   }
//   private loadKeypairFromConfig(privateKeyBase64: string): Ed25519Keypair {
//     if (!privateKeyBase64) {
//       throw new Error("SUI_PRIVATE_KEY is not configured.");
//     }
//     let cleanedKey = privateKeyBase64;
//     try {
//       const decodedKey = Buffer.from(privateKeyBase64, "base64");
//       if (decodedKey.length === 33 && decodedKey[0] === 0x00) {
//         cleanedKey = decodedKey.slice(1).toString("base64");
//         logger.debug(
//           "SuiPollingService: Removed key scheme byte (Ed25519) from private key."
//         );
//       }
//     } catch (e) {
//       logger.warn(
//         "SuiPollingService: Failed to decode private key for scheme byte check. Using as-is."
//       );
//     }
//     return Ed25519Keypair.fromSecretKey(Buffer.from(cleanedKey, "base64"));
//   }
//   async startPollingForTransactions(
//     javaBackendUrl: string,
//     statusEndpoint: string,
//     pollIntervalMs: number = 5000
//   ): Promise<void> {
//     const addressToMonitor = this.primaryKeypair.toSuiAddress();
//     logger.info(
//       `SuiPollingService: Starting transaction polling for address: ${addressToMonitor} every ${
//         pollIntervalMs / 1000
//       } seconds.`
//     );
//     if (this.lastProcessedCheckpoint === null) {
//       try {
//         this.lastProcessedCheckpoint =
//           await this.client.getLatestCheckpointSequenceNumber();
//         logger.info(
//           `SuiPollingService: Initializing polling from checkpoint ${this.lastProcessedCheckpoint}`
//         );
//       } catch (error) {
//         logger.error(
//           `SuiPollingService: Failed to get initial checkpoint number: ${error}`
//         );
//         // Use BigInt(0) instead of 0n for extreme clarity in type inference for the variable
//         this.lastProcessedCheckpoint = BigInt(0); // Line 78 in your report
//       }
//     }
//     const pollFunction = async () => {
//       try {
//         const currentCheckpoint =
//           await this.client.getLatestCheckpointSequenceNumber();
//         // This comparison should now be bigint vs bigint
//         if (currentCheckpoint > this.lastProcessedCheckpoint!) {
//           // Line 96 in your report
//           logger.debug(
//             `SuiPollingService: New checkpoints found: from ${this.lastProcessedCheckpoint} to ${currentCheckpoint}`
//           );
//           const response = await this.client.queryTransactionBlocks({
//             filter: {
//               FromAddress: addressToMonitor,
//             },
//             order: "ascending",
//             limit: 50,
//             options: {
//               showEffects: true,
//               showEvents: true,
//               showBalanceChanges: true,
//               showObjectChanges: true,
//               showInput: true,
//               showRawInput: false,
//             },
//             // fromCheckpoint is a direct parameter to queryTransactionBlocks, not inside 'options' or 'filter'
//             fromCheckpoint: this.lastProcessedCheckpoint! + 1n, // Line 108 in your report (fixed placement)
//           });
//           if (response.data && response.data.length > 0) {
//             logger.info(
//               `SuiPollingService: Found ${response.data.length} new transaction blocks.`
//             );
//             for (const txBlock of response.data) {
//               if (txBlock.effects) {
//                 await this.processTransactionEffect(
//                   txBlock.effects,
//                   javaBackendUrl,
//                   statusEndpoint,
//                   addressToMonitor,
//                   txBlock
//                 );
//               }
//             }
//           }
//           this.lastProcessedCheckpoint = currentCheckpoint;
//         } else {
//           logger.debug(
//             `SuiPollingService: No new checkpoints found. Current: ${currentCheckpoint}, Last Processed: ${this.lastProcessedCheckpoint}`
//           );
//         }
//       } catch (error: any) {
//         logger.error(
//           `SuiPollingService: Error during transaction polling: ${
//             error.message || error
//           }`
//         );
//       } finally {
//         this.pollIntervalId = setTimeout(pollFunction, pollIntervalMs);
//       }
//     };
//     this.pollIntervalId = setTimeout(pollFunction, 0);
//   }
//   async stopPollingForTransactions(): Promise<boolean> {
//     if (this.pollIntervalId) {
//       clearTimeout(this.pollIntervalId);
//       this.pollIntervalId = null;
//       logger.info("SuiPollingService: Transaction polling stopped.");
//       return true;
//     }
//     logger.warn("SuiPollingService: No active polling to stop.");
//     return false;
//   }
//   private async processTransactionEffect(
//     effects: TransactionEffects,
//     javaBackendUrl: string,
//     statusEndpoint: string,
//     monitoredAddress: string,
//     fullTransaction?: SuiTransactionBlockResponse
//   ): Promise<void> {
//     logger.debug(
//       `SuiPollingService: Processing transaction effect for digest: ${effects.transactionDigest}`
//     );
//     let currentFullTransaction: SuiTransactionBlockResponse | null =
//       fullTransaction || null;
//     if (!currentFullTransaction) {
//       try {
//         currentFullTransaction = await this.client.getTransactionBlock({
//           digest: effects.transactionDigest,
//           options: {
//             showEffects: true,
//             showEvents: true,
//             showBalanceChanges: true,
//             showObjectChanges: true,
//             showInput: true,
//             showRawInput: false,
//           },
//         });
//         logger.debug(
//           `SuiPollingService: Fetched full transaction details for digest: ${currentFullTransaction?.transaction?.data?.sender}`
//         );
//       } catch (fetchError: any) {
//         logger.error(
//           `SuiPollingService: Failed to fetch full transaction details for ${effects.transactionDigest}: ${fetchError.message}`
//         );
//         return;
//       }
//     }
//     let status = "UNKNOWN";
//     let errorMessage: string | null = null;
//     if (effects.status.status === "success") {
//       status = "SUCCESS";
//     } else if (effects.status.status === "failure") {
//       status = "FAILED";
//       errorMessage =
//         effects.status.error ||
//         "Transaction failed with no specific error message.";
//     }
//     const senderAddress =
//       currentFullTransaction?.transaction?.data?.sender || "unknown";
//     let transactionType: "deposit" | "withdrawal" | "unknown" = "unknown";
//     let actualRecipientAddress: string = monitoredAddress;
//     if (senderAddress === monitoredAddress) {
//       transactionType = "withdrawal";
//       actualRecipientAddress = this.getActualRecipientFromTransaction(
//         currentFullTransaction
//       );
//     } else {
//       const involvedInBalanceChange =
//         currentFullTransaction?.balanceChanges?.some((change) => {
//           return (
//             typeof change.owner === "object" &&
//             change.owner !== null &&
//             "AddressOwner" in change.owner &&
//             change.owner.AddressOwner === monitoredAddress
//           );
//         });
//       if (involvedInBalanceChange) {
//         transactionType = "deposit";
//       }
//     }
//     let suiAmountChange: number = 0;
//     const suiCoinType = "0x2::sui::SUI";
//     if (currentFullTransaction?.balanceChanges) {
//       const relevantSuiChange = currentFullTransaction.balanceChanges.find(
//         (change) => {
//           return (
//             typeof change.owner === "object" &&
//             change.owner !== null &&
//             "AddressOwner" in change.owner &&
//             change.owner.AddressOwner === monitoredAddress &&
//             change.coinType === suiCoinType
//           );
//         }
//       );
//       if (relevantSuiChange) {
//         suiAmountChange = parseInt(relevantSuiChange.amount, 10);
//       }
//     }
//     // Explicitly cast the source string to string before passing to BigInt
//     const timestampString = (currentFullTransaction?.timestampMs ||
//       "0") as string;
//     const transactionDetails: TransactionDetails = {
//       // Using the top-level type
//       suiTransactionDigest: effects.transactionDigest,
//       status: status,
//       errorMessage: errorMessage,
//       type: transactionType,
//       senderAddress: senderAddress,
//       recipientAddress: actualRecipientAddress,
//       suiAmountChange: suiAmountChange,
//       timestampMs: BigInt(timestampString), // Line 136 in your report (now clearly string to bigint)
//     };
//     logger.info(
//       `SuiPollingService: Transaction ${
//         transactionDetails.suiTransactionDigest
//       } (Type: ${transactionDetails.type}, SUI Change: ${
//         suiAmountChange / 1_000_000_000
//       } SUI) status: ${status}. Reporting to backend.`
//     );
//     try {
//       const backendResponse = await axios.post(
//         `${javaBackendUrl}${statusEndpoint}`,
//         transactionDetails
//       );
//       logger.info(
//         `SuiPollingService: Backend notified for ${transactionDetails.suiTransactionDigest}. Response: ${backendResponse.status}`
//       );
//     } catch (backendError: any) {
//       logger.error(
//         `SuiPollingService: Failed to notify backend for transaction ${transactionDetails.suiTransactionDigest}:`,
//         backendError.message || backendError
//       );
//     }
//   }
//   private getActualRecipientFromTransaction(
//     fullTransaction: SuiTransactionBlockResponse | null
//   ): string | "unknown" {
//     if (
//       !fullTransaction ||
//       !fullTransaction.transaction ||
//       !fullTransaction.transaction.data
//     ) {
//       return "unknown";
//     }
//     const txData = fullTransaction.transaction.data as any;
//     const txCommands = txData?.transaction;
//     const txInputs = txData?.inputs;
//     // Added type guard for Array.isArray(arr)
//     if (!Array.isArray(txCommands)) {
//       return "unknown";
//     }
//     for (const txCommand of txCommands) {
//       if (
//         typeof txCommand === "object" &&
//         txCommand !== null &&
//         "TransferObjects" in txCommand
//       ) {
//         const transferObjectsCommand = (txCommand as any).TransferObjects;
//         const recipientArg = transferObjectsCommand[1];
//         if (typeof recipientArg === "string") {
//           return recipientArg;
//         } else if (
//           typeof recipientArg === "object" &&
//           recipientArg !== null &&
//           "Input" in recipientArg &&
//           typeof recipientArg.Input === "number" &&
//           txInputs
//         ) {
//           const input = txInputs[recipientArg.Input];
//           if (
//             typeof input === "object" &&
//             input !== null &&
//             "Pure" in input &&
//             input.Pure instanceof Uint8Array &&
//             input.Pure.length === 32
//           ) {
//             return `0x${Buffer.from(input.Pure).toString("hex")}`;
//           }
//         }
//       }
//     }
//     return "unknown";
//   }
// }
// export const suiPollingService = new SuiPollingService();
