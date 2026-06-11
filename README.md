# 📊 Plataforma de Inteligência Comercial e Tráfego Pago

Sistema web full-stack para análise de clientes e suporte a decisões de marketing digital. Backend Node.js + Express conectado ao MySQL, frontend responsivo em HTML/CSS/JS.

## 🚀 Deploy no Render

### 1️⃣ Preparar Repositório Git

```bash
git init
git add .
git commit -m "Initial commit: Plataforma de Inteligência Comercial"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repo.git
git push -u origin main
```

### 2️⃣ Conectar no Render

1. Acesse: https://dashboard.render.com/
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte seu repositório GitHub
4. O Render detectará o arquivo `render.yaml` automaticamente

### 3️⃣ Configurar Variáveis de Ambiente

No dashboard do Render, configure:

```
DB_HOST=162.240.228.36
DB_PORT=3306
DB_USER=hawktec_alpha_log
DB_PASS=Alpha@3030
DB_NAME=hawktec_alpha-ecommerce
```

### 4️⃣ Deploy Automático

✅ O Render fará deploy automático a cada push no branch `main`  
✅ Backend: `https://inteligencia-comercial-api.onrender.com`  
✅ Frontend: `https://inteligencia-comercial-frontend.onrender.com`

---

## 📁 Estrutura do Projeto

```
TRÁFEGO/
├── backend/                    # Servidor Node.js + Express
│   ├── src/                   # Código TypeScript
│   │   ├── database/          # MySQL connection pool
│   │   ├── services/          # Lógica de negócios
│   │   ├── routes/            # API endpoints
│   │   ├── middleware/        # Validação
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Logger
│   │   └── index.ts           # Servidor principal
│   ├── dist/                  # Código compilado
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                  # Interface web
│   └── index.html             # Dashboard SPA
│
├── render.yaml                # Configuração Render
├── .gitignore                 # Arquivos ignorados
├── .env.example               # Template de configuração
└── README.md                  # Este arquivo
```

## 🛠️ Tecnologias

### Backend
- **Node.js 18+** + **Express** + **TypeScript**
- **MySQL2** (prepared statements)
- **Express Validator** (validação)
- **Winston** (logging)
- **Helmet** (segurança)
- **CORS** + **Compression**

### Frontend
- **HTML5** + **CSS3** + **JavaScript** (Vanilla)
- Interface responsiva
- Integração REST API

## 🔧 Desenvolvimento Local

### Backend

```bash
cd backend
npm install
npm run dev     # Desenvolvimento (hot reload)
npm run build   # Compilar TypeScript
npm start       # Produção
npm test        # Testes
```

### Frontend

Abra `frontend/index.html` no navegador ou use um servidor local:

```bash
# Python
cd frontend
python -m http.server 8000

# Node.js
npx http-server frontend -p 8000
```

Acesse: `http://localhost:8000`

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Dashboard KPIs
```http
GET /api/dashboard/kpis?startDate=2024-01-01&endDate=2024-12-31&businessUnit=all
```

**Response:**
```json
{
  "period": { "startDate": "2024-01-01", "endDate": "2024-12-31" },
  "businessUnit": "all",
  "totalClients": 1250,
  "activeClients": 890,
  "inactiveClients": 360,
  "newClients": 120,
  "totalRevenue": 485000.50,
  "averageTicket": 545.06,
  "totalOrders": 890,
  "averagePurchaseFrequency": 1.00
}
```

### Clientes
```http
GET /api/clients?startDate=2024-01-01&endDate=2024-12-31&businessUnit=all&page=1&limit=50
GET /api/clients/:id
```

## 🔒 Segurança

✅ Prepared statements (SQL injection prevention)  
✅ Input validation (Express Validator)  
✅ Helmet (HTTP headers seguros)  
✅ CORS configurado  
✅ Rate limiting (a implementar)  

## 📊 Funcionalidades

### ✅ Implementadas
- Dashboard com 8 KPIs principais
- Lista de clientes paginada
- Detalhes do cliente
- Filtros por data e unidade de negócio
- Busca de clientes
- Métricas calculadas
- Logging estruturado

### 🚧 A Implementar
- Análise RFM
- Segmentação automática
- Exportação (Excel, CSV, PDF)
- Análise de produtos
- Geolocalização
- Métricas de campanhas
- Alertas de clientes em risco

## 🐛 Troubleshooting

### Erro no Deploy
```
Verifique os logs no Render Dashboard
Confirme que todas as variáveis de ambiente estão configuradas
```

### Frontend não conecta à API
```
Verifique a variável ALLOWED_ORIGIN no backend
Use a URL completa do backend no frontend
```

### Banco de dados não conecta
```
Confirme que o IP do Render está liberado no MySQL
Verifique as credenciais no .env
```

## 📝 Scripts NPM

```bash
npm start          # Iniciar servidor (produção)
npm run dev        # Desenvolvimento (hot reload)
npm run build      # Compilar TypeScript
npm test           # Executar testes
npm run lint       # Verificar código
```

## 🔄 Workflow Git + Render

```bash
# 1. Fazer alterações
git add .
git commit -m "feat: adicionar nova funcionalidade"

# 2. Push para GitHub
git push origin main

# 3. Render detecta e faz deploy automático ✨
```

## 📦 Variáveis de Ambiente

### Backend (.env)
```env
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASS=your-db-password
DB_NAME=your-db-name
PORT=10000
ALLOWED_ORIGIN=*
LOG_LEVEL=info
NODE_ENV=production
```

## 🎯 Monitoramento

- **Health Check**: `https://your-api.onrender.com/health`
- **Logs**: Render Dashboard → Service → Logs
- **Métricas**: Render Dashboard → Service → Metrics

## 📚 Documentação Adicional

- `backend/README.md` - Documentação técnica do backend
- `frontend/README.md` - Documentação do frontend
- `.kiro/specs/` - Especificações e design do sistema

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'feat: adicionar funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Proprietary - Todos os direitos reservados

---

**🚀 Deploy Status:** [![Render Status](https://img.shields.io/badge/render-deployed-success)](https://dashboard.render.com/)

**Versão:** 1.0.0  
**Última atualização:** Junho 2024
