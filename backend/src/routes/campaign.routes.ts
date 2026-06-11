import { Router, Request, Response } from 'express';
import { CampaignService } from '../services/CampaignService';
import { validateDateRange, validateBusinessUnit } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/campaign/metrics
 * Get campaign metrics including coupon performance
 * Requirements: 17.1, 17.2, 17.5
 */
router.get(
  '/metrics',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const campaignService = new CampaignService(db);

      const metrics = await campaignService.calculateCouponMetrics({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        metrics,
      });
    } catch (error) {
      logger.error('Error calculating campaign metrics', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'CAMPAIGN_METRICS_FAILED',
          message: 'Failed to calculate campaign metrics',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/campaign/first-purchase-coupon
 * Get customers whose first purchase used a coupon
 * Requirement: 17.3
 */
router.get(
  '/first-purchase-coupon',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const campaignService = new CampaignService(db);

      const customers = await campaignService.getFirstPurchaseWithCoupon({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        customerCount: customers.length,
        customers,
      });
    } catch (error) {
      logger.error('Error getting first purchase with coupon customers', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'FIRST_PURCHASE_COUPON_FAILED',
          message: 'Failed to get first purchase with coupon customers',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/campaign/conversion-rate
 * Get coupon conversion rate
 * Requirements: 17.4, 17.5
 */
router.get(
  '/conversion-rate',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const campaignService = new CampaignService(db);

      const conversionRate = await campaignService.calculateCouponConversionRate({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        conversionRate,
      });
    } catch (error) {
      logger.error('Error calculating coupon conversion rate', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'CONVERSION_RATE_FAILED',
          message: 'Failed to calculate coupon conversion rate',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

export default router;
