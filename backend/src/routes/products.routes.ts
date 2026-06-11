import { Router, Request, Response } from 'express';
import { ProductService } from '../services/ProductService';
import { validateBusinessUnit } from '../middleware/validation';
import { logger } from '../utils/logger';
import { SegmentType } from '../types/api.types';

const router = Router();

/**
 * GET /api/products/top-selling
 * Get top selling products ordered by quantity or revenue
 * Requirements: 8.1, 8.2
 */
router.get(
  '/top-selling',
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const {
        orderBy = 'quantity',
        limit = '20',
        businessUnit = 'all',
        startDate,
        endDate,
      } = req.query;

      const db = (global as any).dbManager;
      const productService = new ProductService(db);

      const products = await productService.getTopSellingProducts(
        orderBy as 'quantity' | 'revenue',
        parseInt(limit as string, 10),
        businessUnit as 'ecommerce' | 'distribuidor' | 'all',
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        orderBy,
        limit: parseInt(limit as string, 10),
        businessUnit,
        productCount: products.length,
        products,
      });
    } catch (error) {
      logger.error('Error fetching top selling products', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'TOP_PRODUCTS_FAILED',
          message: 'Failed to fetch top selling products',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/products/co-occurrence
 * Get product pairs frequently bought together
 * Requirements: 8.3, 15.1, 15.2, 15.3
 */
router.get(
  '/co-occurrence',
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const {
        minFrequency = '2',
        businessUnit = 'all',
        startDate,
        endDate,
        limit = '20',
      } = req.query;

      const db = (global as any).dbManager;
      const productService = new ProductService(db);

      const productPairs = await productService.getProductCoOccurrence(
        parseInt(minFrequency as string, 10),
        businessUnit as 'ecommerce' | 'distribuidor' | 'all',
        startDate as string | undefined,
        endDate as string | undefined,
        parseInt(limit as string, 10)
      );

      res.json({
        minFrequency: parseInt(minFrequency as string, 10),
        businessUnit,
        pairCount: productPairs.length,
        productPairs,
      });
    } catch (error) {
      logger.error('Error fetching product co-occurrence', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'CO_OCCURRENCE_FAILED',
          message: 'Failed to fetch product co-occurrence',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/products/:id/customers
 * Get customers who purchased a specific product
 * Requirement: 8.6
 */
router.get('/:id/customers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const db = (global as any).dbManager;
    const productService = new ProductService(db);

    const customers = await productService.getProductCustomers(
      parseInt(id, 10),
      startDate as string | undefined,
      endDate as string | undefined
    );

    res.json({
      productId: parseInt(id, 10),
      customerCount: customers.length,
      customers,
    });
  } catch (error) {
    logger.error('Error fetching product customers', {
      error: error instanceof Error ? error.message : String(error),
      params: req.params,
      query: req.query,
    });
    res.status(500).json({
      error: {
        code: 'PRODUCT_CUSTOMERS_FAILED',
        message: 'Failed to fetch product customers',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/products/by-segment/:segmentType
 * Get top products for a specific customer segment
 * Requirements: 8.4, 8.5
 */
router.get(
  '/by-segment/:segmentType',
  validateBusinessUnit,
  async (req: Request, res: Response) => {
    try {
      const { segmentType } = req.params;
      const {
        businessUnit = 'all',
        startDate,
        endDate,
        limit = '20',
      } = req.query;

      const db = (global as any).dbManager;
      const productService = new ProductService(db);

      const products = await productService.getProductsBySegment(
        segmentType as SegmentType,
        businessUnit as 'ecommerce' | 'distribuidor' | 'all',
        startDate as string | undefined,
        endDate as string | undefined,
        parseInt(limit as string, 10)
      );

      res.json({
        segment: segmentType,
        businessUnit,
        productCount: products.length,
        products,
      });
    } catch (error) {
      logger.error('Error fetching products by segment', {
        error: error instanceof Error ? error.message : String(error),
        params: req.params,
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'SEGMENT_PRODUCTS_FAILED',
          message: 'Failed to fetch products by segment',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /api/products/pair/:product1Id/:product2Id/orders
 * Get orders containing both products in a pair
 * Requirements: 15.4, 15.5
 */
router.get(
  '/pair/:product1Id/:product2Id/orders',
  async (req: Request, res: Response) => {
    try {
      const { product1Id, product2Id } = req.params;
      const { startDate, endDate } = req.query;

      const db = (global as any).dbManager;
      const productService = new ProductService(db);

      const orders = await productService.getOrdersByProductPair(
        parseInt(product1Id, 10),
        parseInt(product2Id, 10),
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        product1Id: parseInt(product1Id, 10),
        product2Id: parseInt(product2Id, 10),
        orderCount: orders.length,
        orders,
      });
    } catch (error) {
      logger.error('Error fetching orders for product pair', {
        error: error instanceof Error ? error.message : String(error),
        params: req.params,
        query: req.query,
      });
      res.status(500).json({
        error: {
          code: 'PRODUCT_PAIR_ORDERS_FAILED',
          message: 'Failed to fetch orders for product pair',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

export default router;
