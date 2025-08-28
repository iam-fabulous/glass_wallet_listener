// src/controllers/withdrawalController.ts

import { Request, Response, NextFunction } from 'express';
import { SuiService } from '../services/suiService'; // Import your SuiService instance
import { logger } from '../utils/logger';
import { WithdrawalRequest, WithdrawalResponse } from '../types/withdrawal';

/**
 * Handles the POST /api/withdraw request to initiate a SUI withdrawal.
 * This is an Express route handler function.
 */
export const withdrawFunds = (suiServiceInstance: SuiService) => { // This function receives the instance
  return async (req: Request, res: Response<WithdrawalResponse>, next: NextFunction) => { // This is the actual Express handler
    const { recipientAddress, amount} = req.body as WithdrawalRequest;

    if (!recipientAddress || typeof amount !== 'string') {
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
    } catch (error: any) {
      //logger.error(`Withdrawal failed (ID: ${requestId || 'N/A'}): ${error.message || error}`);
      res.status(500).json({
        success: false,
        message: `Withdrawal failed: ${error.message || 'An unknown error occurred.'}`,
        error: error.message || 'Unknown error',
        
      });
    }
  };
};

// You can add other controller functions here if you have more API endpoints
// export const getBalance = async (req: Request, res: Response) => { ... };