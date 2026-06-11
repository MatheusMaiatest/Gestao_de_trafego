/**
 * Type definitions for API requests and responses
 */

export interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface BusinessUnitFilter {
  businessUnit?: 'ecommerce' | 'distributor' | 'all';
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SearchParams {
  search?: string;
  q?: string;
  field?: 'name' | 'email' | 'phone' | 'cpf' | 'whatsapp' | 'order';
}

export type ClientSegment = 'recorrente' | 'inativo' | 'em_risco' | 'novo' | 'vip';

export type RFMSegment = 
  | 'champions'
  | 'loyal'
  | 'potential_loyal'
  | 'promising'
  | 'at_risk'
  | 'hibernating'
  | 'lost';

export type SegmentType = ClientSegment;

export interface ProductSortParams {
  sortBy?: 'quantity' | 'revenue';
  order?: 'asc' | 'desc';
  limit?: number;
}

export interface GeolocationParams {
  groupBy?: 'state' | 'city';
  states?: string[];
}

export interface ExportParams {
  format: 'xlsx' | 'csv' | 'pdf';
  filters?: any;
}
