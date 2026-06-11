import { Router, Request, Response } from 'express';
import { RFMService } from '../services/RFMService';
import { validateDateRange, validateBusinessUnit } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/rfm/scores
 * Calculate RFM scores for all customers in the specified period
 * Requirements: 7.1, 7.2, 7.3
 */
router.get(
  '/scores',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const rfmService = new RFMService(db);

      const scores = await rfmService.calculateRFMScores({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        customerCount: scores.length,
        scores,
      });
    } catch (error) {
      logger.error('Error calculating RFM scores', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'RFM_CALCULATION_FAILED',
          message: 'Failed to calculate RFM scores',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/rfm/distribution
 * Get RFM segment distribution showing customer counts per segment
 * Requirement: 7.5
 */
router.get(
  '/distribution',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const rfmService = new RFMService(db);

      const distribution = await rfmService.getRFMDistribution({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        distribution,
      });
    } catch (error) {
      logger.error('Error getting RFM distribution', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'RFM_DISTRIBUTION_FAILED',
          message: 'Failed to get RFM distribution',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/rfm/segments/:segmentType/customers
 * Get customers in a specific RFM segment
 * Requirement: 7.1, 7.5
 */
router.get(
  '/segments/:segmentType/customers',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { segmentType } = req.params;
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const rfmService = new RFMService(db);

      // Calculate all scores and filter by segment
      const allScores = await rfmService.calculateRFMScores({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      const segmentCustomers = allScores.filter(
        (score) => score.rfmSegment === segmentType
      );

      res.json({
        period: { startDate, endDate },
        businessUnit,
        segment: segmentType,
        customerCount: segmentCustomers.length,
        customers: segmentCustomers,
      });
    } catch (error) {
      logger.error('Error getting RFM segment customers', {
        error: error instanceof Error ? error.message : String(error),
        params: req.params,
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'RFM_SEGMENT_FAILED',
          message: 'Failed to get RFM segment customers',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

export default router;
