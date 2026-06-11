# Backend - Plataforma de Inteligência Comercial

API REST desenvolvida em Node.js + TypeScript para gerenciar análises de clientes e métricas comerciais.

## 🏗️ Arquitetura

```
src/
├── database/              # Gerenciamento de conexão MySQL
│   ├── DatabaseManager.ts
│   └── DatabaseManager.test.ts
│
├── services/             # Lógica de negócios
│   ├── CustomerService.ts
│   ├── DashboardService.ts
│   ├── OrderService.ts (a implementar)
│   ├── ProductService.ts (a implementar)
│   └── RFMService.ts (a implementar)
│
├── routes/              # Definição de endpoints
│   ├── clients.routes.ts
│   ├── dashboard.routes.ts
│   ├── products.routes.ts (a implementar)
│   └── exports.routes.ts (a implementar)
│
├── middleware/          # Validação e segurança
│   ├── validation.ts
│   └── validation.test.ts
│
├── types/              # Definições TypeScript
│   └── api.types.ts
│
├── utils/             # Utilitários
│   └── logger.ts
│
└── index.ts          # Ponto de entrada
```

## 🔧 Tecnologias

- **Express**: Framework web
- **MySQL2**: Driver MySQL com prepared statements
- **Express Validator**: Validação de dados
- **Winston**: Logging estruturado
- **Helmet**: Segurança HTTP
- **CORS**: Cross-Origin Resource Sharing
- **Compression**: Compressão gzip
- **ExcelJS**: Geração de Excel
- **CSV-Writer**: Geração de CSV
- **PDFKit**: Geração de PDF
- **Jest**: Framework de testes
- **TypeScript**: Tipagem estática

## 🚀 Scripts

```bash
# Desenvolvimento (hot reload)
npm run dev

# Build (compilar TypeScript)
npm run build

# Produção
npm start

# Testes
npm test
npm run test:watch

# Lint
npm run lint
```

## 📊 Camadas da Aplicação

### 1. **Database Layer** (database/)
- Gerencia pool de conexões MySQL
- Implementa prepared statements
- Gerencia transações
- Auto-reconnect configurado

### 2. **Service Layer** (services/)
- Contém a lógica de negócios
- Acessa o banco via DatabaseManager
- Retorna dados processados
- Calcula métricas e agregações

### 3. **Route Layer** (routes/)
- Define endpoints REST
- Aplica middlewares de validação
- Trata erros HTTP
- Retorna respostas formatadas

### 4. **Middleware Layer** (middleware/)
- Validação de entrada
- Sanitização de dados
- Tratamento de erros
- Headers de segurança

## 🔐 Segurança

- ✅ Prepared statements em todas as queries
- ✅ Validação de entrada com Express Validator
- ✅ Sanitização de dados
- ✅ Headers HTTP seguros (Helmet)
- ✅ CORS configurado
- ✅ Rate limiting (a implementar)
- ✅ Logs de erros e auditoria

## 📝 Padrões de Código

### Nomenclatura
- **Classes**: PascalCase (CustomerService)
- **Funções**: camelCase (getCustomers)
- **Constantes**: UPPER_SNAKE_CASE (DB_HOST)
- **Arquivos**: kebab-case (customer-service.ts)

### Estrutura de Resposta

**Sucesso:**
```typescript
{
  data: { ... },
  total?: number,
  page?: number,
  pages?: number
}
```

**Erro:**
```typescript
{
  error: {
    code: string,
    message: string,
    details?: any,
    timestamp: string
  }
}
```

## 🧪 Testes

### Executar Testes
```bash
npm test
```

### Estrutura de Testes
- Testes unitários para services
- Testes de integração para routes
- Mocks para DatabaseManager
- Coverage mínimo: 80%

## 📚 Exemplos de Uso

### Query com Filtros
```typescript
const customers = await customerService.getCustomers({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  businessUnit: 'ecommerce',
  page: 1,
  limit: 50
});
```

### Transação
```typescript
await db.transaction(async (conn) => {
  await conn.execute('UPDATE ...', []);
  await conn.execute('INSERT INTO ...', []);
});
```

## 🐛 Debug

### Ver Logs
```bash
# Tempo real
tail -f logs/combined.log

# Apenas erros
tail -f logs/error.log
```

### Modo Debug
```bash
LOG_LEVEL=debug npm run dev
```

## 📦 Dependências Principais

```json
{
  "express": "^4.18.2",
  "mysql2": "^3.6.5",
  "express-validator": "^7.0.1",
  "winston": "^3.11.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1"
}
```

## 🔄 Fluxo de Requisição

```
Cliente HTTP Request
    ↓
Express Middleware Stack
    ↓
Route Handler + Validation
    ↓
Service Layer (Business Logic)
    ↓
DatabaseManager (SQL Queries)
    ↓
MySQL Database
    ↓
Response ao Cliente
```

## 📈 Performance

- Connection pooling: 10 conexões máximas
- Timeout de query: 30 segundos
- Compressão gzip habilitada
- Cache de queries (a implementar)

## 🚧 TODO

- [ ] Implementar rate limiting
- [ ] Adicionar cache Redis
- [ ] Melhorar cobertura de testes
- [ ] Implementar health checks avançados
- [ ] Adicionar métricas Prometheus
- [ ] Implementar circuit breaker
- [ ] Adicionar APM (Application Performance Monitoring)
