require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function extractHeaders() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  const conn = await pool.getConnection();
  
  const tables = [
    'produtos_vendidos_tray_ecommerce',
    'pedidos_ecommerce_tray',
    'pedidos_distribuicao_tray',
    'facebook_campanhas',
    'googleads_custom_report',
    'tiktokads_reports_campaign_report'
  ];
  
  let output = '';
  
  for(const table of tables) {
    const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
    output += `\n\n${'='.repeat(80)}\nTABELA: ${table}\n${'='.repeat(80)}\n`;
    output += `Total de colunas: ${cols.length}\n\n`;
    
    cols.forEach(c => {
      output += `CAMPO: ${c.Field}\n`;
      output += `  Tipo: ${c.Type}\n`;
      output += `  Nulo: ${c.Null}\n`;
      output += `  Chave: ${c.Key || 'N/A'}\n\n`;
    });
  }
  
  fs.appendFileSync('DICIONARIO-COMPLETO-DADOS-TRAFEGO.txt', output);
  console.log('Cabeçalhos adicionados ao documento!');
  
  conn.release();
  await pool.end();
}

extractHeaders();
