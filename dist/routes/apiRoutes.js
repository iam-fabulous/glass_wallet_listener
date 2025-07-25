"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/apiRoutes.ts
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const withdrawalController_1 = require("../controllers/withdrawalController");
exports.default = (suiServiceInstance) => {
    const router = (0, express_1.Router)();
    router.get('/health', (req, res) => {
        logger_1.logger.debug('Health check endpoint hit.');
        res.status(200).send('OK');
    });
    router.post('/withdrawSuiCoin', (0, withdrawalController_1.withdrawFunds)(suiServiceInstance));
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
