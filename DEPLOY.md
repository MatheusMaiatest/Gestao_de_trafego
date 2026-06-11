# 🚀 Guia de Deploy - Render

## Passo a Passo Completo

### 1️⃣ Preparar o Repositório Git

```bash
# Inicializar Git (se ainda não foi feito)
git init

# Adicionar todos os arquivos
git add .

# Primeiro commit
git commit -m "Initial commit: Plataforma de Inteligência Comercial"

# Renomear branch para main
git branch -M main
```

### 2️⃣ Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Nome do repositório: `plataforma-inteligencia-comercial`
3. Deixe como **Private** (recomendado)
4. **NÃO** adicione README, .gitignore ou licença (já temos)
5. Clique em **"Create repository"**

### 3️⃣ Conectar e Enviar para GitHub

```bash
# Adicionar remote (substitua SEU-USUARIO pelo seu username)
git remote add origin https://github.com/SEU-USUARIO/plataforma-inteligencia-comercial.git

# Enviar código
git push -u origin main
```

### 4️⃣ Deploy no Render

#### Opção A: Blueprint (Recomendado - Ambos os serviços)

1. Acesse: https://dashboard.render.com/
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte sua conta GitHub (se ainda não conectou)
4. Selecione o repositório `plataforma-inteligencia-comercial`
5. O Render detectará automaticamente o `render.yaml`
6. Clique em **"Apply"**

#### Opção B: Manual (Backend + Frontend separados)

**Backend:**
1. Clique em **"New +"** → **"Web Service"**
2. Conecte o repositório
3. Configure:
   - **Name**: `inteligencia-comercial-api`
   - **Runtime**: `Node`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: `Free`

**Frontend:**
1. Clique em **"New +"** → **"Static Site"**
2. Conecte o mesmo repositório
3. Configure:
   - **Name**: `inteligencia-comercial-frontend`
   - **Publish Directory**: `./frontend`
   - **Build Command**: `echo "No build needed"`
   - **Plan**: `Free`

### 5️⃣ Configurar Variáveis de Ambiente no Render

No **Backend Service** → **Environment**:

```
DB_HOST=162.240.228.36
DB_PORT=3306
DB_USER=hawktec_alpha_log
DB_PASS=Alpha@3030
DB_NAME=hawktec_alpha-ecommerce
PORT=10000
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGIN=*
```

### 6️⃣ Aguardar Deploy

⏳ O Render levará ~5 minutos para:
- Instalar dependências
- Compilar TypeScript
- Iniciar serviços
- Verificar health checks

### 7️⃣ Testar o Deploy

**Health Check:**
```
https://inteligencia-comercial-api.onrender.com/health
```

**Dashboard KPIs:**
```
https://inteligencia-comercial-api.onrender.com/api/dashboard/kpis?startDate=2024-01-01&endDate=2024-12-31&businessUnit=all
```

**Frontend:**
```
https://inteligencia-comercial-frontend.onrender.com
```

### 8️⃣ Atualizar URL da API no Frontend (se necessário)

Se o frontend não conectar automaticamente, edite `frontend/index.html` linha 128:

```javascript
const API_URL = 'https://inteligencia-comercial-api.onrender.com/api';
```

Commit e push:

```bash
git add frontend/index.html
git commit -m "fix: atualizar URL da API"
git push origin main
```

---

## 🔄 Deploy Contínuo (Automático)

Após configuração inicial, cada push acionará deploy automático:

```bash
# 1. Fazer mudanças no código
git add .
git commit -m "feat: adicionar nova funcionalidade"

# 2. Push para GitHub
git push origin main

# 3. Render detecta e faz redeploy automático ✨
```

---

## ⚙️ Configurações Adicionais no Render

### Domínio Customizado

1. Service → **Settings** → **Custom Domain**
2. Adicione seu domínio
3. Configure DNS conforme instruções

### Auto-Deploy

1. Service → **Settings** → **Build & Deploy**
2. **Auto-Deploy**: `Yes` (ativado por padrão)
3. **Branch**: `main`

### Health Check Path

1. Service → **Settings** → **Health & Alerts**
2. **Health Check Path**: `/health`
3. **Health Check Timeout**: `30 seconds`

### Logs

1. Service → **Logs** (menu lateral)
2. Ver logs em tempo real
3. Filtrar por nível (info, error, warn)

---

## 🐛 Troubleshooting

### Deploy Falhou

**Erro:** `Command failed: npm install`
```bash
# Solução: Verifique package.json está correto
# Teste localmente:
cd backend
npm install
```

**Erro:** `Module not found`
```bash
# Solução: Verifique importações TypeScript
# Build local:
cd backend
npm run build
```

### Backend Não Inicia

**Erro:** `Database configuration incomplete`
```
Solução: Verifique as variáveis de ambiente no Render:
- DB_HOST
- DB_USER
- DB_PASS
- DB_NAME
- DB_PORT
```

**Erro:** `Port already in use`
```
Solução: Render define PORT automaticamente
Não defina PORT=3001 no .env do Render
```

### Frontend Não Conecta

**Erro:** `CORS error` ou `Network error`
```
Solução:
1. Verifique ALLOWED_ORIGIN=* no backend
2. Atualize URL da API no frontend (linha 128)
3. Teste health check: https://seu-backend.onrender.com/health
```

### Serviço Lento na Primeira Requisição

⚠️ **Planos Free do Render "dormem" após 15min de inatividade**

Solução: Upgrade para plano pago ou aguarde ~30s na primeira requisição

---

## 📊 Monitoramento

### Métricas Disponíveis (Render Dashboard)

- CPU Usage
- Memory Usage
- Response Time
- Request Count
- Error Rate

### Alertas

Configure em: Service → **Settings** → **Alerts**

---

## 🔐 Segurança

### ❌ Nunca Commitar:

- ✅ `.env` está no .gitignore
- ✅ Credenciais do banco
- ✅ API keys
- ✅ Tokens de autenticação

### ✅ Sempre:

- Use variáveis de ambiente no Render
- Ative HTTPS (automático no Render)
- Mantenha dependências atualizadas

---

## 📝 Checklist Final

Antes de fazer deploy, verifique:

- [ ] `.env` está no .gitignore
- [ ] `render.yaml` está configurado
- [ ] Banco MySQL está acessível pela internet
- [ ] Testes passam localmente (`npm test`)
- [ ] Build funciona localmente (`npm run build`)
- [ ] README.md está atualizado
- [ ] Commit inicial foi feito
- [ ] Repositório foi criado no GitHub
- [ ] Código foi enviado (`git push`)

---

## 🎉 Deploy Completo!

Acesse seus serviços:

- 📊 **Frontend**: https://inteligencia-comercial-frontend.onrender.com
- 🔌 **API**: https://inteligencia-comercial-api.onrender.com
- 💚 **Health**: https://inteligencia-comercial-api.onrender.com/health

---

**Documentação Render**: https://render.com/docs  
**Support**: https://render.com/support
