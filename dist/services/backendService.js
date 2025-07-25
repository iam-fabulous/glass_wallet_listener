"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../utils/logger");
class BackendService {
    async sendTransactionConfirmation(payload) {
        logger_1.logger.info(`Sending transaction confirmation for degree ${payload.suiTransactionDigest} to backend...`);
        try {
            const response = await axios_1.default.post(config_1.default.backendConfirmationUrl, payload, {
                headers: {
                    "Content-Type": "application/json",
                },
            });
            logger_1.logger.info(`Java Backend for ${payload.suiTransactionDigest}: Status ${response.status}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to send confirmation for ${payload.suiTransactionDigest} to Java backend: `, error.message);
            if (error.response) {
                logger_1.logger.error("Java Backend error details (status, data):", error.response.status, error.response.data);
            }
        }
    }
}
exports.backendService = new BackendService();
