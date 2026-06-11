import { DatabaseManager } from '../database/DatabaseManager';

export interface Customer {
  id: number;
  name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  businessUnit: string;
  firstPurchaseDate: Date | null;
  lastPurchaseDate: Date | null;
  totalOrders: number;
  totalSpent: number;
  averageTicket: number;
}

export interface CustomerFilters {
  startDate: string;
  endDate: string;
  businessUnit: 'ecommerce' | 'distributor' | 'all';
  page?: number;
  limit?: number;
}

export interface CustomerListResult {
  clients: Customer[];
  total: number;
  page: number;
  pages: number;
}

export class CustomerService {
  private db: DatabaseManager;

  constructor() {
    this.db = (global as any).dbManager;
  }

  async getCustomers(filters: CustomerFilters): Promise<CustomerListResult> {
    const { startDate, endDate, businessUnit, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    // Build business unit filter
    const businessUnitFilter =
      businessUnit === 'all'
        ? ['ecommerce', 'distributor']
        : [businessUnit];

    const query = `
      SELECT 
        c.id,
        c.nome as name,
        c.cpf,
        c.email,
        c.telefone as phone,
        c.whatsapp,
        c.cidade as city,
        c.estado as state,
        c.unidade_negocio as businessUnit,
        MIN(p.data_pedido) as firstPurchaseDate,
        MAX(p.data_pedido) as lastPurchaseDate,
        COUNT(DISTINCT p.id) as totalOrders,
        COALESCE(SUM(p.valor_total), 0) as totalSpent,
        COALESCE(AVG(p.valor_total), 0) as averageTicket
      FROM clientes c
      LEFT JOIN pedidos p ON c.id = p.cliente_id 
        AND p.data_pedido BETWEEN ? AND ?
      WHERE c.unidade_negocio IN (?)
      GROUP BY c.id
      HAVING totalOrders > 0
      ORDER BY totalSpent DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM clientes c
      INNER JOIN pedidos p ON c.id = p.cliente_id
      WHERE p.data_pedido BETWEEN ? AND ?
        AND c.unidade_negocio IN (?)
    `;

    try {
      const clients = await this.db.query<any>(query, [
        startDate,
        endDate,
        businessUnitFilter,
        limit,
        offset
      ]);

      const [countResult] = await this.db.query<any>(countQuery, [
        startDate,
        endDate,
        businessUnitFilter
      ]);

      const total = countResult.total || 0;
      const pages = Math.ceil(total / limit);

      return {
        clients: clients.map((c: any) => ({
          id: c.id,
          name: c.name,
          cpf: c.cpf,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp,
          city: c.city,
          state: c.state,
          businessUnit: c.businessUnit,
          firstPurchaseDate: c.firstPurchaseDate,
          lastPurchaseDate: c.lastPurchaseDate,
          totalOrders: c.totalOrders,
          totalSpent: Number(c.totalSpent),
          averageTicket: Number(c.averageTicket)
        })),
        total,
        page,
        pages
      };
    } catch (error) {
      throw new Error(`Failed to fetch customers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    const query = `
      SELECT 
        c.id,
        c.nome as name,
        c.cpf,
        c.email,
        c.telefone as phone,
        c.whatsapp,
        c.cidade as city,
        c.estado as state,
        c.unidade_negocio as businessUnit,
        MIN(p.data_pedido) as firstPurchaseDate,
        MAX(p.data_pedido) as lastPurchaseDate,
        COUNT(DISTINCT p.id) as totalOrders,
        COALESCE(SUM(p.valor_total), 0) as totalSpent,
        COALESCE(AVG(p.valor_total), 0) as averageTicket
      FROM clientes c
      LEFT JOIN pedidos p ON c.id = p.cliente_id
      WHERE c.id = ?
      GROUP BY c.id
    `;

    try {
      const [client] = await this.db.query<any>(query, [id]);

      if (!client) {
        return null;
      }

      return {
        id: client.id,
        name: client.name,
        cpf: client.cpf,
        email: client.email,
        phone: client.phone,
        whatsapp: client.whatsapp,
        city: client.city,
        state: client.state,
        businessUnit: client.businessUnit,
        firstPurchaseDate: client.firstPurchaseDate,
        lastPurchaseDate: client.lastPurchaseDate,
        totalOrders: client.totalOrders,
        totalSpent: Number(client.totalSpent),
        averageTicket: Number(client.averageTicket)
      };
    } catch (error) {
      throw new Error(`Failed to fetch customer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
