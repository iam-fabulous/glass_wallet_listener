"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/config/index.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    suiNetwork: process.env.SUI_NETWORK || "devnet",
    backendConfirmationUrl: process.env.BACKEND_CONFIRMATION_URL ||
        "http://localhost:8080",
    javaStatusEndpoint: process.env.JAVA_STATUS_ENDPOINT || "/transaction-status",
    suiPrivateKey: process.env.SUI_PRIVATE_KEY || "",
};
// Basic validation
if (!["devnet", "testnet", "mainnet"].includes(config.suiNetwork)) {
    throw new Error("Invalid SUI_NETWORK specified in .env");
}
if (!config.backendConfirmationUrl) {
    throw new Error("BACKEND_CONFIRMATION_URL is not specified in .env");
}
if (!config.suiPrivateKey) {
    throw new Error("SUI_PRIVATE_KEY is not specified in .env. Please generate one with `sui keytool generate ed25519` and add it.");
}
exports.default = config;
