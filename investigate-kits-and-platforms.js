require('dotenv').config();
const mysql = require('mysql2/promise');

async function investigateKitsAndPlatforms() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  try {
    console.log('\n🔍 INVESTIGAÇÃO: Kits e Campanhas por Plataforma\n');
    console.log('='.repeat(80));

    // 1. Verificar se há campo que identifica kits
    console.log('\n1️⃣ Estrutura da tabela de produtos vendidos:');
    console.log('-'.repeat(80));
    const [columns] = await pool.execute(`DESCRIBE produtos_vendidos_tray_ecommerce`);
    console.log('Campos relacionados a kit/tipo:');
    columns.forEach(col => {
      if (col.Field.toLowerCase().includes('kit') || 
          col.Field.toLowerCase().includes('type') || 
          col.Field.toLowerCase().includes('tipo')) {
        console.log(`  ✓ ${col.Field} (${col.Type})`);
      }
    });

    // 2. Verificar produtos que podem ser kits (nome contém "kit")
    console.log('\n2️⃣ Produtos que parecem ser kits (5 exemplos):');
    console.log('-'.repeat(80));
    const [kits] = await pool.execute(`
      SELECT 
        product_id,
        name,
        reference as sku,
        price
      FROM produtos_vendidos_tray_ecommerce
      WHERE LOWER(name) LIKE '%kit%'
      LIMIT 5
    `);
    console.table(kits);

    // 3. Total de produtos vs produtos com "kit" no nome
    console.log('\n3️⃣ Estatísticas de Kits:');
    console.log('-'.repeat(80));
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT product_id) as total_produtos,
        COUNT(DISTINCT CASE WHEN LOWER(name) LIKE '%kit%' THEN product_id END) as produtos_kit,
        COUNT(DISTINCT CASE WHEN LOWER(name) NOT LIKE '%kit%' THEN product_id END) as produtos_individual
      FROM produtos_vendidos_tray_ecommerce
    `);
    console.table(stats);

    // 4. Número de campanhas POR PLATAFORMA no período recente
    const startDate = '2025-01-01';
    const endDate = '2026-06-18';
    
    console.log(`\n4️⃣ Campanhas por plataforma no período ${startDate} a ${endDate}:`);
    console.log('-'.repeat(80));

    const [fbCampaigns] = await pool.execute(`
      SELECT 
        'Facebook' as platform,
        COUNT(DISTINCT campaign_id) as total_campaigns
      FROM facebook_campanhas
      WHERE metric_date BETWEEN ? AND ?
    `, [startDate, endDate]);
    console.log(`📘 Facebook: ${fbCampaigns[0].total_campaigns} campanhas`);

    const [googleCampaigns] = await pool.execute(`
      SELECT 
        'Google' as platform,
        COUNT(DISTINCT campaign_id) as total_campaigns
      FROM googleads_custom_report
      WHERE segments_date BETWEEN ? AND ?
    `, [startDate, endDate]);
    console.log(`🔴 Google: ${googleCampaigns[0].total_campaigns} campanhas`);

    const [tiktokCampaigns] = await pool.execute(`
      SELECT 
        'TikTok' as platform,
        COUNT(DISTINCT campaign_id) as total_campaigns
      FROM tiktokads_reports_campaign_report
      WHERE metric_date BETWEEN ? AND ?
    `, [startDate, endDate]);
    console.log(`🎵 TikTok: ${tiktokCampaigns[0].total_campaigns} campanhas`);

    const totalCampaigns = 
      parseInt(fbCampaigns[0].total_campaigns || 0) + 
      parseInt(googleCampaigns[0].total_campaigns || 0) + 
      parseInt(tiktokCampaigns[0].total_campaigns || 0);
    
    console.log(`\n   ✅ TOTAL: ${totalCampaigns} campanhas`);

    // 5. Verificar estrutura de clientes
    console.log('\n5️⃣ Estrutura da tabela de clientes:');
    console.log('-'.repeat(80));
    const [customerCols] = await pool.execute(`DESCRIBE clientes_ecommerce_tray`);
    console.log('Campos disponíveis:');
    const importantFields = ['id', 'name', 'cpf', 'cnpj', 'email', 'phone', 'city', 'state'];
    customerCols.forEach(col => {
      if (importantFields.some(f => col.Field.toLowerCase().includes(f))) {
        console.log(`  ✓ ${col.Field} (${col.Type})`);
      }
    });

    // 6. Verificar estrutura de pedidos
    console.log('\n6️⃣ Estrutura da tabela de pedidos:');
    console.log('-'.repeat(80));
    const [orderCols] = await pool.execute(`DESCRIBE pedidos_ecommerce_tray`);
    console.log('Campos importantes:');
    const orderFields = ['id', 'customer_id', 'date', 'total', 'status'];
    orderCols.forEach(col => {
      if (orderFields.some(f => col.Field.toLowerCase().includes(f))) {
        console.log(`  ✓ ${col.Field} (${col.Type})`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ INVESTIGAÇÃO COMPLETA!\n');

  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    await pool.end();
  }
}

investigateKitsAndPlatforms();
