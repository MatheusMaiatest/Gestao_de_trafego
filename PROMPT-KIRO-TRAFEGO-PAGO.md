# Prompt para o Kiro — Implementação da Aba "Dados de Tráfego Pago"

Você irá atuar como arquiteto e desenvolvedor desta aplicação. Sua tarefa é **investigar a base de dados existente e, com base no que encontrar, projetar e implementar uma nova aba chamada "Dados de Tráfego Pago"**, totalmente integrada ao sistema já existente.

Este projeto já possui um banco de dados maduro, com tabelas de tráfego pago (Facebook Ads, Google Ads, TikTok Ads), tabelas de pedidos, notas fiscais e produtos. Todas as informações necessárias para este módulo — métricas de campanha, relacionamento entre produto e campanha, e URLs de campanha/conjunto/anúncio — **já existem no banco**. Sua primeira responsabilidade é encontrá-las.

---

## Fase 0 — Investigação obrigatória do schema (não pular)

Antes de escrever qualquer linha de código ou query:

1. **Faça introspecção completa do banco de dados.** Liste todas as tabelas existentes, não apenas as de tráfego pago. Preste atenção especial a tabelas de pedidos, vendas, notas fiscais (NF) e produtos.
2. **Leia o dicionário de dados de tráfego pago já disponível no projeto** (`DICIONARIO-COMPLETO-TRAFEGO-PAGO.txt` / `COLUNAS-TRAFEGO-PAGO.txt`), que descreve as tabelas:
   - `facebook_campanhas`
   - `facebook_orcamento_anuncios`
   - `googleads_custom_report`
   - `tiktokads_reports_campaign_report`
   - `tiktokads_reports_ad_group_report`
   - `tiktokads_reports_ad_report`
   - `tiktokads_reports_reports_advertiser`

   Use esse dicionário como fonte de verdade para nomes de colunas dessas tabelas — não suponha nomes.
3. **Identifique e documente o(s) relacionamento(s) entre tráfego pago e vendas/produtos.** Isso pode ocorrer via `campaign_id`, `campaign_name`, UTM parameters, `adset_id`/`ad_id`, ou qualquer outra chave/coluna que você encontrar nas tabelas de pedidos/NF que aponte de volta para uma campanha ou plataforma de anúncio. Mapeie isso explicitamente antes de seguir.
4. **Localize as colunas de URL.** Procure em todas as tabelas (tráfego pago, pedidos, cadastro de campanhas, etc.) por colunas que armazenem links de campanha, conjunto de anúncios (adset) ou anúncio individual (ex: `permalink_url`, `object_url`, `campaign_url`, `ad_url`, ou nomes equivalentes). Documente em quais tabelas e colunas cada tipo de link aparece.
5. **Identifique a tabela/coluna de produto** que permite ligar uma venda a um item vendido (nome do produto, SKU, ID de produto), para viabilizar a análise "Produto × Campanha".
6. **Detecte a stack tecnológica atual do projeto** (linguagem de backend, framework, ORM/query builder, framework de frontend, biblioteca de gráficos já em uso, padrão de autenticação e de chamadas de API). A nova aba deve seguir exatamente os mesmos padrões já estabelecidos no restante do sistema — mesma estrutura de pastas, mesmo estilo de service/controller/rota, mesmo design system de UI.
7. **Identifique índices existentes** nas tabelas envolvidas (datas, campaign_id, account_id, etc.) para que as queries da Fase 1 em diante os utilizem corretamente.

Documente o resultado dessa investigação (mesmo que resumidamente em comentários/README do módulo) antes de avançar — isso evita suposições incorretas sobre nomes de colunas ou relacionamentos.

---

## Objetivo do módulo

Criar um módulo de Business Intelligence voltado para análise de campanhas de tráfego pago, cruzando os dados de Facebook Ads, Google Ads e TikTok Ads com os dados reais de vendas (pedidos/NF/produtos) descobertos na Fase 0.

---

# Estrutura da nova aba

Criar uma nova seção do sistema chamada:

**Dados de Tráfego Pago**

Interface limpa, moderna, dividida em blocos de análise, seguindo o design system já utilizado no restante da aplicação.

---

# Fontes de dados

Utilizar os dados já existentes no banco referentes às plataformas:

* Facebook Ads (Meta)
* Google Ads
* TikTok Ads

A arquitetura deve ser preparada para suportar novas plataformas no futuro sem necessidade de reescrever o módulo (ver seção "Escalabilidade").

---

# Dashboard Geral

Apresentar indicadores resumidos como:

* Investimento total
* Receita gerada
* Compras
* Cliques
* Impressões
* Alcance
* Custo por Clique (CPC)
* Custo por Mil Exibições (CPM)
* Taxa de Cliques (CTR)
* Custo por Conversão
* Retorno sobre Investimento (ROAS/ROI)

Caso a investigação da Fase 0 revele métricas adicionais relevantes disponíveis nas tabelas (ex: taxa de checkout, custo por lead, valor por registro, frequência, alcance, eventos de carrinho/wishlist, etc.), incorpore-as ao dashboard, mantendo a interface organizada — agrupe métricas relacionadas em seções/abas dentro do dashboard ao invés de poluir a tela principal.

Esses indicadores devem possuir filtros por:

* período
* plataforma
* campanha
* produto

---

# Análise por Produto

Tela específica mostrando, para cada produto:

* Nome
* Quantidade vendida
* Receita
* Investimento utilizado (atribuído via relacionamento descoberto na Fase 0)
* Lucro estimado (quando os dados de custo/NF permitirem)
* Quantidade de campanhas que venderam esse produto

Responder automaticamente:

* Qual produto vendeu mais?
* Qual produto gerou mais faturamento?
* Qual produto recebeu mais investimento?
* Qual produto teve melhor retorno?
* Qual produto teve pior desempenho?
* Qual produto vendeu em mais campanhas?

---

# Análise por Campanha

Visualização completa para cada campanha contendo:

* Nome da campanha
* Plataforma
* Status
* Período
* Investimento
* Cliques
* Impressões
* Compras
* Receita
* Retorno sobre Investimento

Responder automaticamente:

* Qual campanha vendeu mais?
* Qual campanha gerou mais receita?
* Qual campanha teve maior investimento?
* Qual campanha apresentou melhor retorno?
* Qual campanha teve maior quantidade de compras?

---

# Relação Produto × Campanha

Uma das partes mais importantes do módulo.

Criar uma visualização dinâmica permitindo navegar:

**Produto → Campanhas que venderam esse produto → Resultados obtidos em cada campanha** (receita, compras, investimento, retorno)

E o inverso:

**Campanha → Todos os produtos vendidos por ela**, com os mesmos indicadores.

Use o relacionamento identificado na Fase 0 (item 3) para construir essas queries.

---

# Links das campanhas

Sempre que houver URL disponível nas tabelas do banco (identificadas na Fase 0, item 4), exibir um botão **"Abrir campanha"** (e equivalentes para conjunto de anúncios e anúncio individual, quando essas URLs existirem separadamente). O botão deve abrir diretamente o recurso correspondente em uma nova aba.

Se existirem links para anúncio, conjunto e campanha, mostrar todos eles. Nunca ignorar URLs disponíveis nas tabelas.

---

# Comparações

Permitir comparar:

* **Campanha A vs Campanha B** — Investimento, Receita, Compras, Cliques, Impressões, Retorno
* **Produto A vs Produto B** — mesmos indicadores aplicáveis

---

# Ranking

Criar rankings automáticos:

* Top campanhas por receita
* Top campanhas por retorno
* Top campanhas por compras
* Top produtos por faturamento
* Top produtos por quantidade vendida
* Top produtos por retorno
* Top campanhas por plataforma

---

# Gráficos

Usando a biblioteca de gráficos já adotada pelo projeto (identificada na Fase 0):

* Investimento ao longo do tempo
* Receita ao longo do tempo
* Compras por período
* Produtos mais vendidos
* Campanhas mais lucrativas
* Distribuição do investimento por plataforma
* Comparativo entre plataformas

---

# Filtros globais

Todos os componentes da aba devem respeitar filtros globais:

* período
* plataforma
* produto
* campanha

---

# Arquitetura

* Consultas eficientes, utilizando os índices existentes identificados na Fase 0.
* Evitar consultas duplicadas e N+1 queries.
* Criar services específicos para análise de tráfego pago (ex: `TrafegoPagoService`, `CampanhaAnalyticsService`, `ProdutoCampanhaService`, conforme nomenclatura já usada no projeto).
* Separar claramente as camadas:
  * **Acesso aos dados** (repositories/queries)
  * **Regras de negócio** (services — cálculo de ROI, agregações, rankings)
  * **Interface** (controllers/rotas de API + componentes de frontend)

---

# Escalabilidade

A arquitetura deve permitir adicionar novas plataformas de tráfego pago no futuro (ex: LinkedIn Ads, Pinterest Ads) sem necessidade de reescrever o módulo inteiro — preferencialmente através de um adapter/strategy pattern que normalize os dados de cada plataforma em um formato comum antes de alimentar o dashboard, ranking e comparações.

---

# Validação final

Antes de considerar a implementação concluída:

1. Confirme que todas as métricas exibidas correspondem a colunas reais encontradas na Fase 0 (sem nomes inventados).
2. Confirme que o relacionamento Produto × Campanha está retornando dados reais, não vazios, em pelo menos um caso de teste.
3. Confirme que os botões "Abrir campanha" / "Abrir conjunto" / "Abrir anúncio" aparecem sempre que a URL correspondente existir no banco, e ficam ocultos quando não existir (sem quebrar a interface).
4. Confirme que os filtros globais (período, plataforma, produto, campanha) afetam corretamente todos os blocos da tela.
5. Garanta que a aba siga o mesmo padrão visual, de autenticação e de navegação do restante do sistema.

Não limite a implementação apenas aos itens acima — se a investigação da Fase 0 revelar métricas, relacionamentos ou dados adicionais relevantes, incorpore-os ao painel, mantendo a interface organizada e intuitiva.
