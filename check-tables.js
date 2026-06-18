require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTables() {
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
    
    // Listar todas as tabelas
    console.log('\n📋 TABELAS NO BANCO:');
    console.log('═'.repeat(80));
    const [tables] = await conn.execute('SHOW TABLES');
    tables.forEach((t, i) => {
      const tableName = Object.values(t)[0];
      console.log(`${i + 1}. ${tableName}`);
    });

    // Buscar tabelas relacionadas a tráfego/ads/campanhas
    console.log('\n\n🔍 TABELAS RELACIONADAS A TRÁFEGO PAGO:');
    console.log('═'.repeat(80));
    
    const keywords = ['trafego', 'traffic', 'campaign', 'ad', 'utm', 'marketing', 'conversion', 'click', 'impression', 'lead', 'meta', 'facebook', 'google', 'pixel'];
    
    let found = false;
    for (const table of tables) {
      const tableName = Object.values(table)[0].toLowerCase();
      for (const keyword of keywords) {
        if (tableName.includes(keyword)) {
          console.log(`✅ ${Object.values(table)[0]}`);
          
          // Mostrar estrutura da tabela
          const [columns] = await conn.execute(`DESCRIBE \`${Object.values(table)[0]}\``);
          console.log('   Colunas:');
          columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
          });
          console.log('');
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      console.log('❌ Nenhuma tabela relacionada a tráfego pago encontrada.');
    }

    conn.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

checkTables();
