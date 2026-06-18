-- ═══════════════════════════════════════════════════════════════
-- QUERIES SQL - EXEMPLOS PARA ANÁLISE DE TRÁFEGO PAGO
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. VISÃO GERAL: Métricas Consolidadas de Todas as Plataformas
-- ───────────────────────────────────────────────────────────────

SELECT 
    'TOTAL' AS fonte,
    SUM(investimento) AS investimento_total,
    SUM(receita) AS receita_total,
    SUM(conversoes) AS conversoes_total,
    SUM(cliques) AS cliques_total,
    SUM(impressoes) AS impressoes_total,
    ROUND(SUM(receita) / NULLIF(SUM(investimento), 0), 2) AS roas,
    ROUND(SUM(investimento) / NULLIF(SUM(conversoes), 0), 2) AS custo_por_conversao
FROM (
    -- Facebook
    SELECT 
        SUM(spend) AS investimento,
        SUM(value_offsite_conversion_fb_pixel_purchase) AS receita,
        SUM(a_offsite_conversion_fb_pixel_purchase) AS conversoes,
        SUM(clicks) AS cliques,
        SUM(impressions) AS impressoes
    FROM facebook_campanhas
    WHERE metric_date BETWEEN '2024-01-01' AND '2024-12-31'
    
    UNION ALL
    
    -- Google
    SELECT 
        SUM(metrics_cost) AS investimento,
        SUM(metrics_conversionsvalue) AS receita,
        SUM(metrics_conversions) AS conversoes,
        SUM(metrics_clicks) AS cliques,
        SUM(metrics_impressions) AS impressoes
    FROM googleads_custom_report
    WHERE date BETWEEN '2024-01-01' AND '2024-12-31'
    
    UNION ALL
    
    -- TikTok
    SELECT 
        SUM(spend) AS investimento,
        0 AS receita, -- TikTok não tem valor direto
        SUM(conversion) AS conversoes,
        SUM(clicks) AS cliques,
        SUM(impressions) AS impressoes
    FROM tiktokads_reports_campaign_report
    WHERE stat_time_day BETWEEN '2024-01-01' AND '2024-12-31'
) AS todas_plataformas;


-- ───────────────────────────────────────────────────────────────
-- 2. TOP 20 CAMPANHAS POR ROAS (Todas as Plataformas)
-- ───────────────────────────────────────────────────────────────

(
    SELECT 
        'Facebook' AS plataforma,
        campaign_name AS campanha,
        SUM(spend) AS investimento,
        SUM(value_offsite_conversion_fb_pixel_purchase) AS receita,
        SUM(a_offsite_conversion_fb_pixel_purchase) AS conversoes,
        ROUND(SUM(value_offsite_conversion_fb_pixel_purchase) / NULLIF(SUM(spend), 0), 2) AS roas,
        MIN(metric_date) AS data_inicio,
        MAX(metric_date) AS data_fim
    FROM facebook_campanhas
    WHERE metric_date BETWEEN '2024-01-01' AND '2024-12-31'
    GROUP BY campaign_name
    HAVING investimento > 0
)
UNION ALL
(
    SELECT 
        'Google' AS plataforma,
        campaign_name AS campanha,
        SUM(metrics_cost) AS investimento,
        SUM(metrics_conversionsvalue) AS receita,
        SUM(metrics_conversions) AS conversoes,
        ROUND(SUM(metrics_conversionsvalue) / NULLIF(SUM(metrics_cost), 0), 2) AS roas,
        MIN(date) AS data_inicio,
        MAX(date) AS data_fim
    FROM googleads_custom_report
    WHERE date BETWEEN '2024-01-01' AND '2024-12-31'
    GROUP BY campaign_name
    HAVING investimento > 0
)
UNION ALL
(
    SELECT 
        'TikTok' AS plataforma,
        campaign_name AS campanha,
        SUM(spend) AS investimento,
        0 AS receita,
        SUM(conversion) AS conversoes,
        0 AS roas,
        MIN(stat_time_day) AS data_inicio,
        MAX(stat_time_day) AS data_fim
    FROM tiktokads_reports_campaign_report
    WHERE stat_time_day BETWEEN '2024-01-01' AND '2024-12-31'
    GROUP BY campaign_name
    HAVING investimento > 0
)
ORDER BY roas DESC
LIMIT 20;


-- ───────────────────────────────────────────────────────────────
-- 3. PRODUTOS MAIS VENDIDOS COM ATRIBUIÇÃO DE CAMPANHA
-- ───────────────────────────────────────────────────────────────

SELECT 
    pvt.product_id,
    pvt.name AS produto,
    pvt.reference AS sku,
    pvt.brand AS marca,
    COUNT(DISTINCT pvt.order_id) AS num_pedidos,
    SUM(pvt.quantity) AS quantidade_vendida,
    SUM(pvt.price * pvt.quantity) AS receita_total,
    SUM(pvt.cost_price * pvt.quantity) AS custo_total,
    SUM((pvt.price - COALESCE(pvt.cost_price, 0)) * pvt.quantity) AS lucro_bruto,
    COUNT(DISTINCT pvt.id_campaign) AS num_campanhas,
    GROUP_CONCAT(DISTINCT pvt.id_campaign SEPARATOR ', ') AS campanhas_ids,
    ROUND(SUM((pvt.price - COALESCE(pvt.cost_price, 0)) * pvt.quantity) / 
          NULLIF(SUM(pvt.price * pvt.quantity), 0) * 100, 2) AS margem_lucro_perc
FROM produtos_vendidos_tray_ecommerce pvt
INNER JOIN pedidos_ecommerce_tray pet ON pvt.order_id = pet.id
WHERE pet.date BETWEEN '2024-01-01' AND '2024-12-31'
  AND pvt.id_campaign IS NOT NULL
GROUP BY pvt.product_id, pvt.name, pvt.reference, pvt.brand
ORDER BY receita_total DESC
LIMIT 50;


-- ───────────────────────────────────────────────────────────────
-- 4. ANÁLISE POR REGIÃO: Qual Estado Gera Mais Vendas por Campanha
-- ───────────────────────────────────────────────────────────────

SELECT 
    pvt.id_campaign AS campanha_id,
    ca.state AS estado,
    COUNT(DISTINCT pet.customer_id) AS num_clientes,
    COUNT(DISTINCT pet.id) AS num_pedidos,
    SUM(pvt.price * pvt.quantity) AS receita,
    SUM(pvt.quantity) AS produtos_vendidos
FROM produtos_vendidos_tray_ecommerce pvt
INNER JOIN pedidos_ecommerce_tray pet ON pvt.order_id = pet.id
INNER JOIN tray_customers_customeraddress ca ON pet.customer_id = ca.customer_id
WHERE pet.date BETWEEN '2024-01-01' AND '2024-12-31'
  AND pvt.id_campaign IS NOT NULL
  AND ca.state IS NOT NULL
GROUP BY pvt.id_campaign, ca.state
ORDER BY campanha_id, receita DESC;


-- ───────────────────────────────────────────────────────────────
-- 5. COMPARAR DUAS CAMPANHAS ESPECÍFICAS
-- ───────────────────────────────────────────────────────────────

WITH campanha_a AS (
    SELECT 
        SUM(spend) AS investimento,
        SUM(clicks) AS cliques,
        SUM(impressions) AS impressoes,
        SUM(value_offsite_conversion_fb_pixel_purchase) AS receita,
        SUM(a_offsite_conversion_fb_pixel_purchase) AS conversoes
    FROM facebook_campanhas
    WHERE campaign_id = '123456789' -- Substituir pelo ID real
      AND metric_date BETWEEN '2024-01-01' AND '2024-12-31'
),
campanha_b AS (
    SELECT 
        SUM(spend) AS investimento,
        SUM(clicks) AS cliques,
        SUM(impressions) AS impressoes,
        SUM(value_offsite_conversion_fb_pixel_purchase) AS receita,
        SUM(a_offsite_conversion_fb_pixel_purchase) AS conversoes
    FROM facebook_campanhas
    WHERE campaign_id = '987654321' -- Substituir pelo ID real
      AND metric_date BETWEEN '2024-01-01' AND '2024-12-31'
)
SELECT 
    'Campanha A' AS campanha,
    investimento,
    cliques,
    impressoes,
    receita,
    conversoes,
    ROUND(receita / NULLIF(investimento, 0), 2) AS roas,
    ROUND(investimento / NULLIF(conversoes, 0), 2) AS custo_por_conversao,
    ROUND((cliques / NULLIF(impressoes, 0)) * 100, 2) AS ctr_percentual
FROM campanha_a
UNION ALL
SELECT 
    'Campanha B',
    investimento,
    cliques,
    impressoes,
    receita,
    conversoes,
    ROUND(receita / NULLIF(investimento, 0), 2),
    ROUND(investimento / NULLIF(conversoes, 0), 2),
    ROUND((cliques / NULLIF(impressoes, 0)) * 100, 2)
FROM campanha_b;


-- ───────────────────────────────────────────────────────────────
-- 6. MATRIZ PRODUTO x CAMPANHA (Quais campanhas vendem quais produtos)
-- ───────────────────────────────────────────────────────────────

SELECT 
    pvt.product_id,
    pvt.name AS produto,
    pvt.id_campaign AS campanha,
    COUNT(DISTINCT pvt.order_id) AS pedidos,
    SUM(pvt.quantity) AS quantidade,
    SUM(pvt.price * pvt.quantity) AS receita
FROM produtos_vendidos_tray_ecommerce pvt
INNER JOIN pedidos_ecommerce_tray pet ON pvt.order_id = pet.id
WHERE pet.date BETWEEN '2024-01-01' AND '2024-12-31'
  AND pvt.id_campaign IS NOT NULL
GROUP BY pvt.product_id, pvt.name, pvt.id_campaign
ORDER BY produto, receita DESC;


-- ───────────────────────────────────────────────────────────────
-- 7. PERFORMANCE DIÁRIA: Tendência de Investimento e Receita
-- ───────────────────────────────────────────────────────────────

SELECT 
    metric_date AS data,
    SUM(spend) AS investimento_dia,
    SUM(value_offsite_conversion_fb_pixel_purchase) AS receita_dia,
    SUM(a_offsite_conversion_fb_pixel_purchase) AS conversoes_dia,
    SUM(clicks) AS cliques_dia,
    SUM(impressions) AS impressoes_dia,
    ROUND(SUM(value_offsite_conversion_fb_pixel_purchase) / NULLIF(SUM(spend), 0), 2) AS roas_dia
FROM facebook_campanhas
WHERE metric_date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY metric_date
ORDER BY metric_date;


-- ───────────────────────────────────────────────────────────────
-- 8. CAMPANHAS COM PIOR PERFORMANCE (ROAS < 1)
-- ───────────────────────────────────────────────────────────────

SELECT 
    'Facebook' AS plataforma,
    campaign_name AS campanha,
    SUM(spend) AS investimento,
    SUM(value_offsite_conversion_fb_pixel_purchase) AS receita,
    SUM(a_offsite_conversion_fb_pixel_purchase) AS conversoes,
    ROUND(SUM(value_offsite_conversion_fb_pixel_purchase) / NULLIF(SUM(spend), 0), 2) AS roas
FROM facebook_campanhas
WHERE metric_date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY campaign_name
HAVING investimento > 100 AND roas < 1
ORDER BY roas ASC;


-- ───────────────────────────────────────────────────────────────
-- 9. ANÁLISE POR TIPO DE CLIENTE (PF vs PJ)
-- ───────────────────────────────────────────────────────────────

SELECT 
    CASE 
        WHEN LENGTH(tc.cpf) = 11 THEN 'Pessoa Física'
        WHEN LENGTH(tc.cpf) > 11 THEN 'Pessoa Jurídica'
        ELSE 'Não Identificado'
    END AS tipo_cliente,
    COUNT(DISTINCT pet.customer_id) AS num_clientes,
    COUNT(DISTINCT pet.id) AS num_pedidos,
    SUM(pvt.price * pvt.quantity) AS receita_total,
    AVG(pvt.price * pvt.quantity) AS ticket_medio
FROM produtos_vendidos_tray_ecommerce pvt
INNER JOIN pedidos_ecommerce_tray pet ON pvt.order_id = pet.id
LEFT JOIN tray_customers tc ON pet.customer_id = tc.id
WHERE pet.date BETWEEN '2024-01-01' AND '2024-12-31'
  AND pvt.id_campaign IS NOT NULL
GROUP BY tipo_cliente
ORDER BY receita_total DESC;


-- ───────────────────────────────────────────────────────────────
-- 10. SAZONALIDADE: Vendas por Mês
-- ───────────────────────────────────────────────────────────────

SELECT 
    DATE_FORMAT(pet.date, '%Y-%m') AS mes,
    COUNT(DISTINCT pvt.id_campaign) AS campanhas_ativas,
    COUNT(DISTINCT pet.id) AS num_pedidos,
    SUM(pvt.quantity) AS produtos_vendidos,
    SUM(pvt.price * pvt.quantity) AS receita
FROM produtos_vendidos_tray_ecommerce pvt
INNER JOIN pedidos_ecommerce_tray pet ON pvt.order_id = pet.id
WHERE pet.date BETWEEN '2024-01-01' AND '2024-12-31'
  AND pvt.id_campaign IS NOT NULL
GROUP BY mes
ORDER BY mes;


-- ═══════════════════════════════════════════════════════════════
-- DICAS DE USO:
-- 
-- 1. Sempre use BETWEEN para filtros de data
-- 2. Use NULLIF para evitar divisão por zero
-- 3. GROUP_CONCAT para listar IDs relacionados
-- 4. Use índices nas colunas de data e campaign_id
-- 5. Sempre teste com LIMIT primeiro em produção
-- ═══════════════════════════════════════════════════════════════
