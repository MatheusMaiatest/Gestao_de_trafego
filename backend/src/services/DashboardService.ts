import { DatabaseManager } from '../database/DatabaseManager';

export interface DashboardKPIs {
  period: {
    startDate: string;
    endDate: string;
  };
  businessUnit: string;
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  newClients: number;
  totalRevenue: number;
  averageTicket: number;
  totalOrders: number;
  averagePurchaseFrequency: number;
}

export class DashboardService {
  private db: DatabaseManager;

  constructor() {
    this.db = (global as any).dbManager;
  }

  async getKPIs(
    startDate: string,
    endDate: string,
    businessUnit: 'ecommerce' | 'distributor' | 'all'
  ): Promise<DashboardKPIs> {
    // Build business unit filter
    const businessUnitFilter =
      businessUnit === 'all'
        ? ['ecommerce', 'distributor']
        : [businessUnit];

    // Total clients with orders in period
    const totalClientsQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes c
      INNER JOIN pedidos p ON c.id = p.cliente_id
      WHERE p.data_pedido BETWEEN ? AND ?
        AND p.unidade_negocio IN (?)
    `;

    // Active clients (purchased in period)
    const activeClientsQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes c
      INNER JOIN pedidos p ON c.id = p.cliente_id
      WHERE p.data_pedido BETWEEN ? AND ?
        AND p.unidade_negocio IN (?)
    `;

    // Inactive clients (no purchase in last 90 days)
    const inactiveClientsQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes c
      LEFT JOIN pedidos p ON c.id = p.cliente_id
        AND p.data_pedido >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      WHERE p.id IS NULL
        AND c.unidade_negocio IN (?)
    `;

    // New clients (first purchase in period)
    const newClientsQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes c
      INNER JOIN (
        SELECT cliente_id, MIN(data_pedido) as primeira_compra
        FROM pedidos
        WHERE unidade_negocio IN (?)
        GROUP BY cliente_id
      ) primeira ON c.id = primeira.cliente_id
      WHERE primeira.primeira_compra BETWEEN ? AND ?
    `;

    // Revenue and orders
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(valor_total), 0) as totalRevenue,
        COUNT(*) as totalOrders,
        COALESCE(AVG(valor_total), 0) as averageTicket
      FROM pedidos
      WHERE data_pedido BETWEEN ? AND ?
        AND unidade_negocio IN (?)
    `;

    try {
      const [totalClientsResult] = await this.db.query(totalClientsQuery, [
        startDate,
        endDate,
        businessUnitFilter
      ]);

      const [activeClientsResult] = await this.db.query(activeClientsQuery, [
        startDate,
        endDate,
        businessUnitFilter
      ]);

      const [inactiveClientsResult] = await this.db.query(inactiveClientsQuery, [
        businessUnitFilter
      ]);

      const [newClientsResult] = await this.db.query(newClientsQuery, [
        businessUnitFilter,
        startDate,
        endDate
      ]);

      const [revenueResult] = await this.db.query(revenueQuery, [
        startDate,
        endDate,
        businessUnitFilter
      ]);

      const totalClients = (totalClientsResult as any).total || 0;
      const activeClients = (activeClientsResult as any).total || 0;
      const inactiveClients = (inactiveClientsResult as any).total || 0;
      const newClients = (newClientsResult as any).total || 0;
      const totalRevenue = Number((revenueResult as any).totalRevenue) || 0;
      const totalOrders = (revenueResult as any).totalOrders || 0;
      const averageTicket = Number((revenueResult as any).averageTicket) || 0;
      const averagePurchaseFrequency = activeClients > 0 ? totalOrders / activeClients : 0;

      return {
        period: {
          startDate,
          endDate
        },
        businessUnit,
        totalClients,
        activeClients,
        inactiveClients,
        newClients,
        totalRevenue,
        averageTicket,
        totalOrders,
        averagePurchaseFrequency: Number(averagePurchaseFrequency.toFixed(2))
      };
    } catch (error) {
      throw new Error(`Failed to calculate KPIs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
