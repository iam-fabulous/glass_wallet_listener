// src/index.ts

import { SuiService } from "./services/suiService";
import config from "./config";
import { logger } from "./utils/logger";
import express from 'express';
import bodyParser from 'body-parser';
import apiRoutesFactory from './routes/apiRoutes';

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

let suiServiceInstance: SuiService;

async function startApplication() {
  logger.info("Glass Wallet Listener: Application startup initiated.");

  if (!config.backendConfirmationUrl) {
    logger.error(
      "Configuration Error: BACKEND_CONFIRMATION_URL is missing. Please check .env and config/index.ts."
    );
    process.exit(1);
  }
  if (!config.suiPrivateKey) {
    logger.error(
      "Configuration Error: SUI_PRIVATE_KEY is missing. Please check .env and config/index.ts."
    );
    process.exit(1);
  }
  if (!config.monitoredWalletAddress) {
    logger.error(
      "Configuration Error: MONITORED_WALLET_ADDRESS is missing. Please check .env and config/index.ts."
    );
    process.exit(1);
  }
  if (!config.shinamiNodeAccessKey) {
      logger.error(
          "Configuration Error: SHINAMI_NODE_ACCESS_KEY is missing. Please check .env and config/index.ts."
      );
      process.exit(1);
  }

  suiServiceInstance = new SuiService(
      config.shinamiNodeAccessKey,
      config.suiNetwork
  );

  app.use('/api', apiRoutesFactory(suiServiceInstance));

  try {
    logger.info(`Glass Wallet Listener: Attempting to start API server on port ${port}...`);
    const server = app.listen(port, () => {
      logger.info(`Withdrawal API server listening on port ${port}`);
    });

    (suiServiceInstance as any).httpServer = server;

    logger.info("Glass Wallet Listener: Attempting to start transaction monitoring...");
    await suiServiceInstance.startMonitoringTransactions(
      config.javaStatusEndpoint
    );
    logger.info(
      "Glass Wallet Listener: Transaction monitoring started successfully. The application is now active."
    );

  } catch (error) {
    logger.error("Glass Wallet Listener: Failed to start application:", error);
    process.exit(1);
  }
}

startApplication();

process.on("SIGINT", async () => {
  logger.info("SIGINT received. Shutting down Glass Wallet Listener gracefully...");
  if (suiServiceInstance) {
    await suiServiceInstance.stopMonitoringTransactions();
    if ((suiServiceInstance as any).httpServer) {
      (suiServiceInstance as any).httpServer.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } else {
    logger.warn("SuiService instance not initialized during SIGINT.");
    process.exit(0);
  }
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down Glass Wallet Listener gracefully...");
  if (suiServiceInstance) {
    await suiServiceInstance.stopMonitoringTransactions();
    if ((suiServiceInstance as any).httpServer) {
      (suiServiceInstance as any).httpServer.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } else {
    logger.warn("SuiService instance not initialized during SIGTERM.");
    process.exit(0);
  }
});