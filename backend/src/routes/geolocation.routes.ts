import { Router, Request, Response } from 'express';
import { GeolocationService } from '../services/GeolocationService';
import { validateDateRange, validateBusinessUnit } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/geolocation/states
 * Get customer and revenue aggregation by state
 * Requirements: 16.1, 16.2, 16.4, 16.6
 */
router.get(
  '/states',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const db = (global as any).dbManager;
      const geolocationService = new GeolocationService(db);

      const stateMetrics = await geolocationService.aggregateByState({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        stateCount: stateMetrics.length,
        states: stateMetrics,
      });
    } catch (error) {
      logger.error('Error aggregating by state', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'STATE_AGGREGATION_FAILED',
          message: 'Failed to aggregate by state',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/geolocation/cities
 * Get customer and revenue aggregation by city
 * Requirements: 16.1, 16.3, 16.4, 16.6
 */
router.get(
  '/cities',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all', states } = req.query;

      // Parse states parameter (can be comma-separated)
      let statesArray: string[] | undefined;
      if (states && typeof states === 'string') {
        statesArray = states.split(',').map((s) => s.trim());
      }

      const db = (global as any).dbManager;
      const geolocationService = new GeolocationService(db);

      const cityMetrics = await geolocationService.aggregateByCity({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
        states: statesArray,
      });

      res.json({
        period: { startDate, endDate },
        businessUnit,
        filterStates: statesArray || 'all',
        cityCount: cityMetrics.length,
        cities: cityMetrics,
      });
    } catch (error) {
      logger.error('Error aggregating by city', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'CITY_AGGREGATION_FAILED',
          message: 'Failed to aggregate by city',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/geolocation/customers
 * Get customers for a specific location (state and/or city)
 * Requirement: 16.5
 */
router.get(
  '/customers',
  validateDateRange,
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        businessUnit = 'all',
        state,
        city,
      } = req.query;

      if (!state) {
        res.status(400).json({
          error: {
            code: 'MISSING_STATE_PARAMETER',
            message: 'State parameter is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const db = (global as any).dbManager;
      const geolocationService = new GeolocationService(db);

      const customers = await geolocationService.getCustomersByLocation(
        state as string,
        (city as string) || null,
        {
          startDate: startDate as string,
          endDate: endDate as string,
          businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
        }
      );

      res.json({
        period: { startDate, endDate },
        businessUnit,
        state,
        city: city || 'all',
        customerCount: customers.length,
        customers,
      });
    } catch (error) {
      logger.error('Error getting customers by location', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'LOCATION_CUSTOMERS_FAILED',
          message: 'Failed to get customers by location',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

export default router;
