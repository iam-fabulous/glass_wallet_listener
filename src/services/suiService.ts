import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  getFullnodeUrl,
  SuiClient,
  SuiHTTPTransport,
} from "@mysten/sui/client";
import { createSuiClient } from "@shinami/clients/sui";

import { getFaucetHost, requestSuiFromFaucetV2 } from "@mysten/sui/faucet";

import WebSocket from "ws";
import { Buffer } from "buffer";

import { WalletInfo } from "../types/sui";
import config from "../config";
import { logger } from "../utils/logger";
import { Transaction } from "@mysten/sui/transactions";
import axios from "axios";
import {
  SuiTransactionBlockResponse,
  TransactionEffects,
} from "@mysten/sui/client";

function toHexString(bytes: Uint8Array): string {
  return bytes.reduce(
    (str, byte) => str + byte.toString(16).padStart(2, "0"),
    ""
  );
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

interface FaucetSuccessResponse {
  transferTxDigest: string;
}

interface FaucetErrorResponse {
  error: string;
}

type FaucetOperationResponse = FaucetSuccessResponse | FaucetErrorResponse;



export class SuiService {
  private client: SuiClient;
  private primaryKeypair: Ed25519Keypair;
  private unsubscribeMonitoringFunctions: (() => Promise<boolean>)[] = [];
  private backendConfirmationUrl: string;
  constructor(shinamiNodeAccessKey: string, suiNetwork: "testnet") {
    // We assume the shinamiNodeAccessKey is already validated by the caller (e.g., in index.ts)
    // and passed in correctly.
   // this.client = createSuiClient(shinamiNodeAccessKey);
    this.client = new SuiClient({ url: getFullnodeUrl(suiNetwork) }); // Use the public endpoint for the specified network
    logger.info(`SuiClient initialized with Public Node Service for network: ${suiNetwork}`);
    this.backendConfirmationUrl = config.backendConfirmationUrl;

    logger.info(
      `SuiClient initialized with Shinami Node Service for network: ${suiNetwork}`
    );

    // loadKeypairFromConfig still uses config.suiPrivateKey because that's directly from config.ts
    this.primaryKeypair = this.loadKeypairFromConfig(config.suiPrivateKey);
    logger.info(`Primary wallet loaded: ${this.primaryKeypair.toSuiAddress()}`);

    // Store backendConfirmationUrl and javaStatusEndpoint if needed for processTransactionEffect
    // We'll pass them down in startMonitoringTransactions
    this.backendConfirmationUrl = config.backendConfirmationUrl; // Use config directly here
  }

  private loadKeypairFromConfig(privateKeyString: string): Ed25519Keypair {
    const cleanedPrivateKey = privateKeyString.startsWith("suiprivkey:")
      ? privateKeyString.substring("suiprivkey:".length)
      : privateKeyString;
    let privateKeyBytes = fromBase64(cleanedPrivateKey);
    if (privateKeyBytes.length === 33 && privateKeyBytes[0] === 0x00) {
      privateKeyBytes = privateKeyBytes.slice(1);
      logger.debug("Removed key scheme byte (Ed25519) from private key.");
    } else if (privateKeyBytes.length !== 32) {
      logger.error(
        `Unexpected private key byte length: Expected 32 or 33 (for Ed25519 with scheme byte), got ${privateKeyBytes.length}`
      );
      throw new Error(
        `Invalid SUI_PRIVATE_KEY format: Wrong byte length ${privateKeyBytes.length}.`
      );
    }

    try {
      return Ed25519Keypair.fromSecretKey(privateKeyBytes);
    } catch (error: any) {
      logger.error(
        "Failed to load keypair from SUI_PRIVATE_KEY. Check format:",
        error.message || error
      );
      throw new Error("Invalid SUI_PRIVATE_KEY format.");
    }
  }

  getLoadedWalletInfo(): WalletInfo {
    const address = this.primaryKeypair.toSuiAddress();
    const secretKeyRaw = this.primaryKeypair.getSecretKey();

    let fullSecretKey: Uint8Array;

    if (typeof secretKeyRaw === "string") {
      try {
        fullSecretKey = fromBase64(secretKeyRaw);
        logger.warn(
          "getSecretKey unexpectedly returned a string. Converting to Uint8Array."
        );
      } catch (e) {
        logger.error(
          "Failed to decode secretKeyRaw (string) to Uint8Array. Is it base64?",
          e
        );
        throw new Error(
          "Unexpected secret key format returned by getSecretKey."
        );
      }
    } else {
      fullSecretKey = secretKeyRaw;
    }

    const privateKeyBytes = fullSecretKey.slice(0, 32);
    const privateKey = toHexString(privateKeyBytes);

  
    return { address, privateKey };
    
  }

  async fundAddress(address: string): Promise<void> {

    logger.info(`Requesting SUI from faucet for ${address}...`);
    try {
      const response = (await requestSuiFromFaucetV2({
        host: getFaucetHost(config.suiNetwork),
        recipient: address,
      })) as unknown as FaucetOperationResponse;

      if ("error" in response) {
        logger.error(`Faucet failed for ${address}: ${response.error}`);
        throw new Error(`Faucet failed: ${response.error}`);
      } else {
        logger.info(
          `Successfully requested SUI for ${address}. Transaction Digest: ${response.transferTxDigest}`
        );
      }
    } catch (error: any) {
      logger.error(
        `Error funding Sui address ${address}:`,
        error.message || error
      );
      throw error;
    }
  }

  async withdrawSui(recipientAddress: string, amount: number): Promise<string> {
    logger.info(
      `Attempting to withdraw ${amount} MIST SUI to ${recipientAddress} from ${this.primaryKeypair.toSuiAddress()}`
    );

    if (amount <= 0) {
      throw new Error("Amount to withdraw must be positive.");
    }

    try {
      const txb = new Transaction();
      const [coin] = txb.splitCoins(txb.gas, [amount]); // Split a new coin from the gas coin
      txb.transferObjects([coin], recipientAddress); // Transfer the new coin to the recipient

      const result = await this.client.signAndExecuteTransaction({
        signer: this.primaryKeypair,
        transaction: txb,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      if (result.effects?.status.status === "success") {
        logger.info(`SUI withdrawal successful. Digest: ${result.digest}`);
        return result.digest;
      } else {
        const errorMessage =
          result.effects?.status.error || "Unknown error during withdrawal.";
        logger.error(
          `SUI withdrawal failed. Digest: ${result.digest}, Error: ${errorMessage}`
        );
        throw new Error(`SUI withdrawal failed: ${errorMessage}`);
      }
    } catch (error: any) {
      logger.error(
        `Error during SUI withdrawal to ${recipientAddress}:`,
        error.message || error
      );
      throw error;
    }
  }

  async startMonitoringTransactions(
    javaStatusEndpoint: string,
  ): Promise<void> {
    const addressToMonitor = this.primaryKeypair.toSuiAddress();
    logger.info(
      `Starting transaction monitoring for address: ${addressToMonitor}`
    );

    // Stop any existing monitoring before starting new ones
    if (this.unsubscribeMonitoringFunctions.length > 0) {
      await this.stopMonitoringTransactions(); // This call is now recognized
    }


    try {
      const unsubscribeToAddress = await this.client.subscribeTransaction({
        filter: {
          ToAddress: addressToMonitor,
        },
        onMessage: async (effects: TransactionEffects) => {
          await this.processTransactionEffect(
            effects,
            javaStatusEndpoint,
            addressToMonitor
          );
        },
      });
      this.unsubscribeMonitoringFunctions.push(unsubscribeToAddress);
      logger.info(
        `Started monitoring incoming transactions (deposits) for ${addressToMonitor}`
      );

      const unsubscribeFromAddress = await this.client.subscribeTransaction({
        filter: {
          FromAddress: addressToMonitor,
        },
        onMessage: async (effects: TransactionEffects) => {
          await this.processTransactionEffect(
            effects,
            javaStatusEndpoint,
            addressToMonitor
          );
        },
      });
      this.unsubscribeMonitoringFunctions.push(unsubscribeFromAddress);
      logger.info(
        `Started monitoring outgoing transactions (withdrawals) for ${addressToMonitor}`
      );
    } catch (error: any) {
      logger.error(
        `Failed to start transaction monitoring for ${addressToMonitor}:`,
        error.message || error
      );
      await this.stopMonitoringTransactions(); // This call is now recognized
      throw error;
    }
  }

  /**
   * Helper method to process a transaction effect, fetch full details,
   * extract relevant data, and send to the backend.
   */
  private async processTransactionEffect(
    effects: TransactionEffects,
    statusEndpoint: string,
    monitoredAddress: string
  ): Promise<void> {
    logger.debug(
      `Processing transaction effect for digest: ${effects.transactionDigest}`
    );

    let fullTransaction: SuiTransactionBlockResponse | null = null;
    try {
      fullTransaction = await this.client.getTransactionBlock({
        digest: effects.transactionDigest,
        options: {
          showEffects: true,
          showEvents: true,
          showBalanceChanges: true,
          showObjectChanges: true,
          showInput: true,
          showRawInput: false,
        },
      });
      logger.debug(
        `Fetched full transaction details for digest: ${effects.transactionDigest}`
      );
    } catch (fetchError: any) {
      logger.error(
        `Failed to fetch full transaction details for ${effects.transactionDigest}: ${fetchError.message}`
      );
      return;
    }

    let status = "UNKNOWN";
    let errorMessage: string | null = null;
    if (effects.status.status === "success") {
      status = "SUCCESS";
    } else if (effects.status.status === "failure") {
      status = "FAILED";
      errorMessage =
        effects.status.error ||
        "Transaction failed with no specific error message.";
    }

    const senderAddress =
      fullTransaction?.transaction?.data?.sender || "unknown";
    let transactionType: "deposit" | "withdrawal" | "unknown" = "unknown";
    let actualRecipientAddress: string = monitoredAddress;

    if (senderAddress === monitoredAddress) {
      transactionType = "withdrawal";
      actualRecipientAddress =
        this.getActualRecipientFromTransaction(fullTransaction);
    } else {
      const involvedInBalanceChange = fullTransaction?.balanceChanges?.some(
        (change) => {
          // FIX 3: Add explicit type guard for 'AddressOwner'
          return (
            typeof change.owner === "object" &&
            change.owner !== null &&
            "AddressOwner" in change.owner &&
            change.owner.AddressOwner === monitoredAddress
          );
        }
      );
      if (involvedInBalanceChange) {
        transactionType = "deposit";
      }
    }

    let suiAmountChange: number = 0;
    const suiCoinType = "0x2::sui::SUI";

    if (fullTransaction?.balanceChanges) {
      const relevantSuiChange = fullTransaction.balanceChanges.find(
        (change) => {
          // FIX 3 (again): Add explicit type guard for 'AddressOwner'
          return (
            typeof change.owner === "object" &&
            change.owner !== null &&
            "AddressOwner" in change.owner &&
            change.owner.AddressOwner === monitoredAddress &&
            change.coinType === suiCoinType
          );
        }
      );
      if (relevantSuiChange) {
        suiAmountChange = parseInt(relevantSuiChange.amount, 10);
      }
    }

    const transactionDetails = {
      suiTransactionDigest: effects.transactionDigest,
      status: status,
      errorMessage: errorMessage,
      type: transactionType,
      senderAddress: senderAddress,
      recipientAddress: actualRecipientAddress,
      suiAmountChange: suiAmountChange,
      timestampMs: fullTransaction?.timestampMs || "0",
    };

    logger.info(
      `Transaction ${effects.transactionDigest} (Type: ${
        transactionDetails.type
      }, SUI Change: ${
        suiAmountChange / 1_000_000_000
      } SUI) status: ${status}. Reporting to backend.`
    );

    try {
      const backendResponse = await axios.post(
        `${this.backendConfirmationUrl}${statusEndpoint}`,
        transactionDetails
      );
      logger.info(
        `Backend notified for ${effects.transactionDigest}. Response: ${backendResponse.status}`
      );
    } catch (backendError: any) {
      logger.error(
        `Failed to notify backend for transaction ${effects.transactionDigest}:`,
        backendError.message || backendError
      );
      // Consider retries or a dead-letter queue here in a production system
    }
  }

  /**
   * Helper to get the actual recipient of an outgoing transaction.
   * This parses the transaction commands within the transaction block.
   */
  private getActualRecipientFromTransaction(
    fullTransaction: SuiTransactionBlockResponse
  ): string | "unknown" {
    // THE DEFINITIVE FIX: Cast the TransactionBlockData to 'any'
    // This forces TypeScript to ignore its incorrect local type definition
    // and allows access to 'transaction' (singular) and 'inputs' which exist at runtime.
    const txData = fullTransaction?.transaction?.data as any;

    const txCommands = txData?.transaction; // Access 'transaction' (singular) as the commands array
    const txInputs = txData?.inputs; // Access 'inputs' directly from the 'any'-cast data

    if (!txCommands || !Array.isArray(txCommands)) {
      return "unknown";
    }

    for (const txCommand of txCommands) {
      if (
        typeof txCommand === "object" &&
        txCommand !== null &&
        "TransferObjects" in txCommand
      ) {
        const transferObjectsCommand = (txCommand as any).TransferObjects;
        const recipientArg = transferObjectsCommand[1];

        if (typeof recipientArg === "string") {
          return recipientArg;
        } else if (
          typeof recipientArg === "object" &&
          recipientArg !== null &&
          "Input" in recipientArg &&
          typeof recipientArg.Input === "number" &&
          txInputs
        ) {
          const input = txInputs[recipientArg.Input];
          if (
            typeof input === "object" &&
            input !== null &&
            "Pure" in input &&
            input.Pure instanceof Uint8Array &&
            input.Pure.length === 32
          ) {
            return `0x${Buffer.from(input.Pure).toString("hex")}`;
          }
        }
      }
    }
    return "unknown";
  }

  async stopMonitoringTransactions(): Promise<void> {
    if (this.unsubscribeMonitoringFunctions.length > 0) {
      logger.info(
        "Stopping all active transaction monitoring subscriptions..."
      );
      for (const unsubscribe of this.unsubscribeMonitoringFunctions) {
        await unsubscribe(); // This returns Promise<boolean>, which is fine as we don't need the boolean
      }
      this.unsubscribeMonitoringFunctions = [];
      logger.info("All transaction monitoring subscriptions stopped.");
    } else {
      logger.warn("No active transaction monitoring subscriptions to stop.");
    }
  }

  getClient(): SuiClient {
    return this.client;
  }

  getPrimaryKeypair(): Ed25519Keypair {
    return this.primaryKeypair;
  }
}

// export const suiService = new SuiService();
