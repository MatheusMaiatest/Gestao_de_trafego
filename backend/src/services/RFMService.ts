import { DatabaseManager } from '../database/DatabaseManager';
import { logger } from '../utils/logger';

/**
 * RFM Score for a customer
 */
export interface RFMScore {
  customerId: number;
  customerName: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmSegment: RFMSegment;
  daysSinceLastPurchase: number;
  orderCount: number;
  totalSpent: number;
  lastPurchaseDate: Date;
}

/**
 * RFM Segments based on RFM scores
 */
export type RFMSegment =
  | 'champions'
  | 'loyal'
  | 'potential_loyal'
  | 'promising'
  | 'at_risk'
  | 'hibernating'
  | 'lost';

/**
 * RFM Distribution showing customer counts per segment
 */
export interface RFMDistribution {
  segment: RFMSegment;
  customerCount: number;
  percentage: number;
  averageRevenue: number;
}

/**
 * Filters for RFM analysis
 */
export interface RFMFilters {
  startDate: string;
  endDate: string;
  businessUnit: 'ecommerce' | 'distributor' | 'all';
}

/**
 * RFMService implements RFM (Recency, Frequency, Monetary) analysis
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export class RFMService {
  constructor(private db: DatabaseManager) {}

  /**
   * Calculate RFM scores for all customers in the specified period
   * Requirements: 7.1, 7.2, 7.3
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to array of RFM scores
   */
  async calculateRFMScores(filters: RFMFilters): Promise<RFMScore[]> {
    try {
      logger.debug('Calculating RFM scores', { filters });

      // Get customer purchase data
      const customerData = await this.getCustomerPurchaseData(filters);

      if (customerData.length === 0) {
        logger.warn('No customer data found for RFM analysis', { filters });
        return [];
      }

      // Calculate quintiles for R, F, M
      const recencyQuintiles = this.calculateQuintiles(
        customerData.map((c) => c.daysSinceLastPurchase)
      );
      const frequencyQuintiles = this.calculateQuintiles(
        customerData.map((c) => c.orderCount)
      );
      const monetaryQuintiles = this.calculateQuintiles(
        customerData.map((c) => c.totalSpent)
      );

      // Calculate scores for each customer
      const rfmScores: RFMScore[] = customerData.map((customer) => {
        // Recency: lower days = higher score (reverse quintile)
        const recencyScore = 6 - this.getQuintileScore(customer.daysSinceLastPurchase, recencyQuintiles);
        const frequencyScore = this.getQuintileScore(customer.orderCount, frequencyQuintiles);
        const monetaryScore = this.getQuintileScore(customer.totalSpent, monetaryQuintiles);

        const rfmSegment = this.classifyRFMSegment(recencyScore, frequencyScore, monetaryScore);

        return {
          customerId: customer.customerId,
          customerName: customer.customerName,
          recencyScore,
          frequencyScore,
          monetaryScore,
          rfmSegment,
          daysSinceLastPurchase: customer.daysSinceLastPurchase,
          orderCount: customer.orderCount,
          totalSpent: customer.totalSpent,
          lastPurchaseDate: customer.lastPurchaseDate,
        };
      });

      logger.debug('RFM scores calculated successfully', {
        customerCount: rfmScores.length,
      });

      return rfmScores;
    } catch (error) {
      logger.error('Error calculating RFM scores', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Get RFM distribution showing customer counts per segment
   * Requirement 7.5
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to RFM distribution
   */
  async getRFMDistribution(filters: RFMFilters): Promise<RFMDistribution[]> {
    try {
      logger.debug('Getting RFM distribution', { filters });

      const rfmScores = await this.calculateRFMScores(filters);
      const totalCustomers = rfmScores.length;

      if (totalCustomers === 0) {
        return [];
      }

      // Group by segment
      const segmentMap = new Map<RFMSegment, RFMScore[]>();

      rfmScores.forEach((score) => {
        if (!segmentMap.has(score.rfmSegment)) {
          segmentMap.set(score.rfmSegment, []);
        }
        segmentMap.get(score.rfmSegment)!.push(score);
      });

      // Build distribution
      const distribution: RFMDistribution[] = Array.from(segmentMap.entries()).map(
        ([segment, scores]) => {
          const customerCount = scores.length;
          const percentage = (customerCount / totalCustomers) * 100;
          const averageRevenue =
            scores.reduce((sum, s) => sum + s.totalSpent, 0) / customerCount;

          return {
            segment,
            customerCount,
            percentage: parseFloat(percentage.toFixed(2)),
            averageRevenue: parseFloat(averageRevenue.toFixed(2)),
          };
        }
      );

      // Sort by customer count descending
      distribution.sort((a, b) => b.customerCount - a.customerCount);

      logger.debug('RFM distribution calculated', {
        segmentCount: distribution.length,
      });

      return distribution;
    } catch (error) {
      logger.error('Error getting RFM distribution', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Get customer purchase data for RFM analysis
   * Private helper method
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to customer purchase data
   */
  private async getCustomerPurchaseData(
    filters: RFMFilters
  ): Promise<
    Array<{
      customerId: number;
      customerName: string;
      daysSinceLastPurchase: number;
      orderCount: number;
      totalSpent: number;
      lastPurchaseDate: Date;
    }>
  > {
    const { startDate, endDate, businessUnit } = filters;

    const whereClauses: string[] = ['p.data_pedido BETWEEN ? AND ?'];
    const params: any[] = [startDate, endDate];

    if (businessUnit !== 'all') {
      whereClauses.push('p.unidade_negocio = ?');
      params.push(businessUnit);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
      SELECT 
        c.id as customer_id,
        c.nome as customer_name,
        DATEDIFF(CURDATE(), MAX(p.data_pedido)) as days_since_last_purchase,
        COUNT(DISTINCT p.id) as order_count,
        SUM(p.valor_total) as total_spent,
        MAX(p.data_pedido) as last_purchase_date
      FROM clientes c
      INNER JOIN pedidos p ON c.id = p.cliente_id
      ${whereClause}
      GROUP BY c.id, c.nome
      HAVING order_count > 0
    `;

    const results = await this.db.query<any>(sql, params);

    return results.map((row) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      daysSinceLastPurchase: parseInt(row.days_since_last_purchase, 10),
      orderCount: parseInt(row.order_count, 10),
      totalSpent: parseFloat(row.total_spent),
      lastPurchaseDate: new Date(row.last_purchase_date),
    }));
  }

  /**
   * Calculate quintiles for a dataset
   * Returns the 5 quintile boundaries
   * 
   * @param values - Array of numeric values
   * @returns Array of quintile boundaries
   */
  private calculateQuintiles(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const quintiles: number[] = [];

    for (let i = 1; i <= 5; i++) {
      const index = Math.ceil((i / 5) * sorted.length) - 1;
      quintiles.push(sorted[index]);
    }

    return quintiles;
  }

  /**
   * Get quintile score (1-5) for a value based on quintile boundaries
   * 
   * @param value - Value to score
   * @param quintiles - Quintile boundaries
   * @returns Score from 1 to 5
   */
  private getQuintileScore(value: number, quintiles: number[]): number {
    for (let i = 0; i < quintiles.length; i++) {
      if (value <= quintiles[i]) {
        return i + 1;
      }
    }
    return 5;
  }

  /**
   * Classify customer into RFM segment based on R, F, M scores
   * Requirement 7.4, 7.5
   * 
   * Segment definitions:
   * - Champions: R=5, F=5, M=5 (best customers)
   * - Loyal: R>=4, F>=4 (high recency and frequency)
   * - Potential Loyal: R>=3, F>=3, M>=3 (good scores)
   * - Promising: R>=4, F<=2 (recent but low frequency)
   * - At Risk: R<=2, F>=3 (haven't purchased recently but used to)
   * - Hibernating: R<=2, F=2 (low activity)
   * - Lost: R=1, F=1 (inactive)
   * 
   * @param R - Recency score (1-5)
   * @param F - Frequency score (1-5)
   * @param M - Monetary score (1-5)
   * @returns RFM segment
   */
  private classifyRFMSegment(R: number, F: number, M: number): RFMSegment {
    // Champions: Best customers
    if (R === 5 && F === 5 && M === 5) {
      return 'champions';
    }

    // Loyal: High recency and frequency
    if (R >= 4 && F >= 4) {
      return 'loyal';
    }

    // Potential Loyal: Good all-around scores
    if (R >= 3 && F >= 3 && M >= 3) {
      return 'potential_loyal';
    }

    // Promising: Recent purchasers but low frequency
    if (R >= 4 && F <= 2) {
      return 'promising';
    }

    // At Risk: Used to buy frequently but haven't recently
    if (R <= 2 && F >= 3) {
      return 'at_risk';
    }

    // Hibernating: Low activity
    if (R <= 2 && F === 2) {
      return 'hibernating';
    }

    // Lost: Inactive customers
    return 'lost';
  }
}
