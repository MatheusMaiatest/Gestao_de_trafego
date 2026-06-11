import { Router, Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import {
  validateDateRange,
  validateBusinessUnit,
  validatePagination,
  validateCustomerId,
  handleValidationErrors
} from '../middleware/validation';

const router = Router();
const customerService = new CustomerService();

/**
 * GET /api/clients
 * Returns paginated list of clients
 */
router.get(
  '/',
  validateDateRange(),
  validateBusinessUnit(),
  validatePagination(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        businessUnit = 'all',
        page = 1,
        limit = 50
      } = req.query;

      const result = await customerService.getCustomers({
        startDate: startDate as string,
        endDate: endDate as string,
        businessUnit: businessUnit as 'ecommerce' | 'distributor' | 'all',
        page: Number(page),
        limit: Number(limit)
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch clients',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * GET /api/clients/:id
 * Returns detailed client information
 */
router.get(
  '/:id',
  validateCustomerId(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const client = await customerService.getCustomerById(Number(id));

      if (!client) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Client not found',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.json(client);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch client details',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

export default router;
