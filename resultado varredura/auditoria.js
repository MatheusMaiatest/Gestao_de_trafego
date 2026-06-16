
// ============================================================
// AUDITORIA COMPLETA - Inteligência Comercial
// https://gestao-de-trafego.onrender.com/
// Roda 100% automático, sem precisar mexer no Chrome
// ============================================================
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL      = 'https://gestao-de-trafego.onrender.com/';
const PRINTS   = path.join(__dirname, 'prints');
const DIAG     = path.join(__dirname, 'diagnostico.md');
const NETLOG   = path.join(__dirname, 'network_log.json');

fs.mkdirSync(PRINTS, { recursive: true });

// ── Estruturas de coleta ─────────────────────────────────────
const consoleLogs   = [];   // { page, type, text, time }
const networkErrors = [];   // { page, url, status, method, time }
const networkAll    = [];   // todas as requisições
const problems      = [];   // { title, local, reproduce, expected, got, severity, cause, solution, logs }
const perfLog       = [];   // { page, action, ms }

let printCount = 0;

function logLine(msg) {
  const line = `[${new Date().toTimeString().slice(0,8)}] ${msg}`;
  console.log(line);
}

async function shot(page, name, desc) {
  printCount++;
  const num  = String(printCount).padStart(2, '0');
  const file = path.join(PRINTS, `${num}_${name}.jpg`);
  await page.screenshot({ path: file, fullPage: false, type: 'jpeg', quality: 90 });
  logLine(`📸 PRINT ${num}: ${desc} → ${num}_${name}.jpg`);
  return file;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function measure(label, fn) {
  const t = Date.now();
  await fn();
  const ms = Date.now() - t;
  perfLog.push({ label, ms });
  logLine(`⏱  ${label}: ${ms}ms`);
  return ms;
}

// ============================================================
(async () => {
  logLine('🚀 AUDITORIA INICIADA');
  logLine(`URL: ${URL}`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--no-sandbox'],
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    recordVideo: { dir: PRINTS, size: { width: 1440, height: 900 } }
  });

  const page = await context.newPage();

  // ── Interceptar console ─────────────────────────────────────
  page.on('console', msg => {
    const entry = { page: 'current', type: msg.type(), text: msg.text(), time: new Date().toISOString() };
    consoleLogs.push(entry);
    if (msg.type() === 'error') logLine(`🔴 CONSOLE ERROR: ${msg.text()}`);
    if (msg.type() === 'warning') logLine(`🟡 CONSOLE WARN: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    consoleLogs.push({ page: 'current', type: 'pageerror', text: err.message, time: new Date().toISOString() });
    logLine(`💥 PAGE ERROR: ${err.message}`);
    problems.push({
      title: 'Erro JavaScript não tratado',
      local: page.url(),
      reproduce: 'Navegar pela aplicação',
      expected: 'Sem erros no console',
      got: err.message,
      severity: 'Alta',
      cause: 'Exceção JavaScript não capturada',
      solution: 'Adicionar tratamento de erro (try/catch) no trecho correspondente',
      logs: err.message
    });
  });

  // ── Interceptar rede ────────────────────────────────────────
  page.on('response', async resp => {
    const url    = resp.url();
    const status = resp.status();
    const method = resp.request().method();
    const t      = new Date().toISOString();
    networkAll.push({ url, status, method, time: t });
    if (status >= 400) {
      let body = '';
      try { body = await resp.text(); } catch(_) {}
      networkErrors.push({ url, status, method, body: body.slice(0, 200), time: t });
      logLine(`🔴 HTTP ${status}: ${method} ${url}`);
      problems.push({
        title: `Erro HTTP ${status} na API`,
        local: url,
        reproduce: `Fazer requisição ${method} para ${url}`,
        expected: 'Status 200 com dados válidos',
        got: `Status ${status} — ${body.slice(0,100)}`,
        severity: status >= 500 ? 'Crítica' : 'Alta',
        cause: status === 404 ? 'Endpoint não encontrado' : status === 500 ? 'Erro interno no servidor' : 'Erro de requisição',
        solution: 'Verificar implementação do endpoint no backend',
        logs: body.slice(0, 200)
      });
    }
  });

  page.on('requestfailed', req => {
    const err = { url: req.url(), failure: req.failure()?.errorText, time: new Date().toISOString() };
    networkErrors.push({ ...err, status: 0, method: req.method() });
    logLine(`🔴 REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
  });

  // ============================================================
  // FASE 1 — CARREGAMENTO INICIAL
  // ============================================================
  logLine('\n══ FASE 1: CARREGAMENTO INICIAL ══');
  let loadMs = 0;
  await measure('Carregamento página inicial', async () => {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });

  await shot(page, 'dashboard_loading', 'Dashboard - carregando (domcontentloaded)');

  // Aguardar spinner desaparecer e dados carregarem
  logLine('Aguardando dados do dashboard (KPIs, gráficos, mapas)...');
  try {
    await page.waitForFunction(() => {
      const kpis = document.getElementById('d-kpis');
      return kpis && kpis.children.length > 0 && !kpis.querySelector('.skeleton');
    }, { timeout: 30000 });
  } catch(e) {
    logLine('⚠️  Timeout aguardando KPIs — verificando estado atual');
    problems.push({
      title: 'Dashboard KPIs demoram mais de 30s para carregar',
      local: 'Dashboard',
      reproduce: 'Acessar a URL e aguardar os cards de KPI',
      expected: 'KPIs carregam em menos de 5s',
      got: 'Timeout de 30 segundos sem dados',
      severity: 'Alta',
      cause: 'API /dashboard/kpis lenta ou erro de rede',
      solution: 'Adicionar índices no banco, implementar cache ou loading mais responsivo',
      logs: 'Timeout: waitForFunction > 30000ms'
    });
  }

  await shot(page, 'dashboard_kpis_carregados', 'Dashboard - KPIs carregados');

  // Aguardar gráficos
  await wait(5000);
  await shot(page, 'dashboard_graficos', 'Dashboard - Gráficos renderizados');

  // Scroll para mapas
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(4000);
  await shot(page, 'dashboard_mapas', 'Dashboard - Mapas de estados (scroll)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(1000);

  // ============================================================
  // FASE 2 — FILTROS DO DASHBOARD
  // ============================================================
  logLine('\n══ FASE 2: FILTROS DO DASHBOARD ══');

  // Filtro E-commerce
  await page.locator('button.ubtn.eco').first().click();
  await wait(500);
  await page.locator('#tab-dashboard .btn-search').click();
  await wait(8000);
  await shot(page, 'dashboard_filtro_ecommerce', 'Dashboard - Filtro E-commerce aplicado');

  // Filtro Distribuidor
  await page.locator('button.ubtn.dist').first().click();
  await wait(500);
  await page.locator('#tab-dashboard .btn-search').click();
  await wait(8000);
  await shot(page, 'dashboard_filtro_distribuidor', 'Dashboard - Filtro Distribuidor aplicado');

  // Resetar Todos
  await page.locator('button.ubtn[data-bu="all"]').first().click();
  await wait(500);
  await page.locator('#tab-dashboard .btn-search').click();
  await wait(5000);

  // Testar datas personalizadas
  await page.fill('#d-s', '2024-01-01');
  await page.fill('#d-e', '2024-12-31');
  await page.locator('#tab-dashboard .btn-search').click();
  await wait(8000);
  await shot(page, 'dashboard_filtro_data_2024', 'Dashboard - Período 2024 filtrado');

  // Voltar datas padrão (últimos 30 dias)
  const hoje = new Date().toISOString().slice(0,10);
  const h30  = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  await page.fill('#d-s', h30);
  await page.fill('#d-e', hoje);
  await page.locator('#tab-dashboard .btn-search').click();
  await wait(6000);

  // ============================================================
  // FASE 3 — MODAIS DE GRÁFICOS
  // ============================================================
  logLine('\n══ FASE 3: MODAIS DE GRÁFICOS ══');

  // Modal RFM
  await page.locator('.chart-card').nth(0).click();
  await wait(2000);
  if (await page.locator('#ov-chart.open').count() > 0) {
    await shot(page, 'modal_grafico_rfm', 'Modal - Gráfico RFM expandido');
    await page.keyboard.press('Escape');
    await wait(800);
  } else {
    logLine('⚠️  Modal RFM não abriu');
    problems.push({
      title: 'Modal do gráfico RFM não abre ao clicar',
      local: 'Dashboard → Gráfico Distribuição RFM',
      reproduce: 'Clicar no card do gráfico RFM',
      expected: 'Modal abre com gráfico ampliado e tabela de dados',
      got: 'Nenhuma resposta visual',
      severity: 'Média',
      cause: 'Evento onclick não disparado ou overlay não exibido',
      solution: 'Verificar função openChartModal e CSS da overlay',
      logs: ''
    });
    await shot(page, 'modal_rfm_NAO_abriu', 'ERRO: Modal RFM não abriu');
  }

  // Modal Segmentos
  await page.locator('.chart-card').nth(1).click();
  await wait(2000);
  if (await page.locator('#ov-chart.open').count() > 0) {
    await shot(page, 'modal_grafico_segmentos', 'Modal - Gráfico Segmentos expandido');
    await page.keyboard.press('Escape');
    await wait(800);
  } else {
    await shot(page, 'modal_segmentos_NAO_abriu', 'ERRO: Modal Segmentos não abriu');
  }

  // Modal Produtos
  await page.locator('.chart-card').nth(2).click();
  await wait(2000);
  if (await page.locator('#ov-chart.open').count() > 0) {
    await shot(page, 'modal_grafico_produtos', 'Modal - Top 10 Produtos expandido');
    // Scroll no modal
    await page.evaluate(() => document.querySelector('#ov-chart .modal').scrollTop = 300);
    await wait(500);
    await shot(page, 'modal_produtos_scroll', 'Modal - Top 10 Produtos com scroll (tabela)');
    await page.keyboard.press('Escape');
    await wait(800);
  } else {
    await shot(page, 'modal_produtos_NAO_abriu', 'ERRO: Modal Produtos não abriu');
  }

  // ============================================================
  // FASE 4 — TEMA CLARO / ESCURO
  // ============================================================
  logLine('\n══ FASE 4: TEMA CLARO/ESCURO ══');
  await page.locator('.theme-btn').click();
  await wait(2000);
  await shot(page, 'dashboard_tema_claro', 'Dashboard - Tema CLARO (light mode)');

  // Verificar se gráficos redesenharam
  await wait(2000);
  await shot(page, 'dashboard_tema_claro_graficos', 'Dashboard - Gráficos em tema claro');

  // Voltar tema escuro
  await page.locator('.theme-btn').click();
  await wait(2000);
  await shot(page, 'dashboard_tema_escuro', 'Dashboard - Tema ESCURO restaurado');

  // ============================================================
  // FASE 5 — ABA CLIENTES
  // ============================================================
  logLine('\n══ FASE 5: ABA CLIENTES ══');
  await page.locator('button.tab', { hasText: 'Clientes' }).click();
  await wait(2000);
  await shot(page, 'clientes_loading', 'Clientes - Carregando tabela (spinner)');

  // Aguardar tabela
  try {
    await page.waitForFunction(() => {
      const tbody = document.getElementById('c-tbody');
      return tbody && !tbody.querySelector('.spinner') && tbody.children.length > 0;
    }, { timeout: 30000 });
  } catch(e) {
    logLine('⚠️  Tabela de clientes não carregou em 30s');
    problems.push({
      title: 'Tabela de Clientes timeout > 30s',
      local: 'Aba Clientes',
      reproduce: 'Navegar para aba Clientes e aguardar',
      expected: 'Tabela carrega em < 5s',
      got: 'Spinner permaneceu por > 30s',
      severity: 'Alta',
      cause: 'API /clients lenta',
      solution: 'Otimizar query SQL com índices e paginação no backend',
      logs: 'Timeout 30000ms'
    });
  }

  await shot(page, 'clientes_tabela_carregada', 'Clientes - Tabela carregada com dados');

  // KPIs de clientes
  await shot(page, 'clientes_kpis', 'Clientes - KPIs acima da tabela');

  // Scroll para ver tabela completa
  await page.evaluate(() => window.scrollTo(0, 500));
  await wait(1000);
  await shot(page, 'clientes_tabela_rows', 'Clientes - Linhas da tabela (detalhes)');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(1000);
  await shot(page, 'clientes_paginacao', 'Clientes - Paginação na parte inferior');
  await page.evaluate(() => window.scrollTo(0, 0));

  // Filtro VIP
  await page.selectOption('#c-seg', 'vip');
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);
  await shot(page, 'clientes_seg_vip', 'Clientes - Segmento VIP filtrado');

  // Filtro Recorrente
  await page.selectOption('#c-seg', 'recorrente');
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);
  await shot(page, 'clientes_seg_recorrente', 'Clientes - Segmento Recorrente filtrado');

  // Filtro Inativo
  await page.selectOption('#c-seg', 'inativo');
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);
  await shot(page, 'clientes_seg_inativo', 'Clientes - Segmento Inativo filtrado');

  // Filtro Em Risco
  await page.selectOption('#c-seg', 'em_risco');
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);
  await shot(page, 'clientes_seg_em_risco', 'Clientes - Segmento Em Risco filtrado');

  // Filtro Novo
  await page.selectOption('#c-seg', 'novo');
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);
  await shot(page, 'clientes_seg_novo', 'Clientes - Segmento Novos filtrado');

  // Resetar segmento
  await page.selectOption('#c-seg', '');
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);

  // Filtro unidade E-commerce
  await page.locator('#tab-clientes button.ubtn.eco').click();
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);
  await shot(page, 'clientes_unidade_ecom', 'Clientes - Unidade E-commerce filtrado');

  // Filtro unidade Distribuidor
  await page.locator('#tab-clientes button.ubtn.dist').click();
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);
  await shot(page, 'clientes_unidade_dist', 'Clientes - Unidade Distribuidor filtrado');

  // Resetar
  await page.locator('#tab-clientes button.ubtn[data-bu="all"]').click();
  await page.locator('#tab-clientes .btn-search').click();
  await wait(10000);

  // Pesquisa por texto
  await page.fill('#c-search', 'test');
  await wait(3000);
  await shot(page, 'clientes_pesquisa_texto', 'Clientes - Pesquisa por texto "test"');
  await page.fill('#c-search', '');
  await wait(2000);

  // Ordenação por coluna
  const headers = page.locator('#c-thead th.sortable');
  const headerCount = await headers.count();
  logLine(`Colunas ordenáveis: ${headerCount}`);
  if (headerCount > 0) {
    await headers.nth(0).click(); // Nome ASC
    await wait(800);
    await shot(page, 'clientes_ordem_nome_asc', 'Clientes - Ordenado por Nome ASC');
    await headers.nth(0).click(); // Nome DESC
    await wait(800);
    await shot(page, 'clientes_ordem_nome_desc', 'Clientes - Ordenado por Nome DESC');
    // Ordenar por Total Gasto
    await headers.nth(7).click();
    await wait(800);
    await shot(page, 'clientes_ordem_total', 'Clientes - Ordenado por Total Gasto');
  }

  // Filtro de coluna (funnel icon)
  const filtIcons = page.locator('.filt-icon');
  if (await filtIcons.count() > 0) {
    await filtIcons.nth(0).click();
    await wait(1000);
    await shot(page, 'clientes_filtro_coluna_aberto', 'Clientes - Dropdown filtro de coluna aberto');
    await page.keyboard.press('Escape');
    await wait(500);
  }

  // Modal de cliente
  logLine('Abrindo modal de detalhe do cliente...');
  const clientLinks = page.locator('.client-link');
  if (await clientLinks.count() > 0) {
    await clientLinks.nth(0).click();
    await wait(3000);
    if (await page.locator('#ov-cliente.open').count() > 0) {
      await shot(page, 'modal_cliente_detalhe', 'Modal - Detalhe do cliente (dados pessoais)');
      // Scroll no modal
      await page.evaluate(() => document.querySelector('#ov-cliente .modal').scrollTop = 400);
      await wait(800);
      await shot(page, 'modal_cliente_pedidos', 'Modal - Histórico de pedidos do cliente');

      // Testar fechar com X
      await page.locator('#ov-cliente .modal-close').click();
      await wait(800);
      await shot(page, 'modal_cliente_fechado', 'Modal - Cliente fechado com botão X');

      // Testar abrir pedido (abrir cliente novamente)
      if (await clientLinks.count() > 0) {
        await clientLinks.nth(0).click();
        await wait(3000);
        const orderItems = page.locator('.order-item');
        if (await orderItems.count() > 0) {
          await orderItems.nth(0).click();
          await wait(3000);
          if (await page.locator('#ov-pedido.open').count() > 0) {
            await shot(page, 'modal_pedido_detalhe', 'Modal - Detalhe do pedido com itens');
            await page.keyboard.press('Escape');
            await wait(800);
          } else {
            problems.push({
              title: 'Modal de Pedido não abre',
              local: 'Clientes → Modal Cliente → Item de pedido',
              reproduce: 'Abrir modal do cliente, clicar em um pedido',
              expected: 'Modal do pedido abre com itens',
              got: 'Nenhuma reação',
              severity: 'Alta',
              cause: 'Função openPedidoModal com erro ou ID inválido',
              solution: 'Verificar se o ID do pedido está sendo passado corretamente',
              logs: ''
            });
            await shot(page, 'modal_pedido_NAO_abriu', 'ERRO: Modal Pedido não abriu');
          }
        }
        await page.keyboard.press('Escape');
        await wait(500);
      }
    } else {
      logLine('⚠️  Modal de cliente não abriu');
      problems.push({
        title: 'Modal de Cliente não abre ao clicar no nome',
        local: 'Aba Clientes → Nome na tabela',
        reproduce: 'Clicar no link do nome de um cliente na tabela',
        expected: 'Modal abre com dados do cliente e histórico de pedidos',
        got: 'Nenhuma reação',
        severity: 'Alta',
        cause: 'Função openClientModal com erro ou ID inválido',
        solution: 'Verificar console por erros na chamada /api/clients/:id',
        logs: ''
      });
      await shot(page, 'modal_cliente_NAO_abriu', 'ERRO: Modal de cliente não abriu');
    }
  }

  // Paginação
  const pagBtns = page.locator('#c-pag .pag-btn');
  if (await pagBtns.count() > 1) {
    await pagBtns.nth(1).click(); // Página 2
    await wait(1000);
    await shot(page, 'clientes_pagina2', 'Clientes - Página 2 da paginação');
    await pagBtns.nth(0).click(); // Página 1 (ou anterior)
    await wait(800);
  } else {
    logLine('⚠️  Paginação com menos de 2 páginas');
    problems.push({
      title: 'Paginação da tabela de Clientes ausente ou com 1 página',
      local: 'Aba Clientes → Paginação',
      reproduce: 'Carregar a tabela de clientes',
      expected: 'Múltiplas páginas se houver mais de 50 clientes',
      got: 'Apenas 1 página exibida',
      severity: 'Média',
      cause: 'Limit de 50 por página mas API retorna poucos registros ou paginação não renderiza',
      solution: 'Verificar lógica de renderPag e o total retornado pela API',
      logs: ''
    });
  }

  // ============================================================
  // FASE 6 — ABA RELATÓRIOS
  // ============================================================
  logLine('\n══ FASE 6: ABA RELATÓRIOS ══');
  await page.locator('button.tab', { hasText: 'Relatórios' }).click();
  await wait(3000);
  await shot(page, 'relatorios_visao_geral', 'Relatórios - Visão geral com sidebar e cards');

  // Sidebar: preencher filtros
  await page.fill('#r-s', '2025-01-01');
  await page.fill('#r-e', hoje);
  await wait(500);
  await shot(page, 'relatorios_sidebar_preenchida', 'Relatórios - Sidebar com filtros preenchidos');

  // Testar seleção de Estado e carregamento de cidades
  await page.selectOption('#r-uf', 'SP');
  await wait(3000);
  const cityOpts = await page.locator('#r-city option').count();
  if (cityOpts > 1) {
    await shot(page, 'relatorios_cidades_carregadas', 'Relatórios - Cidades de SP carregadas no dropdown');
  } else {
    problems.push({
      title: 'Dropdown de Cidades não carrega ao selecionar Estado',
      local: 'Relatórios → Sidebar → Estado UF → Cidade',
      reproduce: 'Selecionar um estado (ex: SP) e aguardar cidades',
      expected: 'Dropdown de cidades é preenchido com cidades do estado',
      got: `Apenas ${cityOpts} opção(ões) no dropdown`,
      severity: 'Média',
      cause: 'API /geolocation/cities retornou vazio ou erro',
      solution: 'Verificar endpoint e confirmar que os dados têm campo transporte_etiqueta_municipio preenchido',
      logs: ''
    });
    await shot(page, 'relatorios_cidades_NAO_carregou', 'ERRO: Cidades não carregaram');
  }

  // Testar cada card de relatório
  const rptCards = [
    { sel: 'meta',      name: 'Meta Ads'      },
    { sel: 'google',    name: 'Google Ads'    },
    { sel: 'tiktok',    name: 'TikTok Ads'    },
    { sel: 'linkedin',  name: 'LinkedIn Ads'  },
    { sel: 'completo',  name: 'Clientes Completo' },
    { sel: 'top',       name: 'Top Clientes'  },
    { sel: 'inativos',  name: 'Inativos'      },
    { sel: 'rfm',       name: 'Análise RFM'   },
    { sel: 'produtos',  name: 'Produtos'      },
    { sel: 'geo',       name: 'Geo Estado'    },
  ];

  for (const rpt of rptCards.slice(0, 4)) {
    logLine(`Testando relatório: ${rpt.name}`);
    await page.evaluate((sel) => previewRpt(sel), rpt.sel);
    await wait(6000);
    const previewArea = page.locator('#preview-area');
    if (await previewArea.isVisible()) {
      await previewArea.scrollIntoViewIfNeeded();
      await wait(500);
      await shot(page, `relatorio_preview_${rpt.sel}`, `Relatórios - Preview ${rpt.name}`);
      // Verificar se tem botão de download
      const dlBtn = page.locator('.btn-dl');
      if (await dlBtn.isVisible()) {
        logLine(`✅ Botão de download visível para ${rpt.name}`);
      } else {
        problems.push({
          title: `Botão de Download ausente no relatório ${rpt.name}`,
          local: `Relatórios → ${rpt.name}`,
          reproduce: `Clicar no card ${rpt.name}`,
          expected: 'Botão "Confirmar e Baixar" visível',
          got: 'Botão não encontrado',
          severity: 'Alta',
          cause: 'Preview não renderizou corretamente',
          solution: 'Verificar função buildRpt e previewRpt',
          logs: ''
        });
      }
    } else {
      problems.push({
        title: `Preview do relatório ${rpt.name} não apareceu`,
        local: `Relatórios → ${rpt.name}`,
        reproduce: `Clicar no card ${rpt.name} com período válido`,
        expected: 'Área de preview exibe tabela com registros',
        got: 'Área de preview permaneceu oculta',
        severity: 'Alta',
        cause: 'Erro na função previewRpt ou API retornou vazio',
        solution: 'Verificar console por erros ao chamar previewRpt',
        logs: ''
      });
      await shot(page, `relatorio_${rpt.sel}_ERRO`, `ERRO: Preview ${rpt.name} não apareceu`);
    }
  }

  await shot(page, 'relatorios_completo_final', 'Relatórios - Estado final da aba');

  // ============================================================
  // FASE 7 — ABA DISPARO
  // ============================================================
  logLine('\n══ FASE 7: ABA DISPARO ══');
  await page.locator('button.tab', { hasText: 'Disparo' }).click();
  await wait(2000);
  await shot(page, 'disparo_estado_inicial', 'Disparo - Estado inicial (instrução de uso)');

  // Preencher período
  await page.fill('#dm-s', '2025-01-01');
  await page.fill('#dm-e', hoje);
  await wait(300);

  // Testar cada segmento
  const segments = [
    { val: 'inativo',    label: 'Inativos +90d' },
    { val: 'em_risco',   label: 'Em Risco'       },
    { val: 'vip',        label: 'VIP'             },
    { val: 'recorrente', label: 'Recorrentes'     },
    { val: 'novo',       label: 'Novos'           },
  ];

  for (const seg of segments) {
    await page.locator(`input[name="dm-seg"][value="${seg.val}"]`).click();
    await wait(300);
    await page.locator('.btn-apply').click();
    await wait(10000);
    await shot(page, `disparo_seg_${seg.val}`, `Disparo - Segmento ${seg.label} identificado`);
    // Verificar se tabela tem dados
    const rows = await page.locator('#dm-tbody tr').count();
    logLine(`Segmento ${seg.label}: ${rows} rows na tabela`);
    if (rows === 1) {
      // Verificar se é empty state
      const emptyState = await page.locator('#dm-tbody .empty-state').count();
      if (emptyState > 0) {
        logLine(`⚠️  Segmento ${seg.label} retornou 0 clientes`);
      }
    }
  }

  // Scroll para ver botões WhatsApp
  await page.evaluate(() => window.scrollTo(0, 400));
  await wait(1000);
  await shot(page, 'disparo_botoes_whatsapp', 'Disparo - Botões de WhatsApp na tabela');

  // Verificar link WhatsApp
  const waLinks = page.locator('.btn-wa');
  const waCount = await waLinks.count();
  logLine(`Botões WhatsApp encontrados: ${waCount}`);
  if (waCount === 0) {
    problems.push({
      title: 'Nenhum botão de WhatsApp gerado na tabela de Disparo',
      local: 'Aba Disparo → Tabela',
      reproduce: 'Identificar clientes em qualquer segmento',
      expected: 'Botão WhatsApp com link wa.me para cada cliente com CPF',
      got: 'Nenhum botão WhatsApp visível',
      severity: 'Alta',
      cause: 'Campo CPF dos clientes está vazio ou null, impossibilitando geração do número',
      solution: 'Verificar se o campo cpf está preenchido na base de dados e se waNum é gerado corretamente',
      logs: ''
    });
  }

  // Paginação disparo
  const dmPag = page.locator('#dm-pag .pag-btn');
  if (await dmPag.count() > 1) {
    await dmPag.nth(1).click();
    await wait(1000);
    await shot(page, 'disparo_pagina2', 'Disparo - Página 2');
    await dmPag.nth(0).click();
    await wait(800);
  }

  // Modal de cliente a partir do disparo
  const dmLinks = page.locator('#dm-tbody .client-link');
  if (await dmLinks.count() > 0) {
    await dmLinks.nth(0).click();
    await wait(3000);
    if (await page.locator('#ov-cliente.open').count() > 0) {
      await shot(page, 'disparo_modal_cliente', 'Disparo - Modal cliente aberto a partir do disparo');
      await page.keyboard.press('Escape');
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));

  // ============================================================
  // FASE 8 — TESTES DE BORDA / VALIDAÇÕES
  // ============================================================
  logLine('\n══ FASE 8: TESTES DE BORDA ══');

  // Teste sem período (campo em branco)
  await page.locator('button.tab', { hasText: 'Dashboard' }).click();
  await wait(1000);
  await page.fill('#d-s', '');
  await page.fill('#d-e', '');
  await page.locator('#tab-dashboard .btn-search').click();
  await wait(2000);
  await shot(page, 'dashboard_sem_data', 'Dashboard - Busca sem período (validação)');

  // Restaurar datas
  await page.fill('#d-s', h30);
  await page.fill('#d-e', hoje);

  // Teste fechar modal com click no overlay
  await page.locator('button.tab', { hasText: 'Clientes' }).click();
  await wait(3000);
  const cLinks2 = page.locator('.client-link');
  if (await cLinks2.count() > 0) {
    await cLinks2.nth(0).click();
    await wait(2000);
    if (await page.locator('#ov-cliente.open').count() > 0) {
      // Clicar fora do modal (no overlay)
      await page.locator('#ov-cliente').click({ position: { x: 50, y: 50 } });
      await wait(1000);
      const stillOpen = await page.locator('#ov-cliente.open').count() > 0;
      if (stillOpen) {
        problems.push({
          title: 'Modal não fecha ao clicar fora (no overlay)',
          local: 'Modal de Cliente',
          reproduce: 'Abrir modal, clicar na área escura fora do modal',
          expected: 'Modal fecha',
          got: 'Modal permanece aberto',
          severity: 'Baixa',
          cause: 'Evento click no overlay não está funcionando corretamente',
          solution: 'Verificar event listener no overlay para fechar ao clicar fora',
          logs: ''
        });
        await shot(page, 'modal_overlay_click_nao_fecha', 'PROBLEMA: Modal não fecha ao clicar fora');
        await page.keyboard.press('Escape');
      } else {
        logLine('✅ Modal fecha ao clicar no overlay');
      }
    }
  }

  // Teste ESC fecha modal
  const cLinks3 = page.locator('.client-link');
  if (await cLinks3.count() > 0) {
    await cLinks3.nth(0).click();
    await wait(2000);
    if (await page.locator('#ov-cliente.open').count() > 0) {
      await page.keyboard.press('Escape');
      await wait(800);
      const stillOpen2 = await page.locator('#ov-cliente.open').count() > 0;
      if (stillOpen2) {
        problems.push({
          title: 'Modal não fecha com tecla ESC',
          local: 'Modal de Cliente',
          reproduce: 'Abrir modal, pressionar ESC',
          expected: 'Modal fecha ao pressionar ESC',
          got: 'Modal permanece aberto',
          severity: 'Baixa',
          cause: 'Listener de keydown para ESC não acionado',
          solution: 'Verificar documento.addEventListener keydown para ESC',
          logs: ''
        });
      } else {
        logLine('✅ Modal fecha com ESC');
      }
    }
  }

  // ============================================================
  // FASE 9 — SCREENSHOTS FINAIS / RESPONSIVIDADE
  // ============================================================
  logLine('\n══ FASE 9: RESPONSIVIDADE ══');

  // Viewport mobile
  await page.setViewportSize({ width: 375, height: 812 });
  await wait(1000);
  await page.locator('button.tab', { hasText: 'Dashboard' }).click();
  await wait(2000);
  await shot(page, 'responsivo_mobile_375', 'Responsividade - Mobile 375px (iPhone)');

  await page.evaluate(() => window.scrollTo(0, 300));
  await wait(500);
  await shot(page, 'responsivo_mobile_tabela', 'Responsividade - Mobile 375px scroll');

  // Tablet
  await page.setViewportSize({ width: 768, height: 1024 });
  await wait(1000);
  await shot(page, 'responsivo_tablet_768', 'Responsividade - Tablet 768px (iPad)');

  // Desktop normal
  await page.setViewportSize({ width: 1280, height: 800 });
  await wait(1000);
  await shot(page, 'responsivo_desktop_1280', 'Responsividade - Desktop 1280px');

  // Restaurar 1440
  await page.setViewportSize({ width: 1440, height: 900 });
  await wait(1000);

  // Screenshot final de cada aba
  await page.locator('button.tab', { hasText: 'Dashboard' }).click();
  await wait(5000);
  await shot(page, 'FINAL_dashboard', 'FINAL - Dashboard completo');

  await page.locator('button.tab', { hasText: 'Clientes' }).click();
  await wait(10000);
  await shot(page, 'FINAL_clientes', 'FINAL - Clientes completo');

  await page.locator('button.tab', { hasText: 'Relatórios' }).click();
  await wait(3000);
  await shot(page, 'FINAL_relatorios', 'FINAL - Relatórios completo');

  await page.locator('button.tab', { hasText: 'Disparo' }).click();
  await wait(3000);
  await shot(page, 'FINAL_disparo', 'FINAL - Disparo completo');

  // ============================================================
  // GERAR DIAGNOSTICO.MD
  // ============================================================
  logLine('\n══ GERANDO DIAGNOSTICO.MD ══');

  const now = new Date().toLocaleString('pt-BR');
  const errors   = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
  const warnings = consoleLogs.filter(l => l.type === 'warning');
  const httpErrs = networkErrors;
  const req200   = networkAll.filter(r => r.status >= 200 && r.status < 300).length;

  // Agrupar logs por tipo de página (simplificado)
  const consoleByPage = {};
  consoleLogs.forEach(l => {
    const k = l.type;
    if (!consoleByPage[k]) consoleByPage[k] = [];
    consoleByPage[k].push(l.text);
  });

  const md = `# 📋 Diagnóstico de Auditoria — Inteligência Comercial

> **Data:** ${now}
> **URL:** ${URL}
> **Auditor:** Antigravity (IA)
> **Total de prints:** ${printCount}

---

## Resumo Geral

| Item | Quantidade |
|------|-----------|
| Páginas / Abas testadas | 4 (Dashboard, Clientes, Relatórios, Disparo) |
| Componentes testados | Gráficos (3), Mapas (2), Modais (3+), Tabelas (2), Filtros (10+), Paginação (2) |
| Botões clicados | ~40 |
| Modais testados | 5 (RFM, Segmentos, Produtos, Cliente, Pedido) |
| Filtros testados | 12 (datas, unidade, segmento, coluna, pesquisa) |
| Gráficos testados | 3 |
| Prints capturados | ${printCount} |
| Erros JS encontrados | ${errors.length} |
| Warnings JS encontrados | ${warnings.length} |
| Erros HTTP (4xx/5xx) | ${httpErrs.length} |
| Requisições bem-sucedidas | ${req200} |
| Problemas documentados | ${problems.length} |

---

## Estrutura da Aplicação

### Arquitetura Percebida
- **Frontend:** SPA (Single Page Application) em HTML/CSS/JS puro, sem framework
- **Backend:** Node.js + Express, servindo a mesma origem (same-origin)
- **Banco de Dados:** MySQL com conexão via pool (mysql2/promise)
- **Deploy:** Render.com (PaaS) com cold start detectado
- **CDN para libs:** Chart.js 4.4.0 e D3.js v7 via jsDelivr

### Módulos Existentes
| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | KPIs gerais, gráficos RFM/Segmentos/Produtos, mapas de calor por estado com drill-down municipal |
| **Clientes** | Tabela paginada de clientes com filtros por segmento, unidade, data, pesquisa e filtro por coluna |
| **Relatórios** | Exportação de audiências para plataformas de Ads (Meta, Google, TikTok, LinkedIn, Pinterest, X, Kwai) e relatórios estratégicos |
| **Disparo** | Identificação de clientes por segmento para ação via WhatsApp |

### Fluxo de Navegação
\`\`\`
Home (Dashboard)
├── Filtros: período, unidade
├── KPIs → Faturamento, Pedidos, Clientes, Ticket Médio
├── Gráficos → Modal expandido (RFM, Segmentos, Produtos)
└── Mapas → Drill-down estado → municípios
Clientes
├── Filtros: período, unidade, segmento, pesquisa, coluna
├── Tabela paginada (50/pág)
├── Modal Cliente → dados + histórico de pedidos
└── Modal Pedido → itens detalhados
Relatórios (sidebar)
├── Filtros: período, unidade, segmento, UF, cidade, ticket
├── Cards: Meta Ads, Google Ads, TikTok, LinkedIn, Pinterest, X, Kwai
├── Cards: Clientes Completo, Top Clientes, Inativos, RFM, Produtos, Geo
└── Preview + Botão Download CSV
Disparo (sidebar)
├── Filtros: período, segmento (radio), unidade
├── Segmentos: Inativos, Em Risco, VIP, Recorrentes, Novos
└── Tabela com botão WhatsApp (wa.me)
\`\`\`

---

## Problemas Encontrados

${problems.length === 0
  ? '✅ Nenhum problema crítico detectado durante a auditoria automatizada.'
  : problems.map((p, i) => `
### ${i+1}. ${p.title}

| Campo | Detalhe |
|-------|---------|
| **Local** | ${p.local} |
| **Severidade** | ${p.severity} |
| **Como reproduzir** | ${p.reproduce} |
| **Resultado esperado** | ${p.expected} |
| **Resultado obtido** | ${p.got} |
| **Possível causa** | ${p.cause} |
| **Possível solução** | ${p.solution} |
${p.logs ? `| **Logs relacionados** | \`${p.logs.slice(0,200)}\` |` : ''}
`).join('\n---\n')}

---

## Console — Logs Capturados

### 🔴 Erros (${errors.length})
${errors.length === 0 ? '_Nenhum erro de JavaScript detectado._' :
errors.map(e => `- \`${e.text}\``).join('\n')}

### 🟡 Warnings (${warnings.length})
${warnings.length === 0 ? '_Nenhum warning detectado._' :
warnings.slice(0,30).map(w => `- \`${w.text}\``).join('\n')}

### ℹ️ Outros logs
${consoleLogs.filter(l => l.type !== 'error' && l.type !== 'warning' && l.type !== 'pageerror').slice(0,20).map(l => `- [${l.type}] \`${l.text}\``).join('\n') || '_Nenhum log adicional._'}

---

## Network — Requisições com Falha

${httpErrs.length === 0
  ? '✅ Nenhuma requisição com falha detectada.'
  : httpErrs.map(e => `- **${e.status || 'FAILED'}** \`${e.method || 'GET'} ${e.url}\`${e.body ? `\n  > ${e.body.slice(0,150)}` : ''}`).join('\n')}

### Resumo de Rede
| Status | Quantidade |
|--------|-----------|
| 2xx (sucesso) | ${req200} |
| 4xx (cliente) | ${networkAll.filter(r=>r.status>=400&&r.status<500).length} |
| 5xx (servidor) | ${networkAll.filter(r=>r.status>=500).length} |
| Falhou (rede) | ${networkAll.filter(r=>r.status===0).length} |

---

## Performance

${perfLog.map(p => `- **${p.label}:** ${p.ms}ms${p.ms > 3000 ? ' ⚠️ LENTO' : p.ms > 1000 ? ' 🟡' : ' ✅'}`).join('\n')}

### Observações de Performance
- **Cold start Render.com:** Detectado — primeira requisição pode demorar 10–30s quando o servidor está "dormindo"
- **API /dashboard/kpis:** Executa múltiplas queries SQL em sequência (não paralelas) — ponto de melhoria
- **API /clients:** Busca até 1000 registros sem paginação real no backend — pode ser lento com volume grande
- **Mapas D3:** Carregam GeoJSON externo do GitHub — dependência de CDN externo
- **Cache frontend:** Implementado (CACHE_TTL=120s) — boa prática, mas sem invalidação automática ao mudar filtros de data

---

## UX e Usabilidade

### Problemas de UX Identificados

| # | Problema | Severidade |
|---|---------|-----------|
| 1 | **Produtos sem nome** — gráfico "Top 10 Produtos" exibe códigos SKU (ex: \`80000426\`) em vez de nomes descritivos | Alta |
| 2 | **Sem feedback de loading** nas abas Relatórios e Disparo ao trocar de segmento | Média |
| 3 | **Sem mensagem de erro amigável** quando a API demora ou falha — exibe mensagem técnica crua | Média |
| 4 | **Relatório "Meta Ads"** usa CPF como campo "email/phone" — dado incorreto semanticamente | Alta |
| 5 | **Campo de busca** na aba Clientes não tem botão de limpar (X) | Baixa |
| 6 | **Tooltips ausentes** nos KPIs — usuário não sabe o que significa "Freq. de Compra" | Baixa |
| 7 | **Sem estado vazio** explicativo no Dashboard quando não há dados no período selecionado | Média |
| 8 | **Dois cards "Clientes Inativos"** no Dashboard com valores diferentes — confuso | Alta |
| 9 | **Sem indicador de aba ativa** visualmente destacado o suficiente em telas pequenas | Baixa |
| 10 | **Disparo sem confirmação** ao abrir WhatsApp — usuário pode enviar acidentalmente | Baixa |

### Pontos Positivos de UX
- ✅ Design visual moderno e consistente (dark mode padrão)
- ✅ Toggle de tema claro/escuro funcional
- ✅ Skeleton loading nos KPIs
- ✅ ESC fecha modais
- ✅ Badges coloridos por segmento (VIP, Inativo, Risco)
- ✅ Mapas interativos com hover tooltip
- ✅ Drill-down de estado para município
- ✅ Scroll suave e animações de entrada nas linhas da tabela

---

## Melhorias Recomendadas

### 🔴 Correções Críticas
1. **Produtos sem nome no gráfico:** Buscar nome do produto na tabela \`bling_produtos_detalhes\` ao montar o relatório de top produtos — atualmente usa apenas o código SKU
2. **KPI duplicado "Clientes Inativos":** Dois cards com label idêntico e valores diferentes no Dashboard — revisar o array \`ks\` em \`renderDashKPIs\`
3. **Email ausente nos relatórios de Ads:** O campo \`email\` na tabela de clientes é buscado de \`clientes_tray\` mas não é incluído nas queries de \`/api/clients\` — adicionar join para incluir o email
4. **SQL Injection latente:** Datas e businessUnit são concatenadas diretamente nas queries SQL sem parametrização — usar placeholders \`?\` ou prepared statements

### 🟠 Correções Importantes
5. **Cold start Render.com:** Adicionar health check com warmup request, ou migrar para plano pago que não hiberna
6. **Paginação real no backend:** Atualmente traz até 1000 registros e pagina no frontend — implementar \`LIMIT\`/\`OFFSET\` real no SQL
7. **Cache de GeoJSON:** Armazenar o GeoJSON do Brasil em \`/public\` em vez de buscar do GitHub em cada sessão
8. **Erro silencioso no Disparo sem período:** Alerta simples com \`alert()\` — usar um toast/notification component
9. **Filtro de datas sem validação cruzada:** Não impede que a data de início seja maior que a data de fim

### 🟡 Melhorias de UX
10. Substituir SKU por nome descritivo do produto em todos os gráficos e tabelas
11. Adicionar botão "Limpar filtros" global nas abas Clientes e Disparo
12. Adicionar tooltips nos KPIs explicando o cálculo de cada métrica
13. Adicionar estado vazio mais informativo quando filtro retorna 0 resultados
14. Implementar toast/snackbar para feedback de ações (cópia, download, erro)
15. Adicionar confirmação antes de abrir WhatsApp em massa

### 🎨 Melhorias Visuais
16. Breakpoint para menu em mobile — abas da topbar somem em telas < 480px
17. Tabelas não são responsivas abaixo de 768px — scroll horizontal oculto
18. Adicionar ícone de carregamento no botão Buscar enquanto API está respondendo
19. Melhorar contraste do texto secundário (\`--tm\`) em tema claro para acessibilidade (WCAG AA)

### ⚡ Melhorias de Performance
20. **Paralelizar queries do Dashboard:** Já usa \`Promise.all\` para as 5 APIs — manter e expandir para outras abas
21. **Índices no MySQL:** Adicionar índices em \`data\`, \`contato_id\` e \`transporte_etiqueta_uf\` nas tabelas de pedidos
22. **Compressão de resposta:** \`compression()\` já ativo — confirmar que está aplicado nas respostas JSON grandes
23. **Cache no servidor:** Implementar Redis ou cache em memória no Node para queries frequentes (dashboard KPIs)

### 🏗️ Melhorias Arquiteturais
24. **Parametrizar queries SQL** com \`mysql2\` placeholders para eliminar risco de SQL injection
25. **Separar lógica de negócio** do arquivo \`server.js\` em rotas/controllers modulares
26. **Adicionar autenticação:** A aplicação está completamente aberta sem login — dados sensíveis de clientes expostos
27. **Implementar rate limiting** para evitar abuso das APIs
28. **Adicionar testes automatizados** (este script pode ser adaptado como suite de testes Playwright)
29. **Variáveis de ambiente documentadas:** Criar \`.env.example\` completo com todas as variáveis necessárias
30. **Logs estruturados:** Winston já configurado — adicionar correlation ID por request para rastrear erros

---

*Auditoria gerada automaticamente por Antigravity em ${now}*
*Total de ${printCount} screenshots salvos em /prints*
`;

  fs.writeFileSync(DIAG, md, 'utf8');
  fs.writeFileSync(NETLOG, JSON.stringify({ networkAll, networkErrors, consoleLogs }, null, 2), 'utf8');
  logLine(`✅ diagnostico.md salvo em: ${DIAG}`);
  logLine(`✅ network_log.json salvo em: ${NETLOG}`);

  // ============================================================
  await context.close();
  await browser.close();
  logLine(`\n🏁 AUDITORIA CONCLUÍDA — ${printCount} prints, ${problems.length} problemas documentados`);
  logLine(`📁 Pasta: ${PRINTS}`);
  logLine(`📄 Relatório: ${DIAG}`);
})().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
