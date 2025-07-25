"use strict";
// src/controllers/withdrawalController.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawFunds = void 0;
/**
 * Handles the POST /api/withdraw request to initiate a SUI withdrawal.
 * This is an Express route handler function.
 */
const withdrawFunds = (suiServiceInstance) => {
    return async (req, res, next) => {
        const { recipientAddress, amount } = req.body;
        if (!recipientAddress || typeof amount !== 'number' || amount <= 0) {
            //logger.warn(`Invalid withdrawal request: missing recipientAddress or invalid amount. Request ID: ${requestId || 'N/A'}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid request: recipientAddress and a positive amount are required (amount in MIST).',
            });
        }
        //logger.info(`Received withdrawal request (ID: ${requestId || 'N/A'}): ${amount} MIST to ${recipientAddress}`);
        try {
            // CORRECTED: Call the withdrawSui function on the passed instance
            const transactionDigest = await suiServiceInstance.withdrawSui(recipientAddress, amount);
            //logger.info(`Withdrawal successful (ID: ${requestId || 'N/A'}). Transaction Digest: ${transactionDigest}`);
            res.status(200).json({
                success: true,
                message: 'Withdrawal initiated successfully.',
                transactionDigest: transactionDigest,
            });
        }
        catch (error) {
            //logger.error(`Withdrawal failed (ID: ${requestId || 'N/A'}): ${error.message || error}`);
            res.status(500).json({
                success: false,
                message: `Withdrawal failed: ${error.message || 'An unknown error occurred.'}`,
                error: error.message || 'Unknown error',
            });
        }
    };
};
exports.withdrawFunds = withdrawFunds;
// You can add other controller functions here if you have more API endpoints
// export const getBalance = async (req: Request, res: Response) => { ... };
