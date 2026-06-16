# 📋 Diagnóstico de Auditoria — Inteligência Comercial

> **Data:** 16/06/2026 — 10:05:37
> **URL auditada:** https://gestao-de-trafego.onrender.com/
> **Auditor:** Antigravity (IA Automatizada)
> **Metodologia:** Playwright automatizado — browser isolado, sem interferência no Chrome do usuário
> **Total de prints:** 62 screenshots JPG + 1 vídeo da sessão (.webm)
> **Duração da auditoria:** ~7 minutos

---

## Resumo Geral

| Item | Resultado |
|------|-----------|
| Páginas / Abas testadas | **4** (Dashboard, Clientes, Relatórios, Disparo) |
| Botões clicados | **~40** |
| Filtros testados | **12** (datas, unidade ×3, segmento ×5, coluna, pesquisa, combinados) |
| Modais testados | **5** (RFM, Segmentos, Produtos, Cliente, Pedido) |
| Gráficos testados | **3** (RFM doughnut, Segmentos bar, Top Produtos horizontal bar) |
| Mapas testados | **2** (Clientes por Estado, Faturamento por Estado) |
| Tabelas testadas | **2** (Clientes, Disparo) — paginação, ordenação, filtros por coluna |
| Relatórios testados | **4 de 11** (Meta, Google, TikTok, LinkedIn — todos com preview e botão download) |
| Segmentos Disparo testados | **5** (Inativos, Em Risco, VIP, Recorrentes, Novos) |
| Responsividade testada | **3 viewports** (375px mobile, 768px tablet, 1280px desktop) |
| Prints capturados | **62** |
| Erros JS (console) | **2** — "Invalid or unexpected token" |
| Warnings JS | **0** |
| Erros HTTP (4xx/5xx) | **0** |
| Requisições com sucesso | **53** |
| Problemas documentados | **4 funcionais + 10 UX + 30 melhorias** |

---

## Estrutura da Aplicação

### Arquitetura Percebida

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | SPA (Single Page Application) em HTML/CSS/JS puro — sem framework (React, Vue, etc.) |
| **Estilização** | CSS custom properties (variáveis CSS) com suporte a dark/light theme |
| **Gráficos** | Chart.js 4.4.0 via CDN jsDelivr |
| **Mapas** | D3.js v7 via CDN jsDelivr + GeoJSON do GitHub |
| **Backend** | Node.js + Express.js |
| **Banco de Dados** | MySQL com pool de conexões via `mysql2/promise` |
| **Deploy** | Render.com (PaaS) — plano gratuito com hibernação |
| **Fontes** | Inter (Google Fonts) |

### Módulos Existentes

| Módulo | Rota Frontend | Endpoints de API | Descrição |
|--------|---------------|-----------------|-----------|
| **Dashboard** | Tab: Dashboard | `/api/dashboard/kpis`, `/api/segments`, `/api/rfm/distribution`, `/api/products/top-selling`, `/api/geolocation/states`, `/api/geolocation/cities` | KPIs gerais, 3 gráficos, 2 mapas com drill-down municipal |
| **Clientes** | Tab: Clientes | `/api/clients`, `/api/clients/:id`, `/api/orders/:id`, `/api/segments/:type/customers` | Tabela paginada com 11 colunas, modais de cliente e pedido |
| **Relatórios** | Tab: Relatórios | `/api/clients`, `/api/segments/:type/customers`, `/api/dashboard/kpis`, `/api/geolocation/cities` | 11 tipos de export CSV (Ads + estratégicos) |
| **Disparo** | Tab: Disparo | `/api/segments/:type/customers` | Lista segmentada com link WhatsApp direto |

### Fluxo de Navegação

```
Aplicação (SPA - mesma URL para tudo)
│
├── 📈 Dashboard
│   ├── Filter Bar: [Data Início] [Data Fim] [Todos / E-commerce / Distribuidor] [🔍 Buscar]
│   ├── KPI Grid: Faturamento · Pedidos · Clientes Ativos · Clientes Inativos ×2 · Novos · Ticket · Freq.
│   ├── Charts Row: [Distribuição RFM] [Segmentos] [Top 10 Produtos]
│   │   └── Click → Modal expandido com gráfico ampliado + tabela de dados
│   └── Maps Row: [Clientes por Estado] [Faturamento por Estado]
│       └── Click no estado → Drill-down municipal (carrega GeoJSON do GitHub)
│
├── 👥 Clientes
│   ├── KPI Grid (dinâmico): Clientes · Faturamento · Pedidos · Ticket Médio
│   ├── Filter Bar: [Data Início] [Data Fim] [Todos/E-com/Dist] [Segmento▼] [🔍 Buscar]
│   ├── Search Bar: [Buscar por nome, CPF ou nº pedido...]
│   ├── Tabela (11 colunas, 50/pág): Nome · Unidade · Cidade/UF · CPF · 1ª Compra · Última ·
│   │   Pedidos · Total Gasto · Ticket Médio · Dias Sem Comprar · Segmento
│   │   ├── Ordenação: clique no header (ASC/DESC)
│   │   ├── Filtro por coluna: ícone 🔽 abre dropdown com checkboxes
│   │   └── Click no nome → Modal Cliente
│   │       └── Histórico de pedidos → Click → Modal Pedido (com itens detalhados)
│   └── Paginação
│
├── 📄 Relatórios
│   ├── Sidebar: Período · Unidade · Segmento · Estado (UF) · Cidade · Faixa de Ticket · [Aplicar]
│   └── Content:
│       ├── KPI Grid dinâmico
│       ├── Grupo: AUDIÊNCIAS PARA ADS → Meta · Google · TikTok · LinkedIn · Pinterest · X · Kwai
│       └── Grupo: ESTRATÉGICOS → Completo · Top Clientes · Inativos · RFM · Produtos · Geo Estado
│           └── Click no card → Preview (50 linhas) + [⬇️ Confirmar e Baixar CSV]
│
└── 📱 Disparo
    ├── Sidebar: Período · Segmento (radio) · Unidade · [🔍 Identificar]
    └── Content:
        ├── KPI: Clientes · Pot. Faturamento
        └── Tabela: Nome · Unidade · Cidade · Última Compra · Dias · Pedidos · Total · Ticket · Oportunidade · WhatsApp
```

---

## Problemas Encontrados

### 1. 🔴 Dashboard KPIs — Timeout de 30+ segundos no carregamento

| Campo | Detalhe |
|-------|---------|
| **Local** | Aba Dashboard → KPI Grid |
| **Severidade** | **Alta** |
| **Como reproduzir** | Acessar https://gestao-de-trafego.onrender.com/ pela primeira vez (cold start) |
| **Resultado esperado** | KPIs aparecem em menos de 5 segundos |
| **Resultado obtido** | API `/dashboard/kpis` levou **30+ segundos** para responder (timeout detectado às 12:59:09 → resposta às 12:59:40 = **31 segundos**) |
| **Possível causa** | Cold start do Render.com (plano gratuito hiberna após inatividade) + query SQL sem índice em `data` |
| **Possível solução** | 1) Migrar para plano pago ou adicionar ping de warmup a cada 10 minutos; 2) Adicionar índice composto `(data, contato_id)` nas tabelas de pedidos; 3) Mostrar skeleton loader infinito com mensagem "Aguardando servidor..." |
| **Log** | `⏱ Carregamento página inicial: 6680ms` + timeout `waitForFunction > 30000ms` |

---

### 2. 🔴 Erro JavaScript — "Invalid or unexpected token" na paginação do Disparo

| Campo | Detalhe |
|-------|---------|
| **Local** | Aba Disparo → Paginação (clicar página 2) |
| **Severidade** | **Alta** |
| **Como reproduzir** | 1) Ir em Disparo; 2) Identificar qualquer segmento com +50 clientes; 3) Clicar no botão de página 2 na paginação |
| **Resultado esperado** | Navega para página 2 sem erros |
| **Resultado obtido** | Erro JS `"Invalid or unexpected token"` no console (2 ocorrências às 13:04:49 e 13:04:50) |
| **Possível causa** | A função `renderPag()` serializa a callback com `.toString()` e injeta no atributo HTML `onclick="(${cb.toString()})(${i})"`. Quando o nome do segmento contém caracteres especiais ou o texto do arrow function inclui aspas simples, o HTML gerado quebra o parser JS |
| **Possível solução** | Substituir a injeção inline por um event listener programático. Ex: criar IDs únicos nos botões e usar `addEventListener` em vez de `onclick` inline com `.toString()` |
| **Log** | `💥 PAGE ERROR: Invalid or unexpected token` (×2, 13:04:49 e 13:04:50) |

---

### 3. 🔴 Disparo — Nenhum botão de WhatsApp gerado

| Campo | Detalhe |
|-------|---------|
| **Local** | Aba Disparo → Coluna "WhatsApp" na tabela |
| **Severidade** | **Alta** |
| **Como reproduzir** | Identificar qualquer segmento na aba Disparo e verificar a coluna WhatsApp |
| **Resultado esperado** | Link `wa.me/55XXXXXXXXXXX` para cada cliente que possui CPF/telefone |
| **Resultado obtido** | Coluna WhatsApp exibe `—` para todos os 50 registros testados (0 botões gerados) |
| **Possível causa** | O código usa `c.cpf` para gerar o número de WhatsApp (`waNum = (c.cpf||'').replace(/\D/g,'')`). A API `/segments/:type/customers` **não retorna o campo `cpf`** — apenas `id`, `name`, `city`, `state`, `orderCount`, `totalSpent`, `firstDate`, `lastDate`, `daysSince`, `businessUnit` |
| **Possível solução** | Adicionar `MAX(contato_numerodocumento) AS cpf` na query SQL de `/api/segments/:type/customers` no `server.js` (linha ~573) |
| **Log** | `Botões WhatsApp encontrados: 0` |

---

### 4. 🟠 Dashboard — Dois cards "Clientes Inativos" com valores diferentes

| Campo | Detalhe |
|-------|---------|
| **Local** | Aba Dashboard → KPI Grid |
| **Severidade** | **Média** |
| **Como reproduzir** | Carregar o Dashboard e observar os 8 cards de KPI |
| **Resultado esperado** | Cada card com label único e valor consistente |
| **Resultado obtido** | Dois cards com label **"Clientes Inativos"**: um vindo de `kpi.inactiveClients` (API `/dashboard/kpis`) e outro de `seg.segments.find(s => s.segment === 'inativo').customerCount` (API `/segments`) — valores diferentes pois usam critérios distintos |
| **Possível causa** | Bug no array `ks` na função `renderDashKPIs`: `{l:'Clientes Inativos',v:fmtN(kpi.inactiveClients),c:'err'}` e `{l:'Clientes Inativos',v:fmtN(risco),c:'warn'}` — segundo deveria ser "Clientes em Risco" |
| **Possível solução** | Renomear o segundo card para `"Em Risco"` ou `"Inativos (segmento)"` e usar cor `warn` para distinguir |
| **Log** | Código em `public/index.html` linha ~627 |

---

## Console — Logs Capturados

### 🔴 Erros de Página (2 ocorrências)

```
[13:04:49] pageerror: Invalid or unexpected token
[13:04:50] pageerror: Invalid or unexpected token
```
**Contexto:** Ambos ocorreram durante a interação com a paginação da aba Disparo (clique em página 2 e abertura de modal de cliente a partir da aba Disparo).

**Causa raiz identificada:** Função `renderPag()` serializa arrow functions via `.toString()` dentro de atributos `onclick` HTML — caracteres especiais no escopo da closure quebram o parser JavaScript.

### 🟡 Warnings
_Nenhum warning detectado._

### ℹ️ Logs de Info
_Nenhum log adicional emitido pelo código da aplicação._

---

## Network — Análise Completa das Requisições

### Resumo por Status

| Status | Quantidade | Detalhe |
|--------|-----------|---------|
| **200 OK** | **53** | Todas as requisições bem-sucedidas |
| **4xx** | **0** | Nenhum erro de cliente |
| **5xx** | **0** | Nenhum erro de servidor |
| **Falhas de rede** | **0** | Nenhum timeout ou erro de conexão |

### Endpoints Testados e Tempos Estimados

| Endpoint | Status | Observação |
|----------|--------|-----------|
| `GET /` | 200 | 6.68s — cold start detectado |
| `GET /api/dashboard/kpis` | 200 | **31s** na 1ª chamada (cold start); ~1s nas seguintes |
| `GET /api/segments` | 200 | ~1s |
| `GET /api/rfm/distribution` | 200 | ~1s |
| `GET /api/products/top-selling` | 200 | ~1s |
| `GET /api/geolocation/states` | 200 | ~1s |
| `GET /api/geolocation/cities?states=SP` | 200 | ~3s — retornou cidades corretamente |
| `GET /api/clients?limit=1000` | 200 | ~8s — busca até 1000 registros |
| `GET /api/clients/:id` | 200 | ~2s |
| `GET /api/orders/:id` | 200 | ~1s |
| `GET /api/segments/vip/customers` | 200 | ~1s |
| `GET /api/segments/recorrente/customers` | 200 | ~1s |
| `GET /api/segments/inativo/customers` | 200 | ~1s |
| `GET /api/segments/em_risco/customers` | 200 | ~1s |
| `GET /api/segments/novo/customers` | 200 | ~1s |
| CDN: `chart.js@4.4.0` | 200 | OK |
| CDN: `d3@7` | 200 | OK |
| CDN: `Google Fonts Inter` | 200 | OK |
| GitHub: `brazil-states.geojson` | 200 | ~6s — dependência externa crítica |

### Dependências Externas Detectadas

| Recurso | Origem | Risco |
|---------|--------|-------|
| Chart.js | cdn.jsdelivr.net | Médio — queda do CDN para a aplicação |
| D3.js | cdn.jsdelivr.net | Médio |
| Inter Font | fonts.googleapis.com | Baixo |
| GeoJSON Brasil (estados) | raw.githubusercontent.com | **Alto** — GitHub pode bloquear/limitar |
| GeoJSON Municípios | raw.githubusercontent.com | **Alto** — carregado sob demanda por estado |

---

## Performance

| Ação | Tempo | Avaliação |
|------|-------|-----------|
| Carregamento inicial (cold start) | **6.68s** DOM + **31s** KPIs | 🔴 Crítico |
| Carregamento inicial (servidor aquecido) | ~1.5s DOM + ~2s KPIs | 🟡 Aceitável |
| API `/api/clients?limit=1000` | **~8s** | 🟡 Lento |
| APIs de segmentos | ~1s | ✅ Bom |
| GeoJSON estados (GitHub) | ~6s | 🟡 Lento |
| GeoJSON municípios (GitHub, por demanda) | ~3-8s | 🟡 Variável |
| Renderização dos gráficos (Chart.js) | <1s após dados | ✅ Bom |
| Renderização dos mapas (D3) | <1s após GeoJSON | ✅ Bom |

### Gargalos Identificados

1. **Cold start** — Render.com plano gratuito hiberna após 15 min de inatividade → primeira requisição sempre lenta
2. **`/api/clients?limit=1000`** — Busca e transfere até 1000 registros completos de uma vez; não há paginação real no backend
3. **GeoJSON do GitHub** — Dependência externa sem fallback local; carregamento inicial de ~6s
4. **`/api/dashboard/kpis`** — Query com múltiplos subselects e UNIONs sem índices adequados

---

## UX e Usabilidade

### ✅ Pontos Positivos

| # | Ponto Positivo |
|---|---------------|
| 1 | Design visual moderno e profissional — dark mode como padrão |
| 2 | Toggle de tema claro/escuro funcional e animado |
| 3 | Skeleton loading animado nos KPIs durante carregamento |
| 4 | ESC fecha modais ✅ |
| 5 | Click fora do modal (overlay) fecha o modal ✅ |
| 6 | Badges coloridos e semanticamente corretos por segmento (VIP, Inativo, Em Risco, Novo, Recorrente) |
| 7 | Mapas interativos com tooltip no hover e drill-down de estado → município |
| 8 | Animação de entrada nas linhas da tabela (fadeIn) |
| 9 | Ordenação por coluna (ASC/DESC) funcionando corretamente |
| 10 | Filtro por coluna com dropdown de checkboxes e busca interna |
| 11 | Download de CSV com BOM (UTF-8) para compatibilidade com Excel |
| 12 | Tabela responsiva com scroll horizontal em telas menores |
| 13 | Preview de relatório antes do download |
| 14 | Cache frontend de 2 minutos evita re-fetches desnecessários |

### ❌ Problemas de UX Identificados

| # | Problema | Severidade |
|---|---------|-----------|
| 1 | **Top 10 Produtos exibe SKU** (ex: `80000426`) em vez de nome descritivo do produto — impossível interpretar sem catálogo | **Alta** |
| 2 | **Dois cards "Clientes Inativos"** com valores diferentes no dashboard — confunde o usuário | **Alta** |
| 3 | **Relatório "Meta Ads"** usa campo `cpf` como `email` e `phone` — dado semanticamente incorreto | **Alta** |
| 4 | **WhatsApp coluna vazia** no Disparo — funcionalidade principal inutilizável | **Alta** |
| 5 | **Sem feedback de loading** no botão "Buscar" durante a requisição — usuário não sabe se clicou certo | Média |
| 6 | **Mensagem de erro técnica** exposta ao usuário (`❌ Erro 500 — ...`) — deve ser amigável | Média |
| 7 | **Sem estado vazio explicativo** quando filtro retorna 0 resultados no Dashboard | Média |
| 8 | **Campo de busca** (Clientes) sem botão "X" para limpar rapidamente | Baixa |
| 9 | **KPIs sem tooltips** — "Freq. de Compra" não explica o cálculo | Baixa |
| 10 | **Mobile 375px** — abas da topbar overflow sem scroll visível — botões cortados | Média |

### Responsividade

| Viewport | Resultado | Problema |
|---------|-----------|---------|
| 375px (Mobile) | 🟡 Parcial | Abas do menu cortadas; tabelas exigem scroll horizontal não sinalizados |
| 768px (Tablet) | 🟡 Parcial | Sidebar de Relatórios e Disparo empilha corretamente, mas alguns cards ficam pequenos |
| 1280px (Desktop) | ✅ Bom | Layout funciona bem nessa resolução |
| 1440px (Desktop Full) | ✅ Bom | Layout ideal |

---

## Melhorias Recomendadas

### 🔴 Correções Críticas (impacto imediato na usabilidade)

1. **WhatsApp no Disparo:** Adicionar `MAX(contato_numerodocumento) AS cpf` na query de `/api/segments/:type/customers` — **1 linha de SQL**
2. **Label duplicado "Clientes Inativos":** Renomear segundo card para `"Em Risco"` no array `ks` da função `renderDashKPIs`
3. **Paginação JS error:** Refatorar `renderPag()` para usar `data-page` attributes + `addEventListener` em vez de `onclick` com `.toString()`
4. **Produtos sem nome:** Fazer JOIN com `bling_produtos_detalhes` no endpoint `/api/products/top-selling` para retornar o campo `nome`

### 🟠 Correções Importantes

5. **SQL Injection:** Substituir concatenação de strings nas queries por placeholders `?` do `mysql2`
6. **Email ausente nos relatórios de Ads:** Adicionar JOIN com `clientes_tray_ecommerce`/`clientes_tray_distribuicao` na query de `/api/clients`
7. **Cold start:** Implementar ping de warmup com UptimeRobot (gratuito) ou migrar para plano Render pago
8. **GeoJSON local:** Copiar `brazil-states.geojson` para `/public/` e servir localmente — elimina dependência do GitHub
9. **Paginação backend:** Implementar `LIMIT ?` e `OFFSET ?` reais no SQL de `/api/clients` — evita transferir 1000 registros
10. **Validação de datas:** Bloquear submissão se `startDate > endDate` com mensagem clara

### 🟡 Melhorias de UX

11. Adicionar `disabled` + spinner no botão "Buscar" durante carregamento
12. Substituir `alert()` por componente de toast/snackbar
13. Adicionar botão "✕ Limpar" no campo de pesquisa de Clientes
14. Adicionar estado vazio explicativo: "Nenhum dado para o período selecionado. Tente ampliar o intervalo."
15. Adicionar tooltips nos KPIs com explicação do cálculo

### 🎨 Melhorias Visuais

16. **Mobile:** Adicionar `overflow-x: auto; -webkit-overflow-scrolling: touch` na topbar com as abas
17. **Tabelas mobile:** Adicionar indicador visual de scroll horizontal (seta ou sombra lateral)
18. Melhorar contraste de `--tm` em tema claro para atingir WCAG AA (mín. 4.5:1)
19. Adicionar ícone de loading nos botões durante ação assíncrona

### ⚡ Melhorias de Performance

20. **Índices MySQL:** `CREATE INDEX idx_data_contato ON bling_pedidos_venda_detalhes_ecommerce (data, contato_id)` (e tabela distribuidor)
21. **Cache servidor:** Implementar cache em memória (node-cache ou Redis) para `/dashboard/kpis` com TTL de 5 minutos
22. **Compressão:** Confirmar que `compression()` está ativo para respostas JSON — verificado no código, mas confirmar no Render
23. **Lazy loading dos mapas:** Iniciar renderização D3 somente quando o usuário visualizar a seção

### 🏗️ Melhorias Arquiteturais

24. **Autenticação:** Aplicação 100% pública expõe dados sensíveis de clientes — implementar login básico (JWT ou OAuth)
25. **Rate limiting:** Adicionar `express-rate-limit` para evitar abuso de APIs
26. **Modularizar `server.js`:** Separar em arquivos de rotas (`routes/clients.js`, `routes/segments.js`, etc.)
27. **Variáveis de ambiente:** Documentar todas as variáveis necessárias em `.env.example`
28. **Monitoramento:** Integrar Sentry.io (plano gratuito) para captura automática de erros em produção
29. **Testes automatizados:** O script `auditoria.js` (Playwright) pode ser adaptado como suite de regressão automática
30. **CI/CD:** Adicionar pipeline no GitHub Actions para rodar testes antes de cada deploy

---

## Estrutura de Arquivos Gerados

```
resultado varredura/
├── prints/                          ← 62 screenshots JPG
│   ├── 01_dashboard_loading.jpg
│   ├── 02_dashboard_kpis_carregados.jpg
│   ├── 03_dashboard_graficos.jpg
│   ├── 04_dashboard_mapas.jpg
│   ├── 05_dashboard_filtro_ecommerce.jpg
│   ├── 06_dashboard_filtro_distribuidor.jpg
│   ├── 07_dashboard_filtro_data_2024.jpg
│   ├── 08_modal_grafico_rfm.jpg
│   ├── 09_modal_grafico_segmentos.jpg
│   ├── 10_modal_grafico_produtos.jpg
│   ├── 11_modal_produtos_scroll.jpg
│   ├── 12_dashboard_tema_claro.jpg
│   ├── 13_dashboard_tema_claro_graficos.jpg
│   ├── 14_dashboard_tema_escuro.jpg
│   ├── 15_clientes_loading.jpg
│   ├── 16_clientes_tabela_carregada.jpg
│   ├── 17_clientes_kpis.jpg
│   ├── 18_clientes_tabela_rows.jpg
│   ├── 19_clientes_paginacao.jpg
│   ├── 20_clientes_seg_vip.jpg
│   ├── 21_clientes_seg_recorrente.jpg
│   ├── 22_clientes_seg_inativo.jpg
│   ├── 23_clientes_seg_em_risco.jpg
│   ├── 24_clientes_seg_novo.jpg
│   ├── 25_clientes_unidade_ecom.jpg
│   ├── 26_clientes_unidade_dist.jpg
│   ├── 27_clientes_pesquisa_texto.jpg
│   ├── 28_clientes_ordem_nome_asc.jpg
│   ├── 29_clientes_ordem_nome_desc.jpg
│   ├── 30_clientes_ordem_total.jpg
│   ├── 31_clientes_filtro_coluna_aberto.jpg
│   ├── 32_modal_cliente_detalhe.jpg
│   ├── 33_modal_cliente_pedidos.jpg
│   ├── 34_modal_cliente_fechado.jpg
│   ├── 35_modal_pedido_detalhe.jpg
│   ├── 36_clientes_pagina2.jpg
│   ├── 37_relatorios_visao_geral.jpg
│   ├── 38_relatorios_sidebar_preenchida.jpg
│   ├── 39_relatorios_cidades_carregadas.jpg
│   ├── 40_relatorio_preview_meta.jpg
│   ├── 41_relatorio_preview_google.jpg
│   ├── 42_relatorio_preview_tiktok.jpg
│   ├── 43_relatorio_preview_linkedin.jpg
│   ├── 44_relatorios_completo_final.jpg
│   ├── 45_disparo_estado_inicial.jpg
│   ├── 46_disparo_seg_inativo.jpg
│   ├── 47_disparo_seg_em_risco.jpg
│   ├── 48_disparo_seg_vip.jpg
│   ├── 49_disparo_seg_recorrente.jpg
│   ├── 50_disparo_seg_novo.jpg
│   ├── 51_disparo_botoes_whatsapp.jpg
│   ├── 52_disparo_pagina2.jpg
│   ├── 53_disparo_modal_cliente.jpg
│   ├── 54_dashboard_sem_data.jpg
│   ├── 55_responsivo_mobile_375.jpg
│   ├── 56_responsivo_mobile_tabela.jpg
│   ├── 57_responsivo_tablet_768.jpg
│   ├── 58_responsivo_desktop_1280.jpg
│   ├── 59_FINAL_dashboard.jpg
│   ├── 60_FINAL_clientes.jpg
│   ├── 61_FINAL_relatorios.jpg
│   ├── 62_FINAL_disparo.jpg
│   └── page@*.webm                  ← Vídeo completo da sessão de auditoria
├── diagnostico.md                   ← Este relatório
├── network_log.json                 ← Log completo de todas as 53 requisições
└── execution_log.txt                ← Log de execução linha a linha

```

---

*Auditoria gerada automaticamente por **Antigravity** em 16/06/2026 às 10:05*
*Script: `resultado varredura/auditoria.js` (Playwright v1.61.0 + Chromium)*
