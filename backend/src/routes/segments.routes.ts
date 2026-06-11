import { Router, Request, Response } from 'express';
import { SegmentService, SegmentType } from '../services/SegmentService';
import { validateDateRange, validateBusinessUnit } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/segments
 * Get all customer segments with customer counts
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
router.get(
  '/',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const segmentService = new SegmentService(db);

      const segments = await segmentService.identifySegments({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        segments,
      });
    } catch (error) {
      logger.error('Error identifying segments', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'SEGMENT_IDENTIFICATION_FAILED',
          message: 'Failed to identify customer segments',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/segments/:type/customers
 * Get full customer details for a specific segment
 * Requirement: 6.1
 */
router.get(
  '/:type/customers',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      // Validate segment type
      const validSegments = ['recorrente', 'inativo', 'em_risco', 'novo', 'vip'];
      if (!validSegments.includes(type)) {
        res.status(400).json({
          error: {
            code: 'INVALID_SEGMENT_TYPE',
            message: `Invalid segment type. Must be one of: ${validSegments.join(', ')}`,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const db = (global as any).dbManager;
      const segmentService = new SegmentService(db);

      const customers = await segmentService.getSegmentCustomers(
        type as SegmentType,
        {
          startDate: startDate as string,
          endDate: endDate as string,
          businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
        }
      );

      res.json({
        period: { startDate, endDate },
        businessUnit,
        segment: type,
        customerCount: customers.length,
        customers,
      });
    } catch (error) {
      logger.error('Error getting segment customers', {
        error: error instanceof Error ? error.message : String(error),
        params: req.params,
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'SEGMENT_CUSTOMERS_FAILED',
          message: 'Failed to get segment customers',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

export default router;
