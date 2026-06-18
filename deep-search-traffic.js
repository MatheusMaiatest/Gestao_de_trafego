require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function deepSearchTraffic() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  let output = '';
  
  function log(msg) {
    console.log(msg);
    output += msg + '\n';
  }

  try {
    const conn = await pool.getConnection();
    
    log('\n' + '═'.repeat(100));
    log('BUSCA COMPLETA - DADOS DE TRÁFEGO PAGO');
    log('═'.repeat(100));
    
    // 1. LISTAR TODAS AS TABELAS
    log('\n\n📋 1. LISTANDO TODAS AS TABELAS DO BANCO\n' + '─'.repeat(100));
    const [tables] = await conn.execute('SHOW TABLES');
    log(`\nTotal de tabelas encontradas: ${tables.length}\n`);
    
    const allTableNames = tables.map(t => Object.values(t)[0]);
    
    // 2. BUSCAR TABELAS COM PALAVRAS-CHAVE DE TRÁFEGO
    log('\n\n🔍 2. BUSCA POR PALAVRAS-CHAVE RELACIONADAS A TRÁFEGO PAGO\n' + '─'.repeat(100));
    
    const keywords = [
      'campaign', 'campanha',
      'utm', 'source', 'medium',
      'ad', 'ads', 'anuncio',
      'google', 'facebook', 'meta', 'tiktok', 'instagram',
      'traffic', 'trafego',
      'marketing', 'advertis',
      'conversion', 'conversao',
      'attribution', 'atribuicao',
      'click', 'impression',
      'cost', 'custo', 'gasto',
      'roi', 'roas'
    ];
    
    const matchedTables = {};
    
    for (const keyword of keywords) {
      const matches = allTableNames.filter(t => 
        t.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (matches.length > 0) {
        matchedTables[keyword] = matches;
        log(`\n🎯 Palavra-chave: "${keyword}"`);
        matches.forEach(t => log(`   ✓ ${t}`));
      }
    }
    
    if (Object.keys(matchedTables).length === 0) {
      log('\n⚠️  Nenhuma tabela encontrada com palavras-chave de tráfego no nome.');
    }
    
    // 3. BUSCAR COLUNAS COM DADOS DE TRÁFEGO EM TODAS AS TABELAS
    log('\n\n🔎 3. BUSCANDO COLUNAS RELACIONADAS A TRÁFEGO EM TODAS AS TABELAS\n' + '─'.repeat(100));
    log('(Isso pode levar alguns minutos...)\n');
    
    const tablesWithTrafficCols = [];
    
    for (const tableName of allTableNames) {
      try {
        const [cols] = await conn.execute(`DESCRIBE \`${tableName}\``);
        
        const trafficCols = cols.filter(c => {
          const fieldLower = c.Field.toLowerCase();
          return keywords.some(kw => fieldLower.includes(kw.toLowerCase()));
        });
        
        if (trafficCols.length > 0) {
          tablesWithTrafficCols.push({
            table: tableName,
            columns: trafficCols.map(c => ({ name: c.Field, type: c.Type }))
          });
        }
      } catch (e) {
        // Ignorar tabelas com erro
      }
    }
    
    if (tablesWithTrafficCols.length > 0) {
      log(`\n✅ Encontradas ${tablesWithTrafficCols.length} tabelas com colunas de tráfego:\n`);
      
      for (const item of tablesWithTrafficCols) {
        log(`\n📊 Tabela: ${item.table}`);
        log(`   Colunas relacionadas a tráfego (${item.columns.length}):`);
        item.columns.forEach(col => {
          log(`   • ${col.name} (${col.type})`);
        });
        
        // Tentar contar registros
        try {
          const [[count]] = await conn.execute(`SELECT COUNT(*) as total FROM \`${item.table}\``);
          log(`   📈 Total de registros: ${count.total.toLocaleString()}`);
        } catch (e) {
          log(`   ⚠️  Não foi possível contar registros`);
        }
      }
    } else {
      log('\n⚠️  Nenhuma coluna relacionada a tráfego encontrada nas tabelas.');
    }
    
    // 4. BUSCAR VIEWS (VISUALIZAÇÕES)
    log('\n\n👁️  4. BUSCANDO VIEWS (VISUALIZAÇÕES)\n' + '─'.repeat(100));
    
    try {
      const [views] = await conn.execute(
        `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`,
        [process.env.DB_NAME]
      );
      
      if (views.length > 0) {
        log(`\nEncontradas ${views.length} views:\n`);
        views.forEach(v => log(`   • ${v.TABLE_NAME}`));
      } else {
        log('\n⚠️  Nenhuma view encontrada.');
      }
    } catch (e) {
      log(`\n❌ Erro ao buscar views: ${e.message}`);
    }
    
    // 5. BUSCAR STORED PROCEDURES
    log('\n\n⚙️  5. BUSCANDO STORED PROCEDURES\n' + '─'.repeat(100));
    
    try {
      const [procs] = await conn.execute(
        `SELECT ROUTINE_NAME FROM information_schema.ROUTINES 
         WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`,
        [process.env.DB_NAME]
      );
      
      if (procs.length > 0) {
        log(`\nEncontradas ${procs.length} stored procedures:\n`);
        procs.forEach(p => log(`   • ${p.ROUTINE_NAME}`));
      } else {
        log('\n⚠️  Nenhuma stored procedure encontrada.');
      }
    } catch (e) {
      log(`\n❌ Erro ao buscar procedures: ${e.message}`);
    }
    
    // 6. BUSCAR TRIGGERS
    log('\n\n⚡ 6. BUSCANDO TRIGGERS\n' + '─'.repeat(100));
    
    try {
      const [triggers] = await conn.execute(
        `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION 
         FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`,
        [process.env.DB_NAME]
      );
      
      if (triggers.length > 0) {
        log(`\nEncontrados ${triggers.length} triggers:\n`);
        triggers.forEach(t => {
          log(`   • ${t.TRIGGER_NAME} → ${t.EVENT_OBJECT_TABLE} (${t.ACTION_TIMING} ${t.EVENT_MANIPULATION})`);
        });
      } else {
        log('\n⚠️  Nenhum trigger encontrado.');
      }
    } catch (e) {
      log(`\n❌ Erro ao buscar triggers: ${e.message}`);
    }
    
    // 7. BUSCAR ÍNDICES EM TABELAS RELEVANTES
    log('\n\n🔑 7. ÍNDICES EM TABELAS COM DADOS DE TRÁFEGO\n' + '─'.repeat(100));
    
    for (const item of tablesWithTrafficCols.slice(0, 10)) {
      try {
        const [indexes] = await conn.execute(`SHOW INDEX FROM \`${item.table}\``);
        
        if (indexes.length > 0) {
          const uniqueIndexes = [...new Set(indexes.map(i => i.Key_name))];
          log(`\n📊 ${item.table}:`);
          
          uniqueIndexes.forEach(idx => {
            const indexCols = indexes.filter(i => i.Key_name === idx);
            const colNames = indexCols.map(i => i.Column_name).join(', ');
            const type = indexCols[0].Non_unique === 0 ? 'UNIQUE' : 'INDEX';
            log(`   • ${idx} (${type}): ${colNames}`);
          });
        }
      } catch (e) {
        // Ignorar erros
      }
    }
    
    // 8. TABELAS DE PEDIDOS - INVESTIGAR RELACIONAMENTO COM TRÁFEGO
    log('\n\n🛒 8. INVESTIGAÇÃO DE PEDIDOS E RELACIONAMENTO COM TRÁFEGO\n' + '─'.repeat(100));
    
    const orderTables = allTableNames.filter(t => {
      const lower = t.toLowerCase();
      return lower.includes('pedido') || lower.includes('venda') || 
             lower.includes('order') || lower.includes('sale');
    });
    
    log(`\nEncontradas ${orderTables.length} tabelas de pedidos/vendas:\n`);
    
    for (const table of orderTables) {
      try {
        const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
        
        log(`\n📦 ${table} (${cols.length} colunas):`);
        
        // Buscar colunas importantes
        const importantCols = {
          ids: [],
          dates: [],
          values: [],
          customer: [],
          traffic: [],
          location: []
        };
        
        cols.forEach(c => {
          const lower = c.Field.toLowerCase();
          
          if (lower.includes('id')) {
            importantCols.ids.push(c.Field);
          }
          if (lower.includes('data') || lower.includes('date')) {
            importantCols.dates.push(c.Field);
          }
          if (lower.includes('valor') || lower.includes('total') || lower.includes('preco') || lower.includes('price')) {
            importantCols.values.push(c.Field);
          }
          if (lower.includes('cliente') || lower.includes('customer') || lower.includes('contato')) {
            importantCols.customer.push(c.Field);
          }
          if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
            importantCols.traffic.push(c.Field);
          }
          if (lower.includes('estado') || lower.includes('cidade') || lower.includes('uf') || 
              lower.includes('regiao') || lower.includes('state') || lower.includes('city')) {
            importantCols.location.push(c.Field);
          }
        });
        
        if (importantCols.ids.length) log(`   🔑 IDs: ${importantCols.ids.join(', ')}`);
        if (importantCols.dates.length) log(`   📅 Datas: ${importantCols.dates.join(', ')}`);
        if (importantCols.values.length) log(`   💰 Valores: ${importantCols.values.join(', ')}`);
        if (importantCols.customer.length) log(`   👤 Cliente: ${importantCols.customer.join(', ')}`);
        if (importantCols.location.length) log(`   📍 Localização: ${importantCols.location.join(', ')}`);
        if (importantCols.traffic.length) log(`   📢 TRÁFEGO: ${importantCols.traffic.join(', ')}`);
        
        // Contar registros
        try {
          const [[count]] = await conn.execute(`SELECT COUNT(*) as total FROM \`${table}\``);
          log(`   📊 Total de registros: ${count.total.toLocaleString()}`);
        } catch (e) {
          // Ignorar erro
        }
        
      } catch (e) {
        log(`   ❌ Erro: ${e.message}`);
      }
    }
    
    // 9. AMOSTRAS DE DADOS
    log('\n\n📄 9. AMOSTRAS DE DADOS DAS TABELAS COM TRÁFEGO\n' + '─'.repeat(100));
    
    for (const item of tablesWithTrafficCols.slice(0, 3)) {
      try {
        log(`\n📊 Tabela: ${item.table}\n`);
        
        const [rows] = await conn.execute(`SELECT * FROM \`${item.table}\` LIMIT 2`);
        
        if (rows.length > 0) {
          log('Amostra de dados:');
          rows.forEach((row, idx) => {
            log(`\n--- Registro ${idx + 1} ---`);
            Object.entries(row).forEach(([key, value]) => {
              const displayValue = value !== null && value !== undefined ? 
                                  String(value).substring(0, 100) : 'NULL';
              log(`${key}: ${displayValue}`);
            });
          });
        } else {
          log('   ⚠️  Tabela vazia');
        }
        
      } catch (e) {
        log(`   ❌ Erro ao buscar amostra: ${e.message}`);
      }
    }
    
    log('\n\n' + '═'.repeat(100));
    log('✅ BUSCA COMPLETA CONCLUÍDA!');
    log('═'.repeat(100));
    
    // Salvar resultado em arquivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `BUSCA-TRAFEGO-COMPLETA-${timestamp}.txt`;
    fs.writeFileSync(filename, output);
    log(`\n📁 Relatório salvo em: ${filename}`);
    
    conn.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

deepSearchTraffic();
