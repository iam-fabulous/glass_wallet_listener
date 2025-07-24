"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suiService = void 0;
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const sui_1 = require("@shinami/clients/sui");
const faucet_1 = require("@mysten/sui/faucet");
const buffer_1 = require("buffer");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../utils/logger");
const transactions_1 = require("@mysten/sui/transactions");
const axios_1 = __importDefault(require("axios"));
function toHexString(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}
function fromBase64(base64) {
    return Uint8Array.from(buffer_1.Buffer.from(base64, "base64"));
}
class SuiService {
    client;
    primaryKeypair;
    unsubscribeMonitoringFunctions = [];
    constructor() {
        const shinamiNodeAccessKey = process.env.SHINAMI_NODE_ACCESS_KEY; // Assuming you load this from .env in config or directly
        if (!shinamiNodeAccessKey) {
            throw new Error("SHINAMI_NODE_ACCESS_KEY is not set. Please provide your Shinami API key.");
        }
        this.client = (0, sui_1.createSuiClient)(shinamiNodeAccessKey);
        logger_1.logger.info(`SuiClient initialized with Shinami Node Service for network: ${config_1.default.suiNetwork}`);
        this.primaryKeypair = this.loadKeypairFromConfig(config_1.default.suiPrivateKey);
        logger_1.logger.info(`Primary wallet loaded: ${this.primaryKeypair.toSuiAddress()}`);
    }
    loadKeypairFromConfig(privateKeyString) {
        const cleanedPrivateKey = privateKeyString.startsWith("suiprivkey:")
            ? privateKeyString.substring("suiprivkey:".length)
            : privateKeyString;
        let privateKeyBytes = fromBase64(cleanedPrivateKey);
        if (privateKeyBytes.length === 33 && privateKeyBytes[0] === 0x00) {
            privateKeyBytes = privateKeyBytes.slice(1);
            logger_1.logger.debug("Removed key scheme byte (Ed25519) from private key.");
        }
        else if (privateKeyBytes.length !== 32) {
            logger_1.logger.error(`Unexpected private key byte length: Expected 32 or 33 (for Ed25519 with scheme byte), got ${privateKeyBytes.length}`);
            throw new Error(`Invalid SUI_PRIVATE_KEY format: Wrong byte length ${privateKeyBytes.length}.`);
        }
        try {
            return ed25519_1.Ed25519Keypair.fromSecretKey(privateKeyBytes);
        }
        catch (error) {
            logger_1.logger.error("Failed to load keypair from SUI_PRIVATE_KEY. Check format:", error.message || error);
            throw new Error("Invalid SUI_PRIVATE_KEY format.");
        }
    }
    getLoadedWalletInfo() {
        const address = this.primaryKeypair.toSuiAddress();
        const secretKeyRaw = this.primaryKeypair.getSecretKey();
        let fullSecretKey;
        if (typeof secretKeyRaw === "string") {
            try {
                fullSecretKey = fromBase64(secretKeyRaw);
                logger_1.logger.warn("getSecretKey unexpectedly returned a string. Converting to Uint8Array.");
            }
            catch (e) {
                logger_1.logger.error("Failed to decode secretKeyRaw (string) to Uint8Array. Is it base64?", e);
                throw new Error("Unexpected secret key format returned by getSecretKey.");
            }
        }
        else {
            fullSecretKey = secretKeyRaw;
        }
        const privateKeyBytes = fullSecretKey.slice(0, 32);
        const privateKey = toHexString(privateKeyBytes);
        return { address, privateKey };
    }
    async fundAddress(address) {
        if (config_1.default.suiNetwork === "mainnet") {
            logger_1.logger.warn("Faucet not available for Mainnet. Skipping funding.");
            return;
        }
        logger_1.logger.info(`Requesting SUI from faucet for ${address}...`);
        try {
            const response = (await (0, faucet_1.requestSuiFromFaucetV2)({
                host: (0, faucet_1.getFaucetHost)(config_1.default.suiNetwork),
                recipient: address,
            }));
            if ("error" in response) {
                logger_1.logger.error(`Faucet failed for ${address}: ${response.error}`);
                throw new Error(`Faucet failed: ${response.error}`);
            }
            else {
                logger_1.logger.info(`Successfully requested SUI for ${address}. Transaction Digest: ${response.transferTxDigest}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error funding Sui address ${address}:`, error.message || error);
            throw error;
        }
    }
    async withdrawSui(recipientAddress, amount) {
        logger_1.logger.info(`Attempting to withdraw ${amount} MIST SUI to ${recipientAddress} from ${this.primaryKeypair.toSuiAddress()}`);
        if (amount <= 0) {
            throw new Error("Amount to withdraw must be positive.");
        }
        try {
            const txb = new transactions_1.Transaction();
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
                logger_1.logger.info(`SUI withdrawal successful. Digest: ${result.digest}`);
                return result.digest;
            }
            else {
                const errorMessage = result.effects?.status.error || "Unknown error during withdrawal.";
                logger_1.logger.error(`SUI withdrawal failed. Digest: ${result.digest}, Error: ${errorMessage}`);
                throw new Error(`SUI withdrawal failed: ${errorMessage}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error during SUI withdrawal to ${recipientAddress}:`, error.message || error);
            throw error;
        }
    }
    async startMonitoringTransactions(javaBackendUrl, statusEndpoint) {
        const addressToMonitor = this.primaryKeypair.toSuiAddress();
        logger_1.logger.info(`Starting transaction monitoring for address: ${addressToMonitor}`);
        // Stop any existing monitoring before starting new ones
        if (this.unsubscribeMonitoringFunctions.length > 0) {
            await this.stopMonitoringTransactions(); // This call is now recognized
        }
        try {
            const unsubscribeToAddress = await this.client.subscribeTransaction({
                filter: {
                    ToAddress: addressToMonitor,
                },
                onMessage: async (effects) => {
                    await this.processTransactionEffect(effects, javaBackendUrl, statusEndpoint, addressToMonitor);
                },
            });
            this.unsubscribeMonitoringFunctions.push(unsubscribeToAddress);
            logger_1.logger.info(`Started monitoring incoming transactions (deposits) for ${addressToMonitor}`);
            const unsubscribeFromAddress = await this.client.subscribeTransaction({
                filter: {
                    FromAddress: addressToMonitor,
                },
                onMessage: async (effects) => {
                    await this.processTransactionEffect(effects, javaBackendUrl, statusEndpoint, addressToMonitor);
                },
            });
            this.unsubscribeMonitoringFunctions.push(unsubscribeFromAddress);
            logger_1.logger.info(`Started monitoring outgoing transactions (withdrawals) for ${addressToMonitor}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to start transaction monitoring for ${addressToMonitor}:`, error.message || error);
            await this.stopMonitoringTransactions(); // This call is now recognized
            throw error;
        }
    }
    /**
     * Helper method to process a transaction effect, fetch full details,
     * extract relevant data, and send to the backend.
     */
    async processTransactionEffect(effects, javaBackendUrl, statusEndpoint, monitoredAddress) {
        logger_1.logger.debug(`Processing transaction effect for digest: ${effects.transactionDigest}`);
        let fullTransaction = null;
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
            logger_1.logger.debug(`Fetched full transaction details for digest: ${effects.transactionDigest}`);
        }
        catch (fetchError) {
            logger_1.logger.error(`Failed to fetch full transaction details for ${effects.transactionDigest}: ${fetchError.message}`);
            return;
        }
        let status = "UNKNOWN";
        let errorMessage = null;
        if (effects.status.status === "success") {
            status = "SUCCESS";
        }
        else if (effects.status.status === "failure") {
            status = "FAILED";
            errorMessage =
                effects.status.error ||
                    "Transaction failed with no specific error message.";
        }
        const senderAddress = fullTransaction?.transaction?.data?.sender || "unknown";
        let transactionType = "unknown";
        let actualRecipientAddress = monitoredAddress;
        if (senderAddress === monitoredAddress) {
            transactionType = "withdrawal";
            actualRecipientAddress =
                this.getActualRecipientFromTransaction(fullTransaction);
        }
        else {
            const involvedInBalanceChange = fullTransaction?.balanceChanges?.some((change) => {
                // FIX 3: Add explicit type guard for 'AddressOwner'
                return (typeof change.owner === "object" &&
                    change.owner !== null &&
                    "AddressOwner" in change.owner &&
                    change.owner.AddressOwner === monitoredAddress);
            });
            if (involvedInBalanceChange) {
                transactionType = "deposit";
            }
        }
        let suiAmountChange = 0;
        const suiCoinType = "0x2::sui::SUI";
        if (fullTransaction?.balanceChanges) {
            const relevantSuiChange = fullTransaction.balanceChanges.find((change) => {
                // FIX 3 (again): Add explicit type guard for 'AddressOwner'
                return (typeof change.owner === "object" &&
                    change.owner !== null &&
                    "AddressOwner" in change.owner &&
                    change.owner.AddressOwner === monitoredAddress &&
                    change.coinType === suiCoinType);
            });
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
        logger_1.logger.info(`Transaction ${effects.transactionDigest} (Type: ${transactionDetails.type}, SUI Change: ${suiAmountChange / 1_000_000_000} SUI) status: ${status}. Reporting to backend.`);
        try {
            const backendResponse = await axios_1.default.post(`${javaBackendUrl}${statusEndpoint}`, transactionDetails);
            logger_1.logger.info(`Backend notified for ${effects.transactionDigest}. Response: ${backendResponse.status}`);
        }
        catch (backendError) {
            logger_1.logger.error(`Failed to notify backend for transaction ${effects.transactionDigest}:`, backendError.message || backendError);
            // Consider retries or a dead-letter queue here in a production system
        }
    }
    /**
     * Helper to get the actual recipient of an outgoing transaction.
     * This parses the transaction commands within the transaction block.
     */
    getActualRecipientFromTransaction(fullTransaction) {
        // THE DEFINITIVE FIX: Cast the TransactionBlockData to 'any'
        // This forces TypeScript to ignore its incorrect local type definition
        // and allows access to 'transaction' (singular) and 'inputs' which exist at runtime.
        const txData = fullTransaction?.transaction?.data;
        const txCommands = txData?.transaction; // Access 'transaction' (singular) as the commands array
        const txInputs = txData?.inputs; // Access 'inputs' directly from the 'any'-cast data
        if (!txCommands || !Array.isArray(txCommands)) {
            return "unknown";
        }
        for (const txCommand of txCommands) {
            if (typeof txCommand === "object" &&
                txCommand !== null &&
                "TransferObjects" in txCommand) {
                const transferObjectsCommand = txCommand.TransferObjects;
                const recipientArg = transferObjectsCommand[1];
                if (typeof recipientArg === "string") {
                    return recipientArg;
                }
                else if (typeof recipientArg === "object" &&
                    recipientArg !== null &&
                    "Input" in recipientArg &&
                    typeof recipientArg.Input === "number" &&
                    txInputs) {
                    const input = txInputs[recipientArg.Input];
                    if (typeof input === "object" &&
                        input !== null &&
                        "Pure" in input &&
                        input.Pure instanceof Uint8Array &&
                        input.Pure.length === 32) {
                        return `0x${buffer_1.Buffer.from(input.Pure).toString("hex")}`;
                    }
                }
            }
        }
        return "unknown";
    }
    async stopMonitoringTransactions() {
        if (this.unsubscribeMonitoringFunctions.length > 0) {
            logger_1.logger.info("Stopping all active transaction monitoring subscriptions...");
            for (const unsubscribe of this.unsubscribeMonitoringFunctions) {
                await unsubscribe(); // This returns Promise<boolean>, which is fine as we don't need the boolean
            }
            this.unsubscribeMonitoringFunctions = [];
            logger_1.logger.info("All transaction monitoring subscriptions stopped.");
        }
        else {
            logger_1.logger.warn("No active transaction monitoring subscriptions to stop.");
        }
    }
    getClient() {
        return this.client;
    }
    getPrimaryKeypair() {
        return this.primaryKeypair;
    }
}
exports.suiService = new SuiService();
