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
    const { startDate, endDate, platform, campaign, limit = 100 } = filters;
    const conn = await this.pool.getConnection();
    
    try {
      const limitValue = parseInt(limit);
      
      // Query otimizada para reduzir uso de temp files
      let query = `
        SELECT 
          pvt.product_id,
          pvt.name AS product_name,
          pvt.reference AS sku,
          pvt.brand,
          COUNT(DISTINCT pvt.order_id) AS orders_count,
          SUM(pvt.quantity) AS quantity_sold,
          SUM(pvt.price * pvt.quantity) AS revenue,
          SUM(COALESCE(pvt.cost_price, 0) * pvt.quantity) AS cost,
          SUM((pvt.price - COALESCE(pvt.cost_price, 0)) * pvt.quantity) AS profit,
          COUNT(DISTINCT pvt.id_campaign) AS campaigns_count,
          GROUP_CONCAT(DISTINCT pvt.id_campaign SEPARATOR ',') AS campaign_ids
        FROM produtos_vendidos_tray_ecommerce pvt
        INNER JOIN pedidos_ecommerce_tray pet ON pvt.order_id = pet.id
        WHERE pet.date BETWEEN ? AND ?
          AND pvt.id_campaign IS NOT NULL
          AND pvt.id_campaign != ''
      `;
      
      const params = [startDate, endDate];
      
      if (campaign) {
        query += ' AND pvt.id_campaign = ?';
        params.push(campaign);
      }
      
      query += `
        GROUP BY pvt.product_id, pvt.name, pvt.reference, pvt.brand
        ORDER BY revenue DESC
        LIMIT ${limitValue}
      `;
      
      const [products] = await conn.execute(query, params);

      // Processar produtos de forma mais eficiente
      const productsWithData = [];
      
      for (const product of products) {
        if (!product.campaign_ids) {
          productsWithData.push({
            ...product,
            revenue: parseFloat(product.revenue || 0),
            cost: parseFloat(product.cost || 0),
            profit: parseFloat(product.profit || 0),
            investment: 0,
            clicks: 0,
            roi: 0,
            roas: 0,
            campaign_links: []
          });
          continue;
        }
        
        // Limitar a 10 campanhas por produto para evitar queries muito grandes
        const campaignIds = product.campaign_ids.split(',')
          .filter(id => id && id.trim())
          .slice(0, 10);
        
        if (campaignIds.length === 0) {
          productsWithData.push({
            ...product,
            revenue: parseFloat(product.revenue || 0),
            cost: parseFloat(product.cost || 0),
            profit: parseFloat(product.profit || 0),
            investment: 0,
            clicks: 0,
            roi: 0,
            roas: 0,
            campaign_links: []
          });
          continue;
        }
        
        // Buscar dados das campanhas de forma otimizada
        const [investment, clicks, campaignLinks] = await Promise.all([
          this.getCampaignInvestment(campaignIds, startDate, endDate),
          this.getCampaignClicks(campaignIds, startDate, endDate),
          this.getCampaignLinks(campaignIds)
        ]);
        
        const revenue = parseFloat(product.revenue || 0);
        
        productsWithData.push({
          ...product,
          revenue,
          cost: parseFloat(product.cost || 0),
          profit: parseFloat(product.profit || 0),
          investment,
          clicks,
          campaign_links: campaignLinks,
          roi: investment > 0 ? parseFloat(((revenue - investment) / investment * 100).toFixed(2)) : 0,
          roas: investment > 0 ? parseFloat((revenue / investment).toFixed(2)) : 0
        });
      }

      return productsWithData;
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
  // HELPER: Buscar investimento total de campanhas
  // ──────────────────────────────────────────────────────────
  async getCampaignInvestment(campaignIds, startDate, endDate) {
    if (!campaignIds || campaignIds.length === 0) return 0;
    
    // Filtrar IDs válidos
    const validIds = campaignIds.filter(id => id != null && id !== '' && id !== 'null');
    if (validIds.length === 0) return 0;
    
    const conn = await this.pool.getConnection();
    try {
      const placeholders = validIds.map(() => '?').join(',');
      
      const queries = [
        // Facebook
        `SELECT COALESCE(SUM(spend), 0) AS total FROM facebook_campanhas 
         WHERE campaign_id IN (${placeholders}) AND metric_date BETWEEN ? AND ?`,
        // Google
        `SELECT COALESCE(SUM(metrics_cost), 0) AS total FROM googleads_custom_report 
         WHERE campaign_id IN (${placeholders}) AND segments_date BETWEEN ? AND ?`,
        // TikTok
        `SELECT COALESCE(SUM(spend), 0) AS total FROM tiktokads_reports_campaign_report 
         WHERE campaign_id IN (${placeholders}) AND metric_date BETWEEN ? AND ?`
      ];

      let total = 0;
      for (const query of queries) {
        try {
          const [rows] = await conn.execute(query, [...validIds, startDate, endDate]);
          total += parseFloat(rows[0]?.total || 0);
        } catch (err) {
          // Continuar se uma plataforma falhar
          console.error('Error in getCampaignInvestment:', err.message);
        }
      }

      return parseFloat(total.toFixed(2));
    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // HELPER: Buscar cliques totais de campanhas
  // ──────────────────────────────────────────────────────────
  async getCampaignClicks(campaignIds, startDate, endDate) {
    if (!campaignIds || campaignIds.length === 0) return 0;
    
    const validIds = campaignIds.filter(id => id != null && id !== '' && id !== 'null');
    if (validIds.length === 0) return 0;
    
    const conn = await this.pool.getConnection();
    try {
      const placeholders = validIds.map(() => '?').join(',');
      
      const queries = [
        `SELECT COALESCE(SUM(clicks), 0) AS total FROM facebook_campanhas 
         WHERE campaign_id IN (${placeholders}) AND metric_date BETWEEN ? AND ?`,
        `SELECT COALESCE(SUM(metrics_clicks), 0) AS total FROM googleads_custom_report 
         WHERE campaign_id IN (${placeholders}) AND segments_date BETWEEN ? AND ?`,
        `SELECT COALESCE(SUM(clicks), 0) AS total FROM tiktokads_reports_campaign_report 
         WHERE campaign_id IN (${placeholders}) AND metric_date BETWEEN ? AND ?`
      ];

      let total = 0;
      for (const query of queries) {
        try {
          const [rows] = await conn.execute(query, [...validIds, startDate, endDate]);
          total += parseInt(rows[0]?.total || 0);
        } catch (err) {
          console.error('Error in getCampaignClicks:', err.message);
        }
      }

      return total;
    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // HELPER: Buscar links das campanhas (otimizado)
  // ──────────────────────────────────────────────────────────
  async getCampaignLinks(campaignIds) {
    if (!campaignIds || campaignIds.length === 0) return [];
    
    const validIds = campaignIds.filter(id => id != null && id !== '' && id !== 'null');
    if (validIds.length === 0) return [];
    
    // Limitar a 5 campanhas para evitar queries muito pesadas
    const limitedIds = validIds.slice(0, 5);
    
    const conn = await this.pool.getConnection();
    try {
      const placeholders = limitedIds.map(() => '?').join(',');
      const links = [];
      
      // Facebook - buscar apenas dados essenciais
      try {
        const [fbRows] = await conn.execute(
          `SELECT campaign_id, 
                  SUBSTRING(campaign_name, 1, 50) as campaign_name 
           FROM facebook_campanhas 
           WHERE campaign_id IN (${placeholders})
           GROUP BY campaign_id, campaign_name
           LIMIT 5`,
          limitedIds
        );
        fbRows.forEach(row => {
          if (row.campaign_id) {
            links.push({
              platform: 'Facebook',
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name || 'Sem nome',
              url: `https://business.facebook.com/adsmanager/manage/campaigns?act=&selected_campaign_ids=${row.campaign_id}`
            });
          }
        });
      } catch (err) {
        console.error('Error fetching Facebook links:', err.message);
      }
      
      // Google Ads
      try {
        const [googleRows] = await conn.execute(
          `SELECT campaign_id,
                  SUBSTRING(campaign_name, 1, 50) as campaign_name  
           FROM googleads_custom_report 
           WHERE campaign_id IN (${placeholders})
           GROUP BY campaign_id, campaign_name
           LIMIT 5`,
          limitedIds
        );
        googleRows.forEach(row => {
          if (row.campaign_id) {
            links.push({
              platform: 'Google',
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name || 'Sem nome',
              url: `https://ads.google.com/aw/campaigns?campaignId=${row.campaign_id}`
            });
          }
        });
      } catch (err) {
        console.error('Error fetching Google links:', err.message);
      }
      
      // TikTok
      try {
        const [tiktokRows] = await conn.execute(
          `SELECT campaign_id,
                  SUBSTRING(campaign_name, 1, 50) as campaign_name 
           FROM tiktokads_reports_campaign_report 
           WHERE campaign_id IN (${placeholders})
           GROUP BY campaign_id, campaign_name
           LIMIT 5`,
          limitedIds
        );
        tiktokRows.forEach(row => {
          if (row.campaign_id) {
            links.push({
              platform: 'TikTok',
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name || 'Sem nome',
              url: `https://ads.tiktok.com/i18n/campaign?aadvid=${row.campaign_id}`
            });
          }
        });
      } catch (err) {
        console.error('Error fetching TikTok links:', err.message);
      }

      return links.slice(0, 10); // Máximo 10 links por produto
    } finally {
      conn.release();
    }
  }
}

module.exports = TrafficService;
