require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function exportColumns() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  const conn = await pool.getConnection();
  
  const tables = [
    'facebook_campanhas',
    'facebook_orcamento_anuncios', 
    'googleads_custom_report',
    'tiktokads_reports_campaign_report',
    'tiktokads_reports_ad_group_report',
    'tiktokads_reports_ad_report',
    'tiktokads_reports_reports_advertiser'
  ];

  let output = '';
  
  for(const t of tables) {
    const [cols] = await conn.execute(`DESCRIBE \`${t}\``);
    output += `TABELA: ${t}\n`;
    output += '='.repeat(100) + '\n';
    cols.forEach(c => {
      output += `${c.Field.padEnd(70)} | ${c.Type}\n`;
    });
    output += '\n\n';
  }
  
  fs.writeFileSync('COLUNAS-TRAFEGO-PAGO.txt', output);
  console.log('Arquivo COLUNAS-TRAFEGO-PAGO.txt gerado com sucesso!');
  
  conn.release();
  await pool.end();
}

exportColumns();
