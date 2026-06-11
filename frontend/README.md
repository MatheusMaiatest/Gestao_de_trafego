# Frontend - Plataforma de Inteligência Comercial

Interface web responsiva para visualização de dados e métricas comerciais.

## 🎨 Características

- ✅ Interface moderna e responsiva
- ✅ Cards de KPIs animados
- ✅ Tabela de clientes com paginação
- ✅ Filtros interativos (data, unidade de negócio)
- ✅ Formatação automática de valores (moeda brasileira)
- ✅ Feedback visual de loading e erros
- ✅ Design gradient (roxo/azul)

## 🖥️ Como Usar

### Opção 1: Abrir Diretamente
```
Clique duplo em: index.html
```

### Opção 2: Servidor Local (Recomendado)

**Python 3:**
```bash
python -m http.server 8000
```

**Node.js (http-server):**
```bash
npx http-server -p 8000
```

**PHP:**
```bash
php -S localhost:8000
```

Acesse: http://localhost:8000

## 📱 Responsividade

- 📱 Mobile: 320px - 767px
- 💻 Tablet: 768px - 1023px
- 🖥️ Desktop: 1024px+

## 🎯 Funcionalidades

### Dashboard
- 8 KPIs principais
- Atualização dinâmica por filtros
- Animações hover

### Filtros
- **Data**: Período personalizado (início/fim)
- **Unidade**: Todos / E-commerce / Distribuidor
- **Paginação**: 50 registros por página

### Tabela de Clientes
- Colunas: Nome, Email, Telefone, WhatsApp, Cidade, Estado, Pedidos, Valor Total, Ticket Médio
- Ordenação por valor gasto (decrescente)
- Paginação interativa

## 🎨 Personalização

### Cores Principais
```css
--primary-purple: #667eea
--secondary-purple: #764ba2
--hover-color: #5568d3
--error-red: #ff5252
```

### Fonte
```css
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
```

## 🔧 Configuração

### Alterar URL da API
```javascript
// Linha 125 em index.html
const API_URL = 'http://localhost:3001/api';
```

### Período Padrão
```javascript
// Linha 130-133
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30); // Altere aqui
```

## 📊 Estrutura HTML

```html
<header>
  - Título
  - Filtros (data, unidade de negócio)
  - Botão buscar
</header>

<div id="dashboard">
  - Cards de KPIs (grid responsivo)
</div>

<div id="clientsTable">
  - Título
  - Tabela de clientes
  - Paginação
</div>
```

## 🎭 Estados da Interface

### Loading
```
Exibe: "Carregando dados..."
Oculta: Dashboard e tabela
```

### Erro
```
Exibe: Banner vermelho com mensagem
Oculta: Dashboard e tabela
```

### Sucesso
```
Exibe: Dashboard + Tabela preenchidos
Oculta: Loading e erro
```

## 🚀 Próximas Implementações

- [ ] Gráficos com Chart.js/Recharts
- [ ] Exportação de dados
- [ ] Busca de clientes
- [ ] Detalhes do cliente (modal)
- [ ] Tema escuro
- [ ] PWA (Progressive Web App)
- [ ] Notificações push
- [ ] Offline mode
- [ ] Multi-idioma

## 🐛 Troubleshooting

### CORS Error
```
Certifique-se que o backend está configurado com:
ALLOWED_ORIGIN=*
```

### API não responde
```
Verifique se o backend está rodando:
http://localhost:3001/health
```

### Dados não carregam
```
1. Abra DevTools (F12)
2. Vá na aba Console
3. Verifique erros de rede
4. Verifique se as datas são válidas
```

## 📝 Melhorias Futuras

### Performance
- Implementar virtual scrolling
- Lazy loading de imagens
- Service Workers para cache
- Minificação de assets

### UX
- Skeleton loading
- Animações de transição
- Feedback tátil (mobile)
- Tour guiado (onboarding)

### Acessibilidade
- ARIA labels completos
- Navegação por teclado
- Suporte para leitores de tela
- Contraste de cores WCAG AA

## 🔒 Segurança

- Sanitização de dados antes de exibir
- Escape de HTML
- Validação de entrada
- HTTPS obrigatório em produção

## 📦 Build para Produção

### Minificação
```bash
# HTML
html-minifier index.html -o index.min.html

# CSS (já inline)
cssnano

# JS (já inline)
terser
```

### Deploy
```bash
# GitHub Pages
# Vercel
# Netlify
# Render (Static Site)
```

---

**Versão:** 1.0.0  
**Compatibilidade:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
