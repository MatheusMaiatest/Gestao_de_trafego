require('dotenv').config();
const mysql = require('mysql2/promise');

async function analyzeTraffic() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const conn = await pool.getConnection();
    
    // Estatísticas das tabelas de tráfego
    console.log('\n📊 RESUMO COMPLETO DE TRÁFEGO PAGO');
    console.log('═'.repeat(100));
    
    const tables = {
      'facebook_ads': { label: 'Facebook Ads', dateCol: 'metric_date' },
      'facebook_campanhas': { label: 'Facebook Campanhas', dateCol: 'metric_date' },
      'facebook_orcamento_anuncios': { label: 'Facebook Orçamentos', dateCol: null },
      'googleads_custom_report': { label: 'Google Ads', dateCol: 'segments_date' },
      'tiktokads_reports_ad_report': { label: 'TikTok Ads', dateCol: 'metric_date' },
      'tiktokads_reports_ad_group_report': { label: 'TikTok Ad Groups', dateCol: 'metric_date' },
      'tiktokads_reports_campaign_report': { label: 'TikTok Campanhas', dateCol: 'metric_date' },
      'tiktokads_reports_reports_advertiser': { label: 'TikTok Advertiser', dateCol: 'metric_date' }
    };

    for (const [table, info] of Object.entries(tables)) {
      try {
        const [[count]] = await conn.execute(`SELECT COUNT(*) as total FROM \`${table}\``);
        
        let dateInfo = '';
        if (info.dateCol) {
          const [[dates]] = await conn.execute(
            `SELECT MIN(${info.dateCol}) as inicio, MAX(${info.dateCol}) as fim FROM \`${table}\``
          );
          if (dates.inicio && dates.fim) {
            dateInfo = ` | 📅 ${dates.inicio} até ${dates.fim}`;
          }
        }
        
        console.log(`\n✅ ${info.label.padEnd(30)} | 📊 ${count.total.toLocaleString().padStart(10)} registros${dateInfo}`);
        
        // Mostrar índices
        const [indexes] = await conn.execute(`SHOW INDEX FROM \`${table}\``);
        if (indexes.length > 0) {
          const uniqueIndexes = [...new Set(indexes.map(i => i.Key_name))];
          console.log(`   🔑 Índices: ${uniqueIndexes.join(', ')}`);
        }
        
      } catch (e) {
        console.log(`\n❌ ${info.label}: Erro - ${e.message}`);
      }
    }

    // Amostras de dados recentes
    console.log('\n\n📈 AMOSTRAS DE DADOS RECENTES (últimos 3 registros)');
    console.log('═'.repeat(100));
    
    // Facebook
    console.log('\n🔵 FACEBOOK ADS:');
    try {
      const [fb] = await conn.execute(
        `SELECT metric_date, campaign_name, spend, impressions, clicks, 
                a_purchase, a_add_to_cart, ctr, cpm 
         FROM facebook_ads 
         ORDER BY metric_date DESC LIMIT 3`
      );
      console.table(fb);
    } catch (e) {
      console.log('   ❌ Erro ao buscar dados');
    }

    // Google
    console.log('\n🔴 GOOGLE ADS:');
    try {
      const [ga] = await conn.execute(
        `SELECT segments_date, campaign_name, metrics_cost, 
                metrics_impressions, metrics_clicks, metrics_conversions,
                metrics_ctr
         FROM googleads_custom_report 
         ORDER BY segments_date DESC LIMIT 3`
      );
      console.table(ga);
    } catch (e) {
      console.log('   ❌ Erro ao buscar dados');
    }

    // TikTok
    console.log('\n⚫ TIKTOK ADS:');
    try {
      const [tk] = await conn.execute(
        `SELECT metric_date, campaign_name, spend, impressions, 
                clicks, purchase, ctr, cpm
         FROM tiktokads_reports_campaign_report 
         ORDER BY metric_date DESC LIMIT 3`
      );
      console.table(tk);
    } catch (e) {
      console.log('   ❌ Erro ao buscar dados');
    }

    // Buscar campanhas únicas
    console.log('\n\n🎯 CAMPANHAS ATIVAS POR PLATAFORMA');
    console.log('═'.repeat(100));
    
    try {
      const [[fbCamp]] = await conn.execute(
        `SELECT COUNT(DISTINCT campaign_id) as total FROM facebook_campanhas`
      );
      console.log(`\n🔵 Facebook: ${fbCamp.total} campanhas únicas`);
      
      const [fbTop] = await conn.execute(
        `SELECT campaign_name, SUM(spend) as total_gasto, SUM(impressions) as total_impressoes
         FROM facebook_campanhas
         GROUP BY campaign_name
         ORDER BY total_gasto DESC
         LIMIT 5`
      );
      console.log('\n   Top 5 Campanhas por Gasto:');
      console.table(fbTop);
    } catch (e) {
      console.log('   ❌ Erro ao analisar campanhas Facebook');
    }

    try {
      const [[gaCamp]] = await conn.execute(
        `SELECT COUNT(DISTINCT campaign_id) as total FROM googleads_custom_report`
      );
      console.log(`\n🔴 Google: ${gaCamp.total} campanhas únicas`);
      
      const [gaTop] = await conn.execute(
        `SELECT campaign_name, SUM(metrics_cost) as total_gasto, 
                SUM(metrics_impressions) as total_impressoes
         FROM googleads_custom_report
         GROUP BY campaign_name
         ORDER BY total_gasto DESC
         LIMIT 5`
      );
      console.log('\n   Top 5 Campanhas por Gasto:');
      console.table(gaTop);
    } catch (e) {
      console.log('   ❌ Erro ao analisar campanhas Google');
    }

    try {
      const [[tkCamp]] = await conn.execute(
        `SELECT COUNT(DISTINCT campaign_id) as total FROM tiktokads_reports_campaign_report`
      );
      console.log(`\n⚫ TikTok: ${tkCamp.total} campanhas únicas`);
      
      const [tkTop] = await conn.execute(
        `SELECT campaign_name, SUM(spend) as total_gasto, 
                SUM(impressions) as total_impressoes
         FROM tiktokads_reports_campaign_report
         GROUP BY campaign_name
         ORDER BY total_gasto DESC
         LIMIT 5`
      );
      console.log('\n   Top 5 Campanhas por Gasto:');
      console.table(tkTop);
    } catch (e) {
      console.log('   ❌ Erro ao analisar campanhas TikTok');
    }

    // Métricas consolidadas
    console.log('\n\n💰 INVESTIMENTO TOTAL POR PLATAFORMA (todos os períodos)');
    console.log('═'.repeat(100));
    
    try {
      const [[fbTotal]] = await conn.execute(
        `SELECT 
          SUM(spend) as total_investido,
          SUM(impressions) as total_impressoes,
          SUM(clicks) as total_cliques,
          SUM(a_purchase) as total_compras
         FROM facebook_ads`
      );
      console.log('\n🔵 Facebook Ads:');
      console.log(`   💰 Investimento: R$ ${(fbTotal.total_investido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   👁️  Impressões: ${(fbTotal.total_impressoes || 0).toLocaleString()}`);
      console.log(`   🖱️  Cliques: ${(fbTotal.total_cliques || 0).toLocaleString()}`);
      console.log(`   🛒 Compras: ${(fbTotal.total_compras || 0).toLocaleString()}`);
    } catch (e) {
      console.log('   ❌ Erro ao calcular totais Facebook');
    }

    try {
      const [[gaTotal]] = await conn.execute(
        `SELECT 
          SUM(metrics_cost) as total_investido,
          SUM(metrics_impressions) as total_impressoes,
          SUM(metrics_clicks) as total_cliques,
          SUM(metrics_conversions) as total_conversoes
         FROM googleads_custom_report`
      );
      console.log('\n🔴 Google Ads:');
      console.log(`   💰 Investimento: R$ ${(gaTotal.total_investido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   👁️  Impressões: ${(gaTotal.total_impressoes || 0).toLocaleString()}`);
      console.log(`   🖱️  Cliques: ${(gaTotal.total_cliques || 0).toLocaleString()}`);
      console.log(`   ✅ Conversões: ${(gaTotal.total_conversoes || 0).toLocaleString()}`);
    } catch (e) {
      console.log('   ❌ Erro ao calcular totais Google');
    }

    try {
      const [[tkTotal]] = await conn.execute(
        `SELECT 
          SUM(spend) as total_investido,
          SUM(impressions) as total_impressoes,
          SUM(clicks) as total_cliques,
          SUM(purchase) as total_compras
         FROM tiktokads_reports_campaign_report`
      );
      console.log('\n⚫ TikTok Ads:');
      console.log(`   💰 Investimento: R$ ${(tkTotal.total_investido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   👁️  Impressões: ${(tkTotal.total_impressoes || 0).toLocaleString()}`);
      console.log(`   🖱️  Cliques: ${(tkTotal.total_cliques || 0).toLocaleString()}`);
      console.log(`   🛒 Compras: ${(tkTotal.total_compras || 0).toLocaleString()}`);
    } catch (e) {
      console.log('   ❌ Erro ao calcular totais TikTok');
    }

    console.log('\n\n✅ Análise concluída!');
    console.log('═'.repeat(100));
    
    conn.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

analyzeTraffic();
