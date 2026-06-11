import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { validateDateRange, validateBusinessUnit, handleValidationErrors } from '../middleware/validation';

const router = Router();
const dashboardService = new DashboardService();

/**
 * GET /api/dashboard/kpis
 * Returns KPIs for the dashboard
 */
router.get(
  '/kpis',
  validateDateRange(),
  validateBusinessUnit(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, businessUnit = 'all' } = req.query;

      const kpis = await dashboardService.getKPIs(
        startDate as string,
        endDate as string,
        businessUnit as 'ecommerce' | 'distributor' | 'all'
      );

      res.json(kpis);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch KPIs',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

export default router;
