# FASE 0 - INVESTIGAÇÃO COMPLETA DO SCHEMA
## Data: 18 de Junho de 2026
## Sistema: Inteligência Comercial - Alpha Hawk Tecnologia
## Status: ✅ CONCLUÍDA

---

## 📋 CHECKLIST DE INVESTIGAÇÃO

- [x] 1. Introspecção completa do banco de dados
- [x] 2. Leitura do dicionário de dados de tráfego pago
- [x] 3. Identificar relacionamentos entre tráfego pago e vendas/produtos
- [x] 4. Localizar colunas de URL (campanha, adset, ad)
- [x] 5. Identificar tabela/coluna de produtos
- [x] 6. Detectar stack tecnológica atual
- [x] 7. Identificar índices existentes

---

## 🔍 1. INTROSPECÇÃO COMPLETA DO BANCO

### Total de Tabelas no Banco: **72 tabelas**

#### 🔵 TABELAS DE TRÁFEGO PAGO (11 tabelas)
1. `facebook_ad_details` - Detalhes dos anúncios do Facebook
2. `facebook_ad_insights` - Métricas/insights dos anúncios
3. `facebook_ad_preview` - Preview dos anúncios
4. `facebook_adset_insights` - Insights dos conjuntos de anúncios
5. `facebook_campanhas` - Campanhas do Facebook (15.005 registros)
6. `facebook_orcamento_anuncios` - Orçamentos por anúncio (42 registros)
7. `googleads_custom_report` - Relatórios personalizados Google Ads (229 registros)
8. `tiktokads_reports_ad_group_report` - Grupos de anúncios TikTok (1.664 registros)
9. `tiktokads_reports_ad_report` - Anúncios individuais TikTok (3.498 registros)
10. `tiktokads_reports_campaign_report` - Campanhas TikTok (1.487 registros)
11. `tiktokads_reports_reports_advertiser` - Anunciantes TikTok (392 registros)

#### 🟢 TABELAS DE VENDAS/PEDIDOS (15 tabelas)
**Principais:**
- `bling_pedidos_venda_detalhes_ecommerce` - **16.521 registros**
- `bling_pedidos_venda_detalhes_distribuicao` - **6.759 registros**
- `bling_pedidos_venda_detalhes_itens_ecommerce` - **44.547 registros**
- `bling_pedidos_venda_detalhes_itens_distribuicao` - **83.011 registros**
- `apedidos_tray_tratamento` - **6.452 registros**
- `pedidos_ecommerce_tray`
- `pedidos_distribuicao_tray`
- `detalhes_pedidos_ecommerce_tray`
- `tray_ecommerce_pedidos_detalhes`

**Estrutura auxiliar:**
- `bling_pedidos_venda_ecommerce`
- `bling_pedidos_venda_distribuicao`
- `bling_pedidos_venda_detalhes_parcelas_ecommerce`
- `bling_pedidos_venda_detalhes_parcelas_distribuicao`
- `bling_pedidos_venda_detalhes_transporte_volumes_ecommerce`
- `bling_pedidos_venda_detalhes_transporte_volumes_distribuicao`

#### 🟡 TABELAS DE PRODUTOS (19 tabelas)
**Principais:**
- `bling_produtos_detalhes_ecommerce`
- `bling_produtos_detalhes_distribuicao` - **475 produtos**
- `bling_produtos_ecommerce`
- `bling_produtos_distribuicao`
- `produtos_vendidos_tray_ecommerce`

**Estrutura e estoque:**
- `bling_produtos_estruturas_ecommerce`
- `bling_produtos_estruturas_distribuicao`
- `bling_produtos_estruturas_componentes_ecommerce`
- `bling_produtos_estruturas_componentes_distribuicao`
- `bling_produtos_estoque_ecommerce`
- `bling_produtos_estoque_distribuicao`
- `bling_produtos_estoque_depositos_ecommerce`
- `bling_produtos_estoque_depositos_distribuicao`

**Mídia:**
- `bling_produtos_detalhes_midia_imagens_externas_ecommerce`
- `bling_produtos_detalhes_midia_imagens_externas_distribuicao`
- `bling_produtos_detalhes_midia_imagens_internas_ecommerce`
- `bling_produtos_detalhes_midia_imagens_internas_distribuicao`
- `bling_produtos_detalhes_camposcustomizados_ecommerce` - 1.264 registros
- `bling_produtos_detalhes_camposcustomizados_distribuicao`

#### 🟠 TABELAS DE CLIENTES (7 tabelas)
- `clientes_tray_ecommerce`
- `clientes_tray_distribuicao`
- `clientes_tray_ecommerce_deltas`
- `tray_customers_attributes`
- `tray_customers_attributesdist`
- `tray_customers_customeraddress`
- `tray_customers_customeraddressdist`

#### 🟣 TABELAS DE NOTAS FISCAIS (11 tabelas)
- `bling_nfe_saida_detalhes_ecommerce`
- `bling_nfe_saida_detalhes_distribuicao`
- `bling_nfe_saida_detalhes_itens_ecommerce`
- `bling_nfe_saida_detalhes_itens_distribuicao`
- `bling_nfe_saida_detpag_ecommerce`
- `bling_nfe_saida_detpag_distribuicao`
- `bling_nfe_saida_x_transp_vol_ecommerce`
- `bling_nfe_saida_x_transp_vol_distribuicao`
- `bling_nfe_saida_detalhes_transporte_volumes_ecommerce`
- `bling_nfe_saida_detalhes_transporte_volumes_distribuicao`
- `configuracoes`

#### ⚪ OUTRAS TABELAS (9 tabelas)
- `bling_depositos_ecommerce`
- `bling_depositos_distribuicao`
- `bling_situacoes_modulos_detalhes_ecommerce`
- `bling_situacoes_modulos_detalhes_distribuicao`
- `instagram_account_daily_insights`
- `instagram_media`
- `instagram_media_insights`
- `instagram_perfis`
- `usuarios`

---

## 📚 2. LEITURA DO DICIONÁRIO DE DADOS

✅ **Dicionário lido e disponível em:**
- `DICIONARIO-COMPLETO-TRAFEGO-PAGO.txt` (74 KB, 2.435 linhas)
- `COLUNAS-TRAFEGO-PAGO.txt` (arquivo raw)
- Total de **406 colunas documentadas** com explicações detalhadas

**Principais métricas documentadas:**
- Facebook Ads: 278 colunas (métricas de conversão, valores, engajamento)
- Google Ads: 18 colunas (cost, conversions, impressions, clicks)
- TikTok Ads: ~150 colunas por tabela (purchase, checkout, engagement)

---

## 🔗 3. RELACIONAMENTOS ENTRE TRÁFEGO PAGO E VENDAS/PRODUTOS

### ⚠️ DESCOBERTA CRÍTICA:

**NÃO foram encontradas colunas diretas de campaign_id, utm_source, utm_medium ou similares nas tabelas de pedidos!**

Isso significa que o relacionamento entre tráfego pago e vendas **NÃO está explícito no banco atual**.

### Possíveis Soluções:

#### Opção A: Relacionamento por Período + Plataforma (Atribuição Temporal)
```sql
-- Exemplo: Vendas do mesmo dia da campanha
SELECT 
  c.campaign_name,
  c.spend,
  SUM(p.total) as receita
FROM facebook_campanhas c
LEFT JOIN bling_pedidos_venda_detalhes_ecommerce p
  ON DATE(c.metric_date) = DATE(p.data)
WHERE c.metric_date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY c.campaign_id
```

#### Opção B: Relacionamento por Produto Promovido
- Criar tabela de associação manual: `campanha_produto_associacao`
- Campos: `campaign_id`, `produto_id`, `plataforma`, `data_inicio`, `data_fim`

#### Opção C: Análise Agregada
- Dashboard mostra métricas de tráfego e vendas lado a lado
- Sem relacionamento direto, mas permite análise comparativa

### Estrutura de Pedidos Identificada:

**`bling_pedidos_venda_detalhes_ecommerce` (16.521 pedidos)**
- `id` - ID único do pedido
- `data` - Data do pedido
- `total` - Valor total
- `totalprodutos` - Valor dos produtos
- `contato_id` - ID do cliente
- `contato_nome` - Nome do cliente
- `situacao_id` - Status do pedido

**`bling_pedidos_venda_detalhes_itens_ecommerce` (44.547 itens)**
- `pedido_venda_id` - FK para pedido
- `itens_produto_id` - ID do produto
- `itens_codigo` - SKU do produto
- `itens_quantidade` - Quantidade vendida
- `itens_valor` - Valor unitário
- `pedido_data` - Data do pedido

---

## 🔗 4. COLUNAS DE URL ENCONTRADAS

### ✅ Facebook Ads

**`facebook_ad_details`:**
- `creative_thumbnail_url` (mediumtext) - URL do thumbnail do criativo
- `creative_image_url` (mediumtext) - URL da imagem do criativo

**Observação:** NÃO foram encontradas colunas com URLs diretas para:
- Campanha (`campaign_url`)
- Conjunto de anúncios (`adset_url`)
- Anúncio (`ad_url` ou `permalink`)

**Solução:** Construir URLs programaticamente usando IDs:
```javascript
// Facebook
const campaignUrl = `https://business.facebook.com/adsmanager/manage/campaigns?act=${account_id}&selected_campaign_ids=${campaign_id}`;
const adsetUrl = `https://business.facebook.com/adsmanager/manage/adsets?act=${account_id}&selected_adset_ids=${adset_id}`;
const adUrl = `https://business.facebook.com/adsmanager/manage/ads?act=${account_id}&selected_ad_ids=${ad_id}`;
```

### ❌ Google Ads
Não foram encontradas colunas de URL em `googleads_custom_report`

**Solução:** Construir URLs:
```javascript
const campaignUrl = `https://ads.google.com/aw/campaigns?campaignId=${campaign_id}`;
```

### ❌ TikTok Ads
Não foram encontradas colunas de URL nas tabelas TikTok

**Solução:** Construir URLs:
```javascript
const campaignUrl = `https://ads.tiktok.com/i18n/campaigndetail?aadvid=${advertiser_id}&cid=${campaign_id}`;
```

---

## 📦 5. TABELAS/COLUNAS DE PRODUTOS IDENTIFICADAS

### Tabela Principal de Produtos: `bling_produtos_detalhes_distribuicao`

**Colunas Principais:**
- `id` (varchar 255) - ID único do produto
- `nome` (mediumtext) - Nome do produto
- `codigo` (mediumtext) - Código/SKU do produto
- `unidade` (mediumtext) - Unidade de medida
- `pesoliquido` (double) - Peso
- `dimensoes_*` - Dimensões do produto

**Total:** 475 produtos cadastrados

### Relacionamento Produto × Pedido:

**`bling_pedidos_venda_detalhes_itens_ecommerce`:**
- `itens_produto_id` → FK para `bling_produtos_detalhes_distribuicao.id`
- `itens_codigo` → SKU do produto

**Query de exemplo:**
```sql
SELECT 
  p.nome as produto,
  p.codigo as sku,
  SUM(i.itens_quantidade) as qtd_vendida,
  SUM(i.itens_valor * i.itens_quantidade) as receita
FROM bling_pedidos_venda_detalhes_itens_ecommerce i
JOIN bling_produtos_detalhes_distribuicao p ON p.id = i.itens_produto_id
WHERE i.pedido_data BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY p.id
ORDER BY receita DESC
```

---

## 💻 6. STACK TECNOLÓGICA ATUAL

### Backend:
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18.2
- **Banco de Dados:** MySQL 2 (mysql2 3.6.5) com connection pooling
- **Segurança:** Helmet 7.1.0, CORS 2.8.5
- **Validação:** Express-validator 7.0.1
- **Logging:** Winston 3.11.0
- **Compressão:** Compression 1.7.4
- **Configuração:** Dotenv 16.3.1

### Frontend (identificado em `public/index.html`):
- **HTML5** puro (sem framework)
- **CSS3** com variáveis CSS e tema dark/light
- **JavaScript** Vanilla (ES6+)
- **Gráficos:** Chart.js 4.4.0
- **Mapas:** D3.js 7
- **Fonte:** Google Fonts (Inter)

### Arquitetura Atual:
```
project/
├── server.js          → Express server com rotas API
├── public/
│   ├── index.html     → SPA com múltiplas abas
│   └── *.geojson      → Dados de mapas
├── package.json
└── .env              → Configuração


```

### Padrão de Rotas API Atual:
```javascript
// Todas as rotas começam com /api/
app.get('/api/dashboard/kpis', ...)
app.get('/api/clients', ...)
app.get('/api/clients/:id', ...)
app.get('/api/segments', ...)
app.get('/api/orders/:id', ...)
```

### Padrão de Resposta API:
```javascript
// Sucesso
res.json({ data, total, page, pages });

// Erro
res.status(500).json({ error: message });
```

### Segurança Implementada:
- Helmet com CSP desabilitado para Chart.js
- CORS configurável via `ALLOWED_ORIGIN`
- Prepared statements (previne SQL injection)
- Validação de inputs (datas, business unit)
- Connection pooling (10 conexões, fila de 20)
- Winston para logging de erros

---

## 🔍 7. ÍNDICES EXISTENTES NAS TABELAS DE TRÁFEGO

### ✅ Índices Encontrados:

**`facebook_ad_details`:**
- `idx_facebook_ad_details_ad_id` em `ad_id`

**`facebook_ad_preview`:**
- `idx_facebook_ad_preview_ad_id` em `ad_id`

**`facebook_orcamento_anuncios`:**
- `PRIMARY` em `ad_id`

### ⚠️ Tabelas SEM Índices Secundários:
- `facebook_campanhas` - **CRÍTICO** (15.005 registros sem índice em `metric_date`, `campaign_id`)
- `facebook_ad_insights`
- `facebook_adset_insights`
- `googleads_custom_report` - **CRÍTICO** (229 registros sem índice em `segments_date`, `campaign_id`)
- Todas as tabelas TikTok

### 📋 Índices Recomendados para Performance:

```sql
-- Facebook Campanhas (15.005 registros)
CREATE INDEX idx_fb_campanhas_date ON facebook_campanhas(metric_date);
CREATE INDEX idx_fb_campanhas_campaign_id ON facebook_campanhas(campaign_id);
CREATE INDEX idx_fb_campanhas_account_id ON facebook_campanhas(account_id);
CREATE INDEX idx_fb_campanhas_ad_id ON facebook_campanhas(ad_id);

-- Google Ads (229 registros)
CREATE INDEX idx_google_date ON googleads_custom_report(segments_date);
CREATE INDEX idx_google_campaign_id ON googleads_custom_report(campaign_id);

-- TikTok Campanhas (1.487 registros)
CREATE INDEX idx_tiktok_campaign_date ON tiktokads_reports_campaign_report(metric_date);
CREATE INDEX idx_tiktok_campaign_id ON tiktokads_reports_campaign_report(campaign_id);
CREATE INDEX idx_tiktok_advertiser_id ON tiktokads_reports_campaign_report(advertiser_id);

-- TikTok Ad Groups (1.664 registros)
CREATE INDEX idx_tiktok_adgroup_date ON tiktokads_reports_ad_group_report(metric_date);
CREATE INDEX idx_tiktok_adgroup_id ON tiktokads_reports_ad_group_report(adgroup_id);
CREATE INDEX idx_tiktok_adgroup_campaign_id ON tiktokads_reports_ad_group_report(campaign_id);

-- TikTok Ads (3.498 registros)
CREATE INDEX idx_tiktok_ad_date ON tiktokads_reports_ad_report(metric_date);
CREATE INDEX idx_tiktok_ad_id ON tiktokads_reports_ad_report(ad_id);
CREATE INDEX idx_tiktok_ad_adgroup_id ON tiktokads_reports_ad_report(adgroup_id);

-- Pedidos (para joins)
CREATE INDEX idx_pedidos_data ON bling_pedidos_venda_detalhes_ecommerce(data);
CREATE INDEX idx_pedidos_itens_data ON bling_pedidos_venda_detalhes_itens_ecommerce(pedido_data);
CREATE INDEX idx_pedidos_itens_produto_id ON bling_pedidos_venda_detalhes_itens_ecommerce(itens_produto_id);
```

---

## 📊 RESUMO DAS DESCOBERTAS

### ✅ Pontos Positivos:
1. **Dados abundantes** - 22.317 registros de tráfego pago
2. **3 plataformas** completas (Facebook, Google, TikTok)
3. **Estrutura organizada** - separação clara entre ecommerce e distribuição
4. **Dados de produtos** - 475 produtos cadastrados
5. **Histórico de vendas** - 60.068 itens vendidos registrados
6. **Stack moderna** - Node.js + Express + MySQL + Chart.js
7. **Métricas ricas** - 200+ métricas disponíveis por plataforma

### ⚠️ Desafios Identificados:
1. **Relacionamento não explícito** - Sem UTMs ou campaign_id nos pedidos
2. **URLs não armazenadas** - Precisam ser construídas programaticamente
3. **Falta de índices** - Performance pode ser afetada sem índices em datas
4. **Atribuição manual** - Necessário criar estratégia de atribuição

### 🎯 Estratégia Recomendada:

#### Fase 1: Dashboard Independente (Imediato)
Criar aba "Dados de Tráfego Pago" com:
- Métricas consolidadas por plataforma
- Análise temporal de investimento/conversões
- Ranking de campanhas
- Comparativos entre plataformas
- **SEM relacionamento direto com vendas ainda**

#### Fase 2: Atribuição Temporal (Curto Prazo)
- Análise de correlação temporal (vendas vs investimento no mesmo período)
- Gráficos lado a lado para identificar padrões
- Relatório de "Período de Campanha X vs Vendas no Período"

#### Fase 3: Atribuição Manual (Médio Prazo)
- Criar tabela `campanha_produto_associacao`
- Interface para gestor associar produtos a campanhas
- Permitir análise Produto × Campanha com dados reais

#### Fase 4: Implementação de UTMs (Longo Prazo)
- Adicionar colunas UTM nas tabelas de pedidos Tray/Bling
- Configurar tracking na plataforma e-commerce
- Relacionamento direto e automático

---

## 📁 ESTRUTURA PROPOSTA PARA O NOVO MÓDULO

```
project/
├── server.js                          → Adicionar rotas /api/traffic/*
├── services/
│   ├── TrafficService.js             → Lógica de tráfego pago
│   ├── CampaignAnalyticsService.js   → Análises de campanhas
│   └── ProductCampaignService.js     → Relação produto × campanha (futuro)
├── public/
│   └── index.html                    → Adicionar aba "Tráfego Pago"
└── sql/
    └── create-indexes.sql            → Índices recomendados
```

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ **Fase 0 concluída** - Schema investigado e documentado
2. ⏭️ **Iniciar Fase 1** - Criar rotas API para tráfego pago
3. ⏭️ **Criar Dashboard** - Interface frontend com Chart.js
4. ⏭️ **Adicionar índices** - Executar SQL de criação de índices
5. ⏭️ **Testes** - Validar queries e performance

---

**FIM DA FASE 0**

Todas as informações necessárias foram coletadas e documentadas.
Pronto para iniciar a implementação do módulo de Tráfego Pago!
