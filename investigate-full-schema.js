require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function investigateFullSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const conn = await pool.getConnection();
    
    console.log('\n' + '═'.repeat(100));
    console.log('FASE 0 - INVESTIGAÇÃO COMPLETA DO SCHEMA');
    console.log('═'.repeat(100));
    
    // 1. LISTAR TODAS AS TABELAS
    console.log('\n\n📊 1. TODAS AS TABELAS DO BANCO DE DADOS\n' + '─'.repeat(100));
    const [tables] = await conn.execute('SHOW TABLES');
    
    const tablesByCategory = {
      trafego: [],
      vendas: [],
      produtos: [],
      clientes: [],
      nf: [],
      outras: []
    };
    
    tables.forEach((t) => {
      const tableName = Object.values(t)[0];
      const lower = tableName.toLowerCase();
      
      if (lower.includes('facebook') || lower.includes('google') || lower.includes('tiktok') || 
          lower.includes('ads') || lower.includes('campaign') || lower.includes('utm')) {
        tablesByCategory.trafego.push(tableName);
      } else if (lower.includes('pedido') || lower.includes('venda') || lower.includes('order') || 
                 lower.includes('sale')) {
        tablesByCategory.vendas.push(tableName);
      } else if (lower.includes('produto') || lower.includes('product') || lower.includes('item') ||
                 lower.includes('estrutura')) {
        tablesByCategory.produtos.push(tableName);
      } else if (lower.includes('cliente') || lower.includes('customer') || lower.includes('contato')) {
        tablesByCategory.clientes.push(tableName);
      } else if (lower.includes('nf') || lower.includes('nota') || lower.includes('fiscal') || 
                 lower.includes('invoice')) {
        tablesByCategory.nf.push(tableName);
      } else {
        tablesByCategory.outras.push(tableName);
      }
    });
    
    console.log('\n🔵 TABELAS DE TRÁFEGO PAGO (' + tablesByCategory.trafego.length + '):');
    tablesByCategory.trafego.forEach(t => console.log('   - ' + t));
    
    console.log('\n🟢 TABELAS DE VENDAS/PEDIDOS (' + tablesByCategory.vendas.length + '):');
    tablesByCategory.vendas.forEach(t => console.log('   - ' + t));
    
    console.log('\n🟡 TABELAS DE PRODUTOS (' + tablesByCategory.produtos.length + '):');
    tablesByCategory.produtos.forEach(t => console.log('   - ' + t));
    
    console.log('\n🟠 TABELAS DE CLIENTES (' + tablesByCategory.clientes.length + '):');
    tablesByCategory.clientes.forEach(t => console.log('   - ' + t));
    
    console.log('\n🟣 TABELAS DE NOTAS FISCAIS (' + tablesByCategory.nf.length + '):');
    tablesByCategory.nf.forEach(t => console.log('   - ' + t));
    
    console.log('\n⚪ OUTRAS TABELAS (' + tablesByCategory.outras.length + '):');
    tablesByCategory.outras.slice(0, 20).forEach(t => console.log('   - ' + t));
    if (tablesByCategory.outras.length > 20) {
      console.log(`   ... e mais ${tablesByCategory.outras.length - 20} tabelas`);
    }
    
    // 2. BUSCAR COLUNAS COM URL/LINK
    console.log('\n\n🔗 2. COLUNAS COM URL/LINK EM TABELAS DE TRÁFEGO\n' + '─'.repeat(100));
    
    for (const table of tablesByCategory.trafego) {
      const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
      const urlCols = cols.filter(c => {
        const name = c.Field.toLowerCase();
        return name.includes('url') || name.includes('link') || name.includes('permalink') || 
               name.includes('href');
      });
      
      if (urlCols.length > 0) {
        console.log(`\n✅ ${table}:`);
        urlCols.forEach(c => console.log(`   📎 ${c.Field} (${c.Type})`));
      }
    }
    
    // 3. BUSCAR RELACIONAMENTOS - Campaign ID/Name em tabelas de vendas
    console.log('\n\n🔄 3. BUSCAR RELACIONAMENTOS (Campaign/UTM em Vendas/NF)\n' + '─'.repeat(100));
    
    const relatedTables = [...tablesByCategory.vendas, ...tablesByCategory.nf];
    
    for (const table of relatedTables) {
      try {
        const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
        const campaignCols = cols.filter(c => {
          const name = c.Field.toLowerCase();
          return name.includes('campaign') || name.includes('campanha') || name.includes('utm') ||
                 name.includes('source') || name.includes('medium') || name.includes('ad_id') ||
                 name.includes('adset') || name.includes('advertiser');
        });
        
        if (campaignCols.length > 0) {
          console.log(`\n✅ ${table}:`);
          campaignCols.forEach(c => console.log(`   🔗 ${c.Field} (${c.Type})`));
        }
      } catch (e) {
        // Tabela pode não existir
      }
    }
    
    // 4. ESTRUTURA DE PRODUTOS
    console.log('\n\n📦 4. ESTRUTURA DE PRODUTOS\n' + '─'.repeat(100));
    
    for (const table of tablesByCategory.produtos.slice(0, 5)) {
      try {
        const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
        console.log(`\n📊 ${table} (${cols.length} colunas):`);
        
        // Mostrar colunas principais
        const mainCols = cols.filter(c => {
          const name = c.Field.toLowerCase();
          return name.includes('id') || name.includes('nome') || name.includes('name') ||
                 name.includes('codigo') || name.includes('code') || name.includes('sku') ||
                 name.includes('preco') || name.includes('price') || name.includes('valor');
        });
        
        mainCols.forEach(c => console.log(`   ${c.Field} (${c.Type})`));
        
        // Contar registros
        const [[count]] = await conn.execute(`SELECT COUNT(*) as total FROM \`${table}\``);
        console.log(`   📈 Total de registros: ${count.total.toLocaleString()}`);
      } catch (e) {
        console.log(`   ❌ Erro: ${e.message}`);
      }
    }
    
    // 5. ESTRUTURA DE PEDIDOS/VENDAS DETALHADA
    console.log('\n\n🛒 5. ESTRUTURA DE PEDIDOS/VENDAS (DETALHADA)\n' + '─'.repeat(100));
    
    for (const table of tablesByCategory.vendas.slice(0, 5)) {
      try {
        const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
        console.log(`\n📊 ${table} (${cols.length} colunas):`);
        
        // Agrupar colunas por categoria
        const colGroups = {
          ids: [],
          datas: [],
          valores: [],
          produtos: [],
          cliente: [],
          campanha: [],
          outras: []
        };
        
        cols.forEach(c => {
          const name = c.Field.toLowerCase();
          if (name.includes('id') && !name.includes('idio')) {
            colGroups.ids.push(c.Field);
          } else if (name.includes('data') || name.includes('date')) {
            colGroups.datas.push(c.Field);
          } else if (name.includes('valor') || name.includes('total') || name.includes('preco') || 
                     name.includes('price') || name.includes('desconto')) {
            colGroups.valores.push(c.Field);
          } else if (name.includes('produto') || name.includes('item') || name.includes('sku') || 
                     name.includes('codigo')) {
            colGroups.produtos.push(c.Field);
          } else if (name.includes('contato') || name.includes('cliente') || name.includes('customer')) {
            colGroups.cliente.push(c.Field);
          } else if (name.includes('campaign') || name.includes('campanha') || name.includes('utm') ||
                     name.includes('source') || name.includes('medium')) {
            colGroups.campanha.push(c.Field);
          } else {
            colGroups.outras.push(c.Field);
          }
        });
        
        if (colGroups.ids.length) console.log(`   🔑 IDs: ${colGroups.ids.join(', ')}`);
        if (colGroups.datas.length) console.log(`   📅 Datas: ${colGroups.datas.join(', ')}`);
        if (colGroups.valores.length) console.log(`   💰 Valores: ${colGroups.valores.join(', ')}`);
        if (colGroups.produtos.length) console.log(`   📦 Produtos: ${colGroups.produtos.join(', ')}`);
        if (colGroups.cliente.length) console.log(`   👤 Cliente: ${colGroups.cliente.join(', ')}`);
        if (colGroups.campanha.length) console.log(`   📢 Campanha: ${colGroups.campanha.join(', ')}`);
        
        // Contar registros
        const [[count]] = await conn.execute(`SELECT COUNT(*) as total FROM \`${table}\``);
        console.log(`   📈 Total de registros: ${count.total.toLocaleString()}`);
      } catch (e) {
        console.log(`   ❌ Erro: ${e.message}`);
      }
    }
    
    // 6. ÍNDICES NAS TABELAS DE TRÁFEGO
    console.log('\n\n🔍 6. ÍNDICES NAS TABELAS DE TRÁFEGO\n' + '─'.repeat(100));
    
    for (const table of tablesByCategory.trafego) {
      try {
        const [indexes] = await conn.execute(`SHOW INDEX FROM \`${table}\``);
        if (indexes.length > 0) {
          const uniqueIndexes = [...new Set(indexes.map(i => i.Key_name))];
          console.log(`\n✅ ${table}:`);
          uniqueIndexes.forEach(idx => {
            const cols = indexes.filter(i => i.Key_name === idx).map(i => i.Column_name);
            console.log(`   🔑 ${idx}: ${cols.join(', ')}`);
          });
        }
      } catch (e) {
        // Ignorar erros
      }
    }
    
    // 7. AMOSTRA DE DADOS - Pedidos com possível relacionamento
    console.log('\n\n📝 7. AMOSTRA DE DADOS - Pedidos (últimos 5 registros)\n' + '─'.repeat(100));
    
    const pedidosTable = tablesByCategory.vendas.find(t => 
      t.includes('pedido') || t.includes('venda')
    );
    
    if (pedidosTable) {
      try {
        // Detectar coluna de data
        const [cols] = await conn.execute(`DESCRIBE \`${pedidosTable}\``);
        const dateCol = cols.find(c => c.Field.toLowerCase().includes('data') || 
                                       c.Field.toLowerCase().includes('date'));
        
        let query = `SELECT * FROM \`${pedidosTable}\` `;
        if (dateCol) {
          query += `ORDER BY ${dateCol.Field} DESC `;
        }
        query += `LIMIT 5`;
        
        const [sample] = await conn.execute(query);
        console.table(sample);
      } catch (e) {
        console.log(`   ❌ Erro ao buscar amostra: ${e.message}`);
      }
    }
    
    console.log('\n\n✅ INVESTIGAÇÃO CONCLUÍDA!');
    console.log('═'.repeat(100));
    
    conn.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

investigateFullSchema();
