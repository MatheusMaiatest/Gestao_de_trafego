// ══════════════════════════════════════════════════════════════
// SERVICE: Análise de Tráfego Pago
// Centraliza toda a lógica de negócio para análise de campanhas
// ══════════════════════════════════════════════════════════════

class TrafficService {
  constructor(pool) {
    this.pool = pool;
  }

  // ──────────────────────────────────────────────────────────
  // DASHBOARD GERAL - KPIs consolidados
  // ──────────────────────────────────────────────────────────
  async getDashboardKPIs(filters) {
    const { startDate, endDate, platform, campaign } = filters;
    const conn = await this.pool.getConnection();
    
    try {
      let totalStats = {
        investment: 0, clicks: 0, impressions: 0, reach: 0,
        purchases: 0, revenue: 0, cpcSum: 0, cpmSum: 0, ctrSum: 0, count: 0
      };

      // Facebook Ads
      if (!platform || platform === 'all' || platform === 'facebook') {
        const [fbRows] = await conn.execute(`
          SELECT 
            SUM(spend) AS investment,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            SUM(reach) AS reach,
            SUM(a_offsite_conversion_fb_pixel_purchase) AS purchases,
            SUM(value_offsite_conversion_fb_pixel_purchase) AS revenue,
            AVG(cpc) AS avg_cpc,
            AVG(cpm) AS avg_cpm,
            AVG(ctr) AS avg_ctr
          FROM facebook_campanhas
          WHERE metric_date BETWEEN ? AND ?
            ${campaign ? 'AND campaign_id = ?' : ''}
        `, campaign ? [startDate, endDate, campaign] : [startDate, endDate]);
        
        if (fbRows[0]) {
          totalStats.investment += parseFloat(fbRows[0].investment || 0);
          totalStats.clicks += parseInt(fbRows[0].clicks || 0);
          totalStats.impressions += parseInt(fbRows[0].impressions || 0);
          totalStats.reach += parseInt(fbRows[0].reach || 0);
          totalStats.purchases += parseFloat(fbRows[0].purchases || 0);
          totalStats.revenue += parseFloat(fbRows[0].revenue || 0);
          totalStats.cpcSum += parseFloat(fbRows[0].avg_cpc || 0);
          totalStats.cpmSum += parseFloat(fbRows[0].avg_cpm || 0);
          totalStats.ctrSum += parseFloat(fbRows[0].avg_ctr || 0);
          totalStats.count++;
        }
      }

      // Google Ads
      if (!platform || platform === 'all' || platform === 'google') {
        const [googleRows] = await conn.execute(`
          SELECT 
            SUM(metrics_cost) AS investment,
            SUM(metrics_clicks) AS clicks,
            SUM(metrics_impressions) AS impressions,
            SUM(metrics_conversions) AS purchases,
            SUM(metrics_conversionsvalue) AS revenue,
            AVG(metrics_cost / NULLIF(metrics_clicks, 0)) AS avg_cpc,
            AVG((metrics_cost / NULLIF(metrics_impressions, 0)) * 1000) AS avg_cpm,
            AVG((metrics_clicks / NULLIF(metrics_impressions, 0)) * 100) AS avg_ctr
          FROM googleads_custom_report
          WHERE segments_date BETWEEN ? AND ?
            ${campaign ? 'AND campaign_id = ?' : ''}
        `, campaign ? [startDate, endDate, campaign] : [startDate, endDate]);
        
        if (googleRows[0]) {
          totalStats.investment += parseFloat(googleRows[0].investment || 0);
          totalStats.clicks += parseInt(googleRows[0].clicks || 0);
          totalStats.impressions += parseInt(googleRows[0].impressions || 0);
          totalStats.purchases += parseFloat(googleRows[0].purchases || 0);
          totalStats.revenue += parseFloat(googleRows[0].revenue || 0);
          totalStats.cpcSum += parseFloat(googleRows[0].avg_cpc || 0);
          totalStats.cpmSum += parseFloat(googleRows[0].avg_cpm || 0);
          totalStats.ctrSum += parseFloat(googleRows[0].avg_ctr || 0);
          totalStats.count++;
        }
      }

      // TikTok Ads
      if (!platform || platform === 'all' || platform === 'tiktok') {
        const [tiktokRows] = await conn.execute(`
          SELECT 
            SUM(spend) AS investment,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            SUM(reach) AS reach,
            SUM(conversion) AS purchases,
            AVG(cost_per_result) AS avg_cpc,
            AVG(cost_per_1000_reached) AS avg_cpm,
            AVG((clicks / NULLIF(impressions, 0)) * 100) AS avg_ctr
          FROM tiktokads_reports_campaign_report
          WHERE metric_date BETWEEN ? AND ?
            ${campaign ? 'AND campaign_id = ?' : ''}
        `, campaign ? [startDate, endDate, campaign] : [startDate, endDate]);
        
        if (tiktokRows[0]) {
          totalStats.investment += parseFloat(tiktokRows[0].investment || 0);
          totalStats.clicks += parseInt(tiktokRows[0].clicks || 0);
          totalStats.impressions += parseInt(tiktokRows[0].impressions || 0);
          totalStats.reach += parseInt(tiktokRows[0].reach || 0);
          totalStats.purchases += parseFloat(tiktokRows[0].purchases || 0);
          // TikTok não tem receita direta, calcular baseado no custo por conversão
          totalStats.revenue += totalStats.purchases * parseFloat(tiktokRows[0].avg_cpc || 0);
          totalStats.cpcSum += parseFloat(tiktokRows[0].avg_cpc || 0);
          totalStats.cpmSum += parseFloat(tiktokRows[0].avg_cpm || 0);
          totalStats.ctrSum += parseFloat(tiktokRows[0].avg_ctr || 0);
          totalStats.count++;
        }
      }

      return {
        investment: parseFloat(totalStats.investment.toFixed(2)),
        revenue: parseFloat(totalStats.revenue.toFixed(2)),
        purchases: Math.round(totalStats.purchases),
        clicks: totalStats.clicks,
        impressions: totalStats.impressions,
        reach: totalStats.reach,
        avgCPC: totalStats.count > 0 ? parseFloat((totalStats.cpcSum / totalStats.count).toFixed(2)) : 0,
        avgCPM: totalStats.count > 0 ? parseFloat((totalStats.cpmSum / totalStats.count).toFixed(2)) : 0,
        avgCTR: totalStats.count > 0 ? parseFloat((totalStats.ctrSum / totalStats.count).toFixed(2)) : 0,
        costPerConversion: totalStats.purchases > 0 ? 
          parseFloat((totalStats.investment / totalStats.purchases).toFixed(2)) : 0,
        roas: totalStats.investment > 0 ? 
          parseFloat((totalStats.revenue / totalStats.investment).toFixed(2)) : 0
      };
    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // ANÁLISE POR PRODUTO
  // ──────────────────────────────────────────────────────────
  async getProductAnalysis(filters) {
    const { startDate, endDate, platform, campaign, limit = 100, showIndividual = false } = filters;
    const conn = await this.pool.getConnection();
    
    try {
      const limitValue = parseInt(limit);
      
      // Query SUPER otimizada - SEM arquivos temporários
      // Filtra kits vs produtos individuais conforme solicitado
      const kitCondition = showIndividual === 'true' || showIndividual === true
        ? `AND (pvt.product_kit_id IS NOT NULL AND pvt.product_kit_id != '' AND pvt.product_kit_id != '0')`
        : `AND (pvt.product_kit_id IS NULL OR pvt.product_kit_id = '' OR pvt.product_kit_id = '0')`;
      
      const query = `
        SELECT 
          pvt.product_id,
          pvt.name AS product_name,
          pvt.reference AS sku,
          pvt.brand,
          pvt.product_kit_id,
          pvt.product_kit_id_kit,
          SUM(pvt.quantity) AS quantity_sold,
          ROUND(SUM(pvt.price * pvt.quantity), 2) AS revenue,
          ROUND(SUM(COALESCE(pvt.cost_price, 0) * pvt.quantity), 2) AS cost,
          ROUND(SUM((pvt.price - COALESCE(pvt.cost_price, 0)) * pvt.quantity), 2) AS profit
        FROM produtos_vendidos_tray_ecommerce pvt
        WHERE pvt.order_id IN (
          SELECT id FROM pedidos_ecommerce_tray
          WHERE date BETWEEN ? AND ?
        )
        ${kitCondition}
        GROUP BY pvt.product_id, pvt.name, pvt.reference, pvt.brand, pvt.product_kit_id, pvt.product_kit_id_kit
        ORDER BY revenue DESC
        LIMIT ${limitValue}
      `;
      
      const [products] = await conn.execute(query, [startDate, endDate]);

      // Se não há produtos, retornar vazio
      if (products.length === 0) {
        return [];
      }

      // Buscar métricas agregadas por plataforma no período (UMA VEZ APENAS)
      const platformMetrics = await this.getPlatformMetrics(startDate, endDate, platform);

      // Processar produtos com métricas agregadas
      const productsWithData = products.map(product => {
        const revenue = parseFloat(product.revenue || 0);
        const cost = parseFloat(product.cost || 0);
        const profit = parseFloat(product.profit || 0);
        
        // Estimar investimento proporcional baseado na receita
        const totalRevenue = platformMetrics.totalRevenue || 1;
        const productShare = revenue / totalRevenue;
        const estimatedInvestment = platformMetrics.totalInvestment * productShare;
        const estimatedClicks = Math.round(platformMetrics.totalClicks * productShare);
        
        // Identificar se veio de kit
        const isFromKit = product.product_kit_id && 
                         product.product_kit_id !== '' && 
                         product.product_kit_id !== '0';
        
        return {
          product_id: product.product_id,
          product_name: product.product_name,
          sku: product.sku,
          brand: product.brand,
          quantity_sold: parseInt(product.quantity_sold || 0),
          revenue,
          cost,
          profit,
          investment: parseFloat(estimatedInvestment.toFixed(2)),
          clicks: estimatedClicks,
          is_from_kit: isFromKit,
          platform_summary: platformMetrics.platforms,
          platform_campaigns: platformMetrics.platformCampaigns,
          campaigns_count: platformMetrics.totalCampaigns,
          campaign_links: platformMetrics.platformLinks,
          roi: estimatedInvestment > 0 ? parseFloat(((revenue - estimatedInvestment) / estimatedInvestment * 100).toFixed(2)) : 0,
          roas: estimatedInvestment > 0 ? parseFloat((revenue / estimatedInvestment).toFixed(2)) : 0
        };
      });

      return productsWithData;
    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // HELPER: Buscar métricas agregadas por plataforma
  // ──────────────────────────────────────────────────────────
  async getPlatformMetrics(startDate, endDate, platform = 'all') {
    const conn = await this.pool.getConnection();
    try {
      let totalInvestment = 0;
      let totalClicks = 0;
      let totalRevenue = 0;
      let totalCampaigns = 0;
      const platforms = [];
      const platformLinks = [];
      const platformCampaigns = [];

      // Facebook
      let fbData = null;
      if (platform === 'all' || platform === 'facebook') {
        try {
          const [result] = await conn.execute(`
            SELECT 
              COUNT(DISTINCT campaign_id) as campaigns,
              COALESCE(SUM(spend), 0) as investment,
              COALESCE(SUM(clicks), 0) as clicks,
              COALESCE(SUM(value_offsite_conversion_fb_pixel_purchase), 0) as revenue
            FROM facebook_campanhas
            WHERE metric_date BETWEEN ? AND ?
          `, [startDate, endDate]);
          fbData = result[0];
          
          if (fbData && fbData.campaigns > 0) {
            totalInvestment += parseFloat(fbData.investment || 0);
            totalClicks += parseInt(fbData.clicks || 0);
            totalRevenue += parseFloat(fbData.revenue || 0);
            totalCampaigns += parseInt(fbData.campaigns || 0);
            platforms.push('Facebook');
            platformLinks.push({
              platform: 'Facebook',
              url: 'https://business.facebook.com/adsmanager',
              label: 'Gerenciador de Anúncios Facebook'
            });
            platformCampaigns.push({
              platform: 'Facebook',
              campaigns: parseInt(fbData.campaigns || 0)
            });
          }
        } catch (err) {
          console.error('Error fetching Facebook metrics:', err.message);
        }
      }

      // Google
      let googleData = null;
      if (platform === 'all' || platform === 'google') {
        try {
          const [result] = await conn.execute(`
            SELECT 
              COUNT(DISTINCT campaign_id) as campaigns,
              COALESCE(SUM(metrics_cost), 0) as investment,
              COALESCE(SUM(metrics_clicks), 0) as clicks,
              COALESCE(SUM(metrics_conversionsvalue), 0) as revenue
            FROM googleads_custom_report
            WHERE segments_date BETWEEN ? AND ?
          `, [startDate, endDate]);
          googleData = result[0];
          
          if (googleData && googleData.campaigns > 0) {
            totalInvestment += parseFloat(googleData.investment || 0);
            totalClicks += parseInt(googleData.clicks || 0);
            totalRevenue += parseFloat(googleData.revenue || 0);
            totalCampaigns += parseInt(googleData.campaigns || 0);
            platforms.push('Google');
            platformLinks.push({
              platform: 'Google',
              url: 'https://ads.google.com',
              label: 'Google Ads'
            });
            platformCampaigns.push({
              platform: 'Google',
              campaigns: parseInt(googleData.campaigns || 0)
            });
          }
        } catch (err) {
          console.error('Error fetching Google metrics:', err.message);
        }
      }

      // TikTok
      let tiktokData = null;
      if (platform === 'all' || platform === 'tiktok') {
        try {
          const [result] = await conn.execute(`
            SELECT 
              COUNT(DISTINCT campaign_id) as campaigns,
              COALESCE(SUM(spend), 0) as investment,
              COALESCE(SUM(clicks), 0) as clicks,
              COALESCE(SUM(total_purchase), 0) as revenue
            FROM tiktokads_reports_campaign_report
            WHERE metric_date BETWEEN ? AND ?
          `, [startDate, endDate]);
          tiktokData = result[0];
          
          if (tiktokData && tiktokData.campaigns > 0) {
            totalInvestment += parseFloat(tiktokData.investment || 0);
            totalClicks += parseInt(tiktokData.clicks || 0);
            totalRevenue += parseFloat(tiktokData.revenue || 0);
            totalCampaigns += parseInt(tiktokData.campaigns || 0);
            platforms.push('TikTok');
            platformLinks.push({
              platform: 'TikTok',
              url: 'https://ads.tiktok.com',
              label: 'TikTok Ads Manager'
            });
            platformCampaigns.push({
              platform: 'TikTok',
              campaigns: parseInt(tiktokData.campaigns || 0)
            });
          }
        } catch (err) {
          console.error('Error fetching TikTok metrics:', err.message);
        }
      }

      return {
        totalInvestment,
        totalClicks,
        totalRevenue,
        totalCampaigns,
        platforms,
        platformLinks,
        platformCampaigns
      };
    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // ANÁLISE POR CAMPANHA
  // ──────────────────────────────────────────────────────────
  async getCampaignAnalysis(filters) {
    const { startDate, endDate, platform = 'all', limit = 100 } = filters;
    const conn = await this.pool.getConnection();
    
    try {
      const campaigns = [];

      // Facebook Campaigns
      if (platform === 'all' || platform === 'facebook') {
        const [fbCampaigns] = await conn.execute(`
          SELECT 
            'Facebook' AS platform,
            campaign_id,
            campaign_name,
            MIN(metric_date) AS start_date,
            MAX(metric_date) AS end_date,
            MAX(CASE WHEN objective IS NOT NULL THEN objective END) AS status,
            SUM(spend) AS investment,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            SUM(reach) AS reach,
            SUM(a_offsite_conversion_fb_pixel_purchase) AS purchases,
            SUM(value_offsite_conversion_fb_pixel_purchase) AS revenue,
            AVG(cpc) AS avg_cpc,
            AVG(cpm) AS avg_cpm,
            AVG(ctr) AS avg_ctr
          FROM facebook_campanhas
          WHERE metric_date BETWEEN ? AND ?
          GROUP BY campaign_id, campaign_name
          HAVING investment > 0
        `, [startDate, endDate]);
        campaigns.push(...fbCampaigns);
      }

      // Google Ads Campaigns
      if (platform === 'all' || platform === 'google') {
        const [googleCampaigns] = await conn.execute(`
          SELECT 
            'Google' AS platform,
            campaign_id,
            campaign_name,
            MIN(segments_date) AS start_date,
            MAX(segments_date) AS end_date,
            'Active' AS status,
            SUM(metrics_cost) AS investment,
            SUM(metrics_clicks) AS clicks,
            SUM(metrics_impressions) AS impressions,
            0 AS reach,
            SUM(metrics_conversions) AS purchases,
            SUM(metrics_conversionsvalue) AS revenue,
            AVG(metrics_costperallconversions) AS avg_cpc,
            0 AS avg_cpm,
            AVG((metrics_clicks / NULLIF(metrics_impressions, 0)) * 100) AS avg_ctr
          FROM googleads_custom_report
          WHERE segments_date BETWEEN ? AND ?
          GROUP BY campaign_id, campaign_name
          HAVING investment > 0
        `, [startDate, endDate]);
        campaigns.push(...googleCampaigns);
      }

      // TikTok Campaigns
      if (platform === 'all' || platform === 'tiktok') {
        const [tiktokCampaigns] = await conn.execute(`
          SELECT 
            'TikTok' AS platform,
            campaign_id,
            campaign_name,
            MIN(metric_date) AS start_date,
            MAX(metric_date) AS end_date,
            'Active' AS status,
            SUM(spend) AS investment,
            SUM(clicks) AS clicks,
            SUM(impressions) AS impressions,
            SUM(reach) AS reach,
            SUM(conversion) AS purchases,
            SUM(total_purchase) AS revenue,
            AVG(cost_per_result) AS avg_cpc,
            AVG(cost_per_1000_reached) AS avg_cpm,
            AVG((clicks / NULLIF(impressions, 0)) * 100) AS avg_ctr
          FROM tiktokads_reports_campaign_report
          WHERE metric_date BETWEEN ? AND ?
          GROUP BY campaign_id, campaign_name
          HAVING investment > 0
        `, [startDate, endDate]);
        campaigns.push(...tiktokCampaigns);
      }

      // Processar e ordenar
      return campaigns
        .map(c => ({
          ...c,
          investment: parseFloat(c.investment || 0),
          revenue: parseFloat(c.revenue || 0),
          clicks: parseInt(c.clicks || 0),
          impressions: parseInt(c.impressions || 0),
          reach: parseInt(c.reach || 0),
          purchases: parseFloat(c.purchases || 0),
          roas: c.investment > 0 ? parseFloat((c.revenue / c.investment).toFixed(2)) : 0,
          roi: c.investment > 0 ? 
            parseFloat(((c.revenue - c.investment) / c.investment * 100).toFixed(2)) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);

    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // CLIENTES QUE COMPRARAM UM PRODUTO ESPECÍFICO
  // ──────────────────────────────────────────────────────────
  async getProductCustomers(productId, startDate, endDate) {
    const conn = await this.pool.getConnection();
    try {
      const query = `
        SELECT DISTINCT
          c.id as customer_id,
          c.name as customer_name,
          c.cpf,
          c.cnpj,
          c.email,
          c.phone as telefone,
          c.city as cidade,
          c.state as estado,
          COUNT(DISTINCT pvt.order_id) as total_orders,
          SUM(pvt.quantity) as total_quantity,
          ROUND(SUM(pvt.price * pvt.quantity), 2) as total_spent
        FROM produtos_vendidos_tray_ecommerce pvt
        INNER JOIN pedidos_ecommerce_tray p ON pvt.order_id = p.id
        INNER JOIN clientes_tray_ecommerce c ON p.customer_id = c.id
        WHERE pvt.product_id = ?
          AND p.date BETWEEN ? AND ?
        GROUP BY c.id, c.name, c.cpf, c.cnpj, c.email, c.phone, c.city, c.state
        ORDER BY total_spent DESC
      `;
      
      const [customers] = await conn.execute(query, [productId, startDate, endDate]);
      return customers;
    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // DETALHES DE COMPRAS DE UM CLIENTE EM UM PRODUTO
  // ──────────────────────────────────────────────────────────
  async getCustomerProductPurchases(customerId, productId, startDate, endDate) {
    const conn = await this.pool.getConnection();
    try {
      const query = `
        SELECT 
          p.id as order_id,
          p.date as order_date,
          p.status as order_status,
          pvt.quantity,
          pvt.price as unit_price,
          ROUND(pvt.price * pvt.quantity, 2) as total_price,
          p.payment_form,
          p.shipment,
          p.shipment_value,
          p.discount
        FROM produtos_vendidos_tray_ecommerce pvt
        INNER JOIN pedidos_ecommerce_tray p ON pvt.order_id = p.id
        WHERE p.customer_id = ?
          AND pvt.product_id = ?
          AND p.date BETWEEN ? AND ?
        ORDER BY p.date DESC
      `;
      
      const [purchases] = await conn.execute(query, [customerId, productId, startDate, endDate]);
      return purchases;
    } finally {
      conn.release();
    }
  }
}

module.exports = TrafficService;
