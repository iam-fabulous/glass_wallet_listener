"use strict";
// src/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const suiService_1 = require("./services/suiService");
const config_1 = __importDefault(require("./config"));
const logger_1 = require("./utils/logger");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const apiRoutes_1 = __importDefault(require("./routes/apiRoutes"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use(body_parser_1.default.json());
let suiServiceInstance;
async function startApplication() {
    logger_1.logger.info("Glass Wallet Listener: Application startup initiated.");
    if (!config_1.default.backendConfirmationUrl) {
        logger_1.logger.error("Configuration Error: BACKEND_CONFIRMATION_URL is missing. Please check .env and config/index.ts.");
        process.exit(1);
    }
    if (!config_1.default.suiPrivateKey) {
        logger_1.logger.error("Configuration Error: SUI_PRIVATE_KEY is missing. Please check .env and config/index.ts.");
        process.exit(1);
    }
    if (!config_1.default.monitoredWalletAddress) {
        logger_1.logger.error("Configuration Error: MONITORED_WALLET_ADDRESS is missing. Please check .env and config/index.ts.");
        process.exit(1);
    }
    if (!config_1.default.shinamiNodeAccessKey) {
        logger_1.logger.error("Configuration Error: SHINAMI_NODE_ACCESS_KEY is missing. Please check .env and config/index.ts.");
        process.exit(1);
    }
    suiServiceInstance = new suiService_1.SuiService(config_1.default.shinamiNodeAccessKey, config_1.default.suiNetwork);
    app.use('/api', (0, apiRoutes_1.default)(suiServiceInstance));
    try {
        logger_1.logger.info(`Glass Wallet Listener: Attempting to start API server on port ${port}...`);
        const server = app.listen(port, () => {
            logger_1.logger.info(`Withdrawal API server listening on port ${port}`);
        });
        suiServiceInstance.httpServer = server;
        logger_1.logger.info("Glass Wallet Listener: Attempting to start transaction monitoring...");
        await suiServiceInstance.startMonitoringTransactions(config_1.default.javaStatusEndpoint);
        logger_1.logger.info("Glass Wallet Listener: Transaction monitoring started successfully. The application is now active.");
    }
    catch (error) {
        logger_1.logger.error("Glass Wallet Listener: Failed to start application:", error);
        process.exit(1);
    }
}
startApplication();
process.on("SIGINT", async () => {
    logger_1.logger.info("SIGINT received. Shutting down Glass Wallet Listener gracefully...");
    if (suiServiceInstance) {
        await suiServiceInstance.stopMonitoringTransactions();
        if (suiServiceInstance.httpServer) {
            suiServiceInstance.httpServer.close(() => {
                logger_1.logger.info('HTTP server closed.');
                process.exit(0);
            });
        }
        else {
            process.exit(0);
        }
    }
    else {
        logger_1.logger.warn("SuiService instance not initialized during SIGINT.");
        process.exit(0);
    }
});
process.on("SIGTERM", async () => {
    logger_1.logger.info("SIGTERM received. Shutting down Glass Wallet Listener gracefully...");
    if (suiServiceInstance) {
        await suiServiceInstance.stopMonitoringTransactions();
        if (suiServiceInstance.httpServer) {
            suiServiceInstance.httpServer.close(() => {
                logger_1.logger.info('HTTP server closed.');
                process.exit(0);
            });
        }
        else {
            process.exit(0);
        }
    }
    else {
        logger_1.logger.warn("SuiService instance not initialized during SIGTERM.");
        process.exit(0);
    }
});
