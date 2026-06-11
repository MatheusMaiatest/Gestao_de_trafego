import { DatabaseManager } from '../database/DatabaseManager';
import { logger } from '../utils/logger';
import { OrderService } from './OrderService';

/**
 * Campaign metrics including coupon performance
 */
export interface CampaignMetrics {
  totalOrders: number;
  ordersWithCoupon: number;
  ordersWithoutCoupon: number;
  averageTicketWithCoupon: number;
  averageTicketWithoutCoupon: number;
  couponConversionRate: number;
  totalRevenueWithCoupon: number;
  totalRevenueWithoutCoupon: number;
  firstPurchaseWithCouponCount: number;
}

/**
 * Customer who made first purchase with coupon
 */
export interface FirstPurchaseCouponCustomer {
  customerId: number;
  customerName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  orderNumber: string;
  orderDate: Date;
  orderValue: number;
  couponCode: string;
}

/**
 * Filters for campaign analysis
 */
export interface CampaignFilters {
  startDate: string;
  endDate: string;
  businessUnit: 'ecommerce' | 'distributor' | 'all';
}

/**
 * CampaignService handles campaign performance analysis and coupon tracking
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
export class CampaignService {
  private orderService: OrderService;

  constructor(private db: DatabaseManager) {
    this.orderService = new OrderService(db);
  }

  /**
   * Calculate campaign metrics including coupon performance
   * Requirements: 17.1, 17.2, 17.5
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to campaign metrics
   */
  async calculateCouponMetrics(filters: CampaignFilters): Promise<CampaignMetrics> {
    try {
      logger.debug('Calculating coupon metrics', { filters });

      // Get all orders and orders with coupons
      const allOrders = await this.orderService.getOrdersByDateRange({
        startDate: filters.startDate,
        endDate: filters.endDate,
        businessUnit: filters.businessUnit === 'all' ? undefined : filters.businessUnit,
      });

      const ordersWithCoupon = await this.orderService.getOrdersWithCoupon({
        startDate: filters.startDate,
        endDate: filters.endDate,
        businessUnit: filters.businessUnit === 'all' ? undefined : filters.businessUnit,
      });

      // Calculate metrics
      const totalOrders = allOrders.length;
      const ordersWithCouponCount = ordersWithCoupon.length;
      const ordersWithoutCouponCount = totalOrders - ordersWithCouponCount;

      const totalRevenueWithCoupon = ordersWithCoupon.reduce(
        (sum, order) => sum + order.totalValue,
        0
      );

      const totalRevenueWithoutCoupon = allOrders
        .filter(
          (order) => !order.discountCoupon || order.discountCoupon.trim() === ''
        )
        .reduce((sum, order) => sum + order.totalValue, 0);

      const averageTicketWithCoupon =
        ordersWithCouponCount > 0
          ? totalRevenueWithCoupon / ordersWithCouponCount
          : 0;

      const averageTicketWithoutCoupon =
        ordersWithoutCouponCount > 0
          ? totalRevenueWithoutCoupon / ordersWithoutCouponCount
          : 0;

      const couponConversionRate =
        totalOrders > 0 ? (ordersWithCouponCount / totalOrders) * 100 : 0;

      // Get first purchase with coupon count
      const firstPurchaseCustomers = await this.getFirstPurchaseWithCoupon(filters);
      const firstPurchaseWithCouponCount = firstPurchaseCustomers.length;

      const metrics: CampaignMetrics = {
        totalOrders,
        ordersWithCoupon: ordersWithCouponCount,
        ordersWithoutCoupon: ordersWithoutCouponCount,
        averageTicketWithCoupon: parseFloat(averageTicketWithCoupon.toFixed(2)),
        averageTicketWithoutCoupon: parseFloat(averageTicketWithoutCoupon.toFixed(2)),
        couponConversionRate: parseFloat(couponConversionRate.toFixed(2)),
        totalRevenueWithCoupon: parseFloat(totalRevenueWithCoupon.toFixed(2)),
        totalRevenueWithoutCoupon: parseFloat(totalRevenueWithoutCoupon.toFixed(2)),
        firstPurchaseWithCouponCount,
      };

      logger.debug('Coupon metrics calculated', metrics);

      return metrics;
    } catch (error) {
      logger.error('Error calculating coupon metrics', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Get customers whose first purchase used a coupon
   * Requirements: 17.3
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to array of customers
   */
  async getFirstPurchaseWithCoupon(
    filters: CampaignFilters
  ): Promise<FirstPurchaseCouponCustomer[]> {
    try {
      logger.debug('Getting first purchase with coupon customers', { filters });

      const whereClauses: string[] = [];
      const params: any[] = [];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      const whereClause =
        whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

      const sql = `
        SELECT 
          c.id as customer_id,
          c.nome as customer_name,
          c.email,
          c.telefone as phone,
          c.whatsapp,
          p.numero_pedido as order_number,
          p.data_pedido as order_date,
          p.valor_total as order_value,
          p.cupom_desconto as coupon_code
        FROM clientes c
        INNER JOIN (
          SELECT 
            cliente_id,
            MIN(data_pedido) as first_purchase_date
          FROM pedidos
          WHERE data_pedido BETWEEN ? AND ?
          ${whereClause}
          GROUP BY cliente_id
        ) first_purchase ON c.id = first_purchase.cliente_id
        INNER JOIN pedidos p ON c.id = p.cliente_id 
          AND p.data_pedido = first_purchase.first_purchase_date
        WHERE p.cupom_desconto IS NOT NULL
          AND p.cupom_desconto != ''
        ORDER BY p.data_pedido DESC
      `;

      // Add date range parameters
      const queryParams = [filters.startDate, filters.endDate, ...params];

      const results = await this.db.query<any>(sql, queryParams);

      const customers: FirstPurchaseCouponCustomer[] = results.map((row) => ({
        customerId: row.customer_id,
        customerName: row.customer_name,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        orderNumber: row.order_number,
        orderDate: new Date(row.order_date),
        orderValue: parseFloat(row.order_value),
        couponCode: row.coupon_code,
      }));

      logger.debug('First purchase with coupon customers fetched', {
        customerCount: customers.length,
      });

      return customers;
    } catch (error) {
      logger.error('Error getting first purchase with coupon customers', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Calculate coupon conversion rate
   * Requirements: 17.4, 17.5
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to conversion rate percentage
   */
  async calculateCouponConversionRate(filters: CampaignFilters): Promise<number> {
    try {
      const metrics = await this.calculateCouponMetrics(filters);
      return metrics.couponConversionRate;
    } catch (error) {
      logger.error('Error calculating coupon conversion rate', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }
}
