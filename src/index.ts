// src/index.ts

import { suiService } from "./services/suiService"; // Import the suiService instance
import config from "./config"; // Import your configuration
import { logger } from "./utils/logger"; // Assuming you have a logger utility

/**
 * Main function to start the Glass Wallet Listener application.
 */
async function startApplication() {
  logger.info("Glass Wallet Listener: Application startup initiated.");

  // Validate essential configuration before starting
  if (!config.backendConfirmationUrl) {
    logger.error(
      "Configuration Error: BACKEND_CONFIRMATION_URL is missing. Please check .env and config/index.ts."
    );
    process.exit(1); // Exit if critical config is missing
  }
  if (!config.suiPrivateKey) {
    logger.error(
      "Configuration Error: SUI_PRIVATE_KEY is missing. Please check .env and config/index.ts."
    );
    process.exit(1); // Exit if critical config is missing
  }
  // Add any other critical config checks here

  try {
    logger.info(
      "Glass Wallet Listener: Attempting to start transaction monitoring..."
    );
    // Call the method to start monitoring transactions
    await suiService.startMonitoringTransactions(
      config.backendConfirmationUrl, // Or config.javaBackendUrl if that's the name in your config
      config.javaStatusEndpoint // Make sure this matches the property name in your config
    );
    logger.info(
      "Glass Wallet Listener: Transaction monitoring started successfully. The application is now active."
    );

    // Keep the process alive indefinitely
    // In some setups, just the async operation is enough, but a simple
    // loop or waiting mechanism can explicitly keep Node.js process alive
    // if it tries to exit prematurely. For a listener, the subscription
    // itself should keep it alive.
  } catch (error) {
    logger.error("Glass Wallet Listener: Failed to start application:", error);
    // You might want to implement retry logic here for production
    process.exit(1); // Exit with an error code if startup fails
  }
}

// Call the main function to start the application
startApplication();

// You might also want to handle graceful shutdown signals (Ctrl+C)
process.on("SIGINT", async () => {
  logger.info(
    "SIGINT received. Shutting down Glass Wallet Listener gracefully..."
  );
  await suiService.stopMonitoringTransactions(); // Call your stop function
  logger.info("Glass Wallet Listener has shut down.");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info(
    "SIGTERM received. Shutting down Glass Wallet Listener gracefully..."
  );
  await suiService.stopMonitoringTransactions(); // Call your stop function
  logger.info("Glass Wallet Listener has shut down.");
  process.exit(0);
});
