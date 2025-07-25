// src/routes/apiRoutes.ts
import { Router } from 'express';
import { SuiService } from '../services/suiService';
import { logger } from '../utils/logger';
import { withdrawFunds } from '../controllers/withdrawalController';

export default (suiServiceInstance: SuiService) => {
  const router = Router();

  router.get('/health', (req, res) => {
    logger.debug('Health check endpoint hit.');
    res.status(200).send('OK');
  });

  router.post('/withdrawSuiCoin', withdrawFunds(suiServiceInstance));

//   router.post('/withdrawSuiCoin', async (req, res) => {
//       const { recipientAddress, amount, requestId } = req.body;
//       if (!recipientAddress || typeof amount !== 'number' || amount <= 0) {
//           logger.warn(`Invalid withdrawal request: missing recipientAddress or invalid amount. Request ID: ${requestId || 'N/A'}`);
//           return res.status(400).json({
//               success: false,
//               message: 'Invalid request: recipientAddress and a positive amount are required (amount in MIST).',
//               requestId,
//           });
//       }
//       logger.info(`Received withdrawal request (ID: ${requestId || 'N/A'}): ${amount} MIST to ${recipientAddress}`);
//       try {
//           const transactionDigest = await suiServiceInstance.withdrawSui(recipientAddress, amount);
//           logger.info(`Withdrawal successful (ID: ${requestId || 'N/A'}). Transaction Digest: ${transactionDigest}`);
//           res.status(200).json({
//               success: true,
//               message: 'Withdrawal initiated successfully.',
//               transactionDigest: transactionDigest,
//               requestId,
//           });
//       } catch (error: any) {
//           logger.error(`Withdrawal failed (ID: ${requestId || 'N/A'}): ${error.message || error}`);
//           res.status(500).json({
//               success: false,
//               message: `Withdrawal failed: ${error.message || 'An unknown error occurred.'}`,
//               error: error.message || 'Unknown error',
//               requestId,
//           });
//       }
//   });

  return router;
};