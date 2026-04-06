/**
 * Subscription & Receipt Validation Routes
 * 
 * Handles validation of App Store and Google Play purchases
 * and manages user subscription status in Firebase
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

/**
 * Validate Apple App Store receipt
 * Production URL: https://buy.itunes.apple.com/verifyReceipt
 * Sandbox URL: https://sandbox.itunes.apple.com/verifyReceipt
 */
async function validateAppleReceipt(receiptData, password) {
  const productionUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
  
  try {
    // Try production first
    const productionResponse = await axios.post(productionUrl, {
      'receipt-data': receiptData,
      'password': password, // Your App Store shared secret
      'exclude-old-transactions': true,
    });
    
    // If status is 21007 (sandbox receipt on production), retry with sandbox
    if (productionResponse.data.status === 21007) {
      console.log('📱 Receipt is from sandbox, retrying with sandbox URL');
      const sandboxResponse = await axios.post(sandboxUrl, {
        'receipt-data': receiptData,
        'password': password,
        'exclude-old-transactions': true,
      });
      return sandboxResponse.data;
    }
    
    return productionResponse.data;
  } catch (error) {
    console.error('❌ Apple receipt validation error:', error.message);
    throw new Error('Failed to validate Apple receipt');
  }
}

/**
 * Validate Google Play purchase
 * Requires Google Play Developer API credentials
 */
async function validateGooglePlayPurchase(packageName, productId, purchaseToken) {
  try {
    // TODO: Implement Google Play validation using googleapis
    // You'll need to:
    // 1. Set up a service account in Google Cloud Console
    // 2. Enable Google Play Developer API
    // 3. Use googleapis package to verify the purchase
    
    // For now, this is a placeholder
    console.log('🤖 Google Play validation - TODO: Implement');
    console.log(`Package: ${packageName}, Product: ${productId}, Token: ${purchaseToken}`);
    
    // Return mock success for development
    return {
      valid: true,
      productId: productId,
      purchaseState: 0, // 0 = Purchased
    };
  } catch (error) {
    console.error('❌ Google Play validation error:', error.message);
    throw new Error('Failed to validate Google Play purchase');
  }
}

/**
 * POST /api/subscription/validate/apple
 * Validate Apple App Store receipt
 */
router.post('/validate/apple', async (req, res) => {
  try {
    const { receiptData, userId } = req.body;
    
    if (!receiptData || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: receiptData, userId',
      });
    }
    
    console.log(`🍎 Validating Apple receipt for user: ${userId}`);
    
    // Your App Store shared secret (from App Store Connect)
    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    
    if (!sharedSecret) {
      console.error('❌ APPLE_SHARED_SECRET not configured');
      return res.status(500).json({
        error: 'Server configuration error',
      });
    }
    
    const validationResult = await validateAppleReceipt(receiptData, sharedSecret);
    
    if (validationResult.status !== 0) {
      console.error('❌ Apple receipt validation failed:', validationResult.status);
      return res.status(400).json({
        error: 'Invalid receipt',
        appleStatus: validationResult.status,
      });
    }
    
    // Extract subscription info from latest receipt info
    const latestReceipt = validationResult.latest_receipt_info?.[0];
    
    if (!latestReceipt) {
      return res.status(400).json({
        error: 'No subscription found in receipt',
      });
    }
    
    const expiresDate = new Date(parseInt(latestReceipt.expires_date_ms));
    const isActive = expiresDate > new Date();
    
    console.log(`✅ Apple subscription validated: Active=${isActive}, Expires=${expiresDate}`);
    
    res.json({
      valid: true,
      isActive,
      productId: latestReceipt.product_id,
      expiresDate: expiresDate.toISOString(),
      originalTransactionId: latestReceipt.original_transaction_id,
    });
  } catch (error) {
    console.error('❌ Error validating Apple receipt:', error);
    res.status(500).json({
      error: 'Failed to validate receipt',
      message: error.message,
    });
  }
});

/**
 * POST /api/subscription/validate/google
 * Validate Google Play purchase
 */
router.post('/validate/google', async (req, res) => {
  try {
    const { packageName, productId, purchaseToken, userId } = req.body;
    
    if (!packageName || !productId || !purchaseToken || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: packageName, productId, purchaseToken, userId',
      });
    }
    
    console.log(`🤖 Validating Google Play purchase for user: ${userId}`);
    
    const validationResult = await validateGooglePlayPurchase(
      packageName,
      productId,
      purchaseToken
    );
    
    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Invalid purchase',
      });
    }
    
    // For subscriptions, you'd check the expiryTime
    const isActive = validationResult.purchaseState === 0;
    
    console.log(`✅ Google Play subscription validated: Active=${isActive}`);
    
    res.json({
      valid: true,
      isActive,
      productId,
      // Include expiry date when implementing full Google Play API
    });
  } catch (error) {
    console.error('❌ Error validating Google Play purchase:', error);
    res.status(500).json({
      error: 'Failed to validate purchase',
      message: error.message,
    });
  }
});

/**
 * POST /api/subscription/status
 * Get subscription status for a user from Firebase
 * (This would query your Firestore database)
 */
router.post('/status', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Missing required field: userId',
      });
    }
    
    console.log(`📊 Checking subscription status for user: ${userId}`);
    
    // TODO: Query Firebase/Firestore for user subscription
    // For now, return a placeholder response
    res.json({
      userId,
      isPremium: false,
      subscriptionType: null,
      expiresDate: null,
    });
  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
    res.status(500).json({
      error: 'Failed to check subscription status',
      message: error.message,
    });
  }
});

export default router;

