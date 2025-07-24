"use strict";
// src/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const suiService_1 = require("./services/suiService"); // Import the suiService instance
const config_1 = __importDefault(require("./config")); // Import your configuration
const logger_1 = require("./utils/logger"); // Assuming you have a logger utility
/**
 * Main function to start the Glass Wallet Listener application.
 */
async function startApplication() {
    logger_1.logger.info("Glass Wallet Listener: Application startup initiated.");
    // Validate essential configuration before starting
    if (!config_1.default.backendConfirmationUrl) {
        logger_1.logger.error("Configuration Error: BACKEND_CONFIRMATION_URL is missing. Please check .env and config/index.ts.");
        process.exit(1); // Exit if critical config is missing
    }
    if (!config_1.default.suiPrivateKey) {
        logger_1.logger.error("Configuration Error: SUI_PRIVATE_KEY is missing. Please check .env and config/index.ts.");
        process.exit(1); // Exit if critical config is missing
    }
    // Add any other critical config checks here
    try {
        logger_1.logger.info("Glass Wallet Listener: Attempting to start transaction monitoring...");
        // Call the method to start monitoring transactions
        await suiService_1.suiService.startMonitoringTransactions(config_1.default.backendConfirmationUrl, // Or config.javaBackendUrl if that's the name in your config
        config_1.default.javaStatusEndpoint // Make sure this matches the property name in your config
        );
        logger_1.logger.info("Glass Wallet Listener: Transaction monitoring started successfully. The application is now active.");
        // Keep the process alive indefinitely
        // In some setups, just the async operation is enough, but a simple
        // loop or waiting mechanism can explicitly keep Node.js process alive
        // if it tries to exit prematurely. For a listener, the subscription
        // itself should keep it alive.
    }
    catch (error) {
        logger_1.logger.error("Glass Wallet Listener: Failed to start application:", error);
        // You might want to implement retry logic here for production
        process.exit(1); // Exit with an error code if startup fails
    }
}
// Call the main function to start the application
startApplication();
// You might also want to handle graceful shutdown signals (Ctrl+C)
process.on("SIGINT", async () => {
    logger_1.logger.info("SIGINT received. Shutting down Glass Wallet Listener gracefully...");
    await suiService_1.suiService.stopMonitoringTransactions(); // Call your stop function
    logger_1.logger.info("Glass Wallet Listener has shut down.");
    process.exit(0);
});
process.on("SIGTERM", async () => {
    logger_1.logger.info("SIGTERM received. Shutting down Glass Wallet Listener gracefully...");
    await suiService_1.suiService.stopMonitoringTransactions(); // Call your stop function
    logger_1.logger.info("Glass Wallet Listener has shut down.");
    process.exit(0);
});
