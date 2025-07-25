import axios from "axios";
import { TransactionConfirmationPayload } from "../types/backend"; // This type defines the JSON structure
import config from "../config";
import { logger } from "../utils/logger";

class BackendService {
  async sendTransactionConfirmation(
    payload: TransactionConfirmationPayload
  ): Promise<void> {
    logger.info(
      `Sending transaction confirmation for degree ${payload.suiTransactionDigest} to backend...`
    );
    try {
      const response = await axios.post(
        config.backendConfirmationUrl,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      logger.info(
        `Java Backend for ${payload.suiTransactionDigest}: Status ${response.status}`
      );
    } catch (error: any) {
      logger.error(
        `Failed to send confirmation for ${payload.suiTransactionDigest} to Java backend: `,
        error.message
      );
      if (error.response) {
        logger.error(
          "Java Backend error details (status, data):",
          error.response.status,
          error.response.data
        );
      }
    }
  }
}
export const backendService = new BackendService();
