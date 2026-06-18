require('dotenv').config();
const mysql = require('mysql2/promise');

async function deepSearchAttribution() {
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
    console.log('BUSCA PROFUNDA - RELACIONAMENTO CAMPANHA → VENDA');
    console.log('═'.repeat(100));
    
    // 1. BUSCAR TODAS AS COLUNAS DAS TABELAS DE PEDIDOS
    console.log('\n\n🔍 1. ANALISANDO TODAS AS COLUNAS DE PEDIDOS TRAY (fonte original)\n' + '─'.repeat(100));
    
    const trayTables = [
      'pedidos_ecommerce_tray',
      'pedidos_distribuicao_tray',
      'detalhes_pedidos_ecommerce_tray',
      'tray_ecommerce_pedidos_detalhes'
    ];
    
    for (const table of trayTables) {
      try {
        const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
        console.log(`\n✅ ${table} (${cols.length} colunas):`);
        
        // Procurar por qualquer coluna suspeita
        const suspectCols = cols.filter(c => {
          const name = c.Field.toLowerCase();
          return name.includes('utm') || name.includes('source') || name.includes('medium') ||
                 name.includes('campaign') || name.includes('referr') || name.includes('origin') ||
                 name.includes('ad') || name.includes('url') || name.includes('link') ||
                 name.includes('track') || name.includes('tag') || name.includes('promo') ||
                 name.includes('cupom') || name.includes('voucher') || name.includes('discount') ||
                 name.includes('obs') || name.includes('observ') || name.includes('note') ||
                 name.includes('comments') || name.includes('metadata') || name.includes('extra') ||
                 name.includes('custom') || name.includes('field') || name.includes('attr');
        });
        
        if (suspectCols.length > 0) {
          console.log('   🎯 COLUNAS SUSPEITAS:');
          suspectCols.forEach(c => console.log(`      📌 ${c.Field} (${c.Type})`));
        } else {
          console.log('   ❌ Nenhuma coluna de tracking encontrada');
        }
        
        // Mostrar TODAS as colunas (para não perder nada)
        console.log(`\n   📋 TODAS AS COLUNAS:`);
        cols.forEach((c, i) => {
          if (i % 5 === 0) process.stdout.write('\n      ');
          process.stdout.write(`${c.Field.padEnd(30)} `);
        });
        console.log('\n');
        
        // Contar registros
        const [[count]] = await conn.execute(`SELECT COUNT(*) as total FROM \`${table}\``);
        console.log(`   📊 Total de registros: ${count.total.toLocaleString()}`);
        
      } catch (e) {
        console.log(`   ⚠️ Tabela não acessível: ${e.message}`);
      }
    }
    
    // 2. BUSCAR AMOSTRAS DE DADOS PARA IDENTIFICAR PADRÕES
    console.log('\n\n📝 2. AMOSTRA DE DADOS - Pedidos Tray (últimos 3)\n' + '─'.repeat(100));
    
    for (const table of trayTables) {
      try {
        const [sample] = await conn.execute(`SELECT * FROM \`${table}\` LIMIT 3`);
        if (sample.length > 0) {
          console.log(`\n✅ ${table}:`);
          console.table(sample);
        }
      } catch (e) {
        // Tabela não existe ou sem acesso
      }
    }
    
    // 3. PROCURAR TABELAS DE CUPONS/PROMOÇÕES (pode ter nome da campanha)
    console.log('\n\n🎫 3. BUSCAR TABELAS DE CUPONS/PROMOÇÕES/DESCONTOS\n' + '─'.repeat(100));
    
    const [allTables] = await conn.execute('SHOW TABLES');
    const couponTables = allTables.filter(t => {
      const name = Object.values(t)[0].toLowerCase();
      return name.includes('cupom') || name.includes('coupon') || name.includes('voucher') ||
             name.includes('promo') || name.includes('desconto') || name.includes('discount');
    });
    
    if (couponTables.length > 0) {
      console.log('✅ Tabelas encontradas:');
      for (const t of couponTables) {
        const tableName = Object.values(t)[0];
        console.log(`   📋 ${tableName}`);
        
        const [cols] = await conn.execute(`DESCRIBE \`${tableName}\``);
        cols.forEach(c => console.log(`      - ${c.Field} (${c.Type})`));
        
        const [[count]] = await conn.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        console.log(`      📊 ${count.total.toLocaleString()} registros\n`);
      }
    } else {
      console.log('❌ Nenhuma tabela de cupons encontrada');
    }
    
    // 4. BUSCAR TABELAS DE TRACKING/ANALYTICS
    console.log('\n\n📊 4. BUSCAR TABELAS DE TRACKING/ANALYTICS\n' + '─'.repeat(100));
    
    const trackingTables = allTables.filter(t => {
      const name = Object.values(t)[0].toLowerCase();
      return name.includes('track') || name.includes('analytics') || name.includes('event') ||
             name.includes('log') || name.includes('click') || name.includes('visit') ||
             name.includes('session') || name.includes('pixel');
    });
    
    if (trackingTables.length > 0) {
      console.log('✅ Tabelas encontradas:');
      trackingTables.forEach(t => console.log(`   📋 ${Object.values(t)[0]}`));
    } else {
      console.log('❌ Nenhuma tabela de tracking encontrada');
    }
    
    // 5. PROCURAR POR CAMPOS JSON/TEXT que podem conter metadados
    console.log('\n\n🔎 5. BUSCAR CAMPOS JSON/TEXT COM METADADOS\n' + '─'.repeat(100));
    
    const mainTables = [
      'bling_pedidos_venda_detalhes_ecommerce',
      'bling_pedidos_venda_detalhes_distribuicao',
      'pedidos_ecommerce_tray',
      'apedidos_tray_tratamento'
    ];
    
    for (const table of mainTables) {
      try {
        const [cols] = await conn.execute(`DESCRIBE \`${table}\``);
        const jsonCols = cols.filter(c => 
          c.Type.includes('json') || c.Type.includes('text') || c.Type.includes('blob')
        );
        
        if (jsonCols.length > 0) {
          console.log(`\n✅ ${table}:`);
          jsonCols.forEach(c => console.log(`   📝 ${c.Field} (${c.Type})`));
          
          // Buscar amostra desses campos
          for (const col of jsonCols) {
            try {
              const [sample] = await conn.execute(
                `SELECT ${col.Field} FROM \`${table}\` WHERE ${col.Field} IS NOT NULL AND ${col.Field} != '' LIMIT 1`
              );
              if (sample.length > 0 && sample[0][col.Field]) {
                console.log(`\n      📄 Amostra de ${col.Field}:`);
                const value = sample[0][col.Field];
                console.log('      ' + String(value).substring(0, 200));
              }
            } catch (e) {
              // Ignora erros
            }
          }
        }
      } catch (e) {
        // Tabela não existe
      }
    }
    
    // 6. BUSCAR RELACIONAMENTO INDIRETO VIA CLIENTE
    console.log('\n\n👤 6. INVESTIGAR RELACIONAMENTO VIA CLIENTE\n' + '─'.repeat(100));
    
    try {
      // Ver se clientes têm informação de origem
      const [clientCols] = await conn.execute(`DESCRIBE clientes_tray_ecommerce`);
      console.log('✅ Colunas de clientes_tray_ecommerce:');
      
      const relevantCols = clientCols.filter(c => {
        const name = c.Field.toLowerCase();
        return name.includes('source') || name.includes('origin') || name.includes('referr') ||
               name.includes('campaign') || name.includes('utm') || name.includes('tag') ||
               name.includes('created') || name.includes('registration');
      });
      
      if (relevantCols.length > 0) {
        relevantCols.forEach(c => console.log(`   🎯 ${c.Field} (${c.Type})`));
      } else {
        console.log('   ❌ Nenhuma coluna de origem encontrada');
      }
      
      // Amostra
      const [clientSample] = await conn.execute(`SELECT * FROM clientes_tray_ecommerce LIMIT 2`);
      if (clientSample.length > 0) {
        console.log('\n   📝 Amostra de clientes:');
        console.table(clientSample);
      }
      
    } catch (e) {
      console.log('   ⚠️ Erro ao acessar clientes: ' + e.message);
    }
    
    // 7. VERIFICAR SE HÁ ALGUMA TABELA DE ASSOCIAÇÃO/RELACIONAMENTO
    console.log('\n\n🔗 7. BUSCAR TABELAS DE ASSOCIAÇÃO/RELACIONAMENTO\n' + '─'.repeat(100));
    
    const relationTables = allTables.filter(t => {
      const name = Object.values(t)[0].toLowerCase();
      return name.includes('_x_') || name.includes('assoc') || name.includes('relation') ||
             name.includes('link') || name.includes('map') || name.includes('bridge');
    });
    
    if (relationTables.length > 0) {
      console.log('✅ Tabelas de associação encontradas:');
      for (const t of relationTables) {
        const tableName = Object.values(t)[0];
        console.log(`\n   📋 ${tableName}`);
        
        const [cols] = await conn.execute(`DESCRIBE \`${tableName}\``);
        cols.forEach(c => console.log(`      - ${c.Field} (${c.Type})`));
      }
    } else {
      console.log('❌ Nenhuma tabela de associação encontrada');
    }
    
    // 8. ANÁLISE FINAL - REGIÃO E TIPO DE CLIENTE NOS PEDIDOS
    console.log('\n\n🗺️ 8. DADOS DE REGIÃO E TIPO DE CLIENTE\n' + '─'.repeat(100));
    
    try {
      console.log('✅ Regiões disponíveis nos pedidos:');
      const [estados] = await conn.execute(`
        SELECT kdd_cliente_estado as estado, COUNT(*) as total
        FROM bling_pedidos_venda_detalhes_ecommerce
        WHERE kdd_cliente_estado IS NOT NULL
        GROUP BY kdd_cliente_estado
        ORDER BY total DESC
        LIMIT 10
      `);
      console.table(estados);
      
      console.log('\n✅ Tipos de pessoa (PF/PJ):');
      const [tipos] = await conn.execute(`
        SELECT contato_tipopessoa as tipo, COUNT(*) as total
        FROM bling_pedidos_venda_detalhes_ecommerce
        WHERE contato_tipopessoa IS NOT NULL
        GROUP BY contato_tipopessoa
      `);
      console.table(tipos);
      
    } catch (e) {
      console.log('   ⚠️ Erro: ' + e.message);
    }
    
    console.log('\n\n' + '═'.repeat(100));
    console.log('FIM DA BUSCA PROFUNDA');
    console.log('═'.repeat(100));
    
    conn.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

deepSearchAttribution();
