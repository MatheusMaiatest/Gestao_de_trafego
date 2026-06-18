const fs = require('fs');

// Dicionário de explicações
const explanations = {
  // FACEBOOK - Identificação
  'account_id': 'ID único da conta de anúncios no Facebook Ads Manager (ex: act_123456789)',
  'metric_date': 'Data da métrica coletada no formato YYYY-MM-DD',
  'account_name': 'Nome da conta de anúncios configurada no Business Manager',
  'account_currency': 'Moeda configurada para a conta (BRL, USD, EUR)',
  'campaign_id': 'ID único da campanha no Facebook Ads',
  'campaign_name': 'Nome descritivo da campanha definido pelo gestor de tráfego',
  'adset_id': 'ID único do conjunto de anúncios (Ad Set)',
  'adset_name': 'Nome do conjunto de anúncios que agrupa anúncios com mesmo público/orçamento',
  'ad_id': 'ID único do anúncio individual (cada criativo possui um ID próprio)',
  'ad_name': 'Nome do anúncio específico',
  'objective': 'Objetivo da campanha: SALES (vendas), LEADS (cadastros), AWARENESS (reconhecimento), ENGAGEMENT (engajamento)',
  'optimization_goal': 'Meta de otimização do Facebook: OFFSITE_CONVERSIONS, LINK_CLICKS, IMPRESSIONS, REACH, etc.',
  
  // FACEBOOK - Métricas básicas
  'spend': 'Valor total investido/gasto na campanha em reais (R$)',
  'impressions': 'Número total de vezes que o anúncio foi exibido (pode incluir visualizações repetidas)',
  'reach': 'Número de pessoas únicas que viram o anúncio pelo menos uma vez',
  'frequency': 'Frequência média = impressions / reach. Quantas vezes em média cada pessoa viu o anúncio',
  'clicks': 'Total de cliques em qualquer lugar do anúncio',
  'unique_clicks': 'Número de pessoas únicas que clicaram no anúncio',
  'inline_link_clicks': 'Cliques no link do anúncio que levam para fora do Facebook',
  'unique_inline_link_clicks': 'Pessoas únicas que clicaram no link do anúncio',
  
  // FACEBOOK - Métricas de custo
  'ctr': 'CTR - Click Through Rate = (clicks / impressions) * 100. Taxa de cliques em %',
  'cpm': 'CPM - Custo Por Mil impressões = (spend / impressions) * 1000',
  'cpc': 'CPC - Custo Por Clique = spend / clicks',
  'cpp': 'CPP - Custo Por Ponto de frequência (usado em TV, raramente em digital)',
  
  // FACEBOOK - Engajamento
  'inline_post_engagement': 'Total de interações com a publicação (curtidas, comentários, compartilhamentos, cliques)',
  'a_post_engagement': 'Ações de engajamento na publicação',
  'a_post_reaction': 'Reações na publicação (curtir, amei, haha, uau, triste, grr)',
  'a_post': 'Compartilhamentos da publicação',
  'a_comment': 'Comentários na publicação',
  'a_like': 'Curtidas na página após ver o anúncio',
  'a_photo_view': 'Visualizações de fotos',
  'a_video_view': 'Visualizações de vídeo (mínimo 3 segundos)',
  'a_video_p25_watched_actions_video_view': 'Vídeos assistidos até 25%',
  'a_video_p50_watched_actions_video_view': 'Vídeos assistidos até 50%',
  'a_video_p75_watched_actions_video_view': 'Vídeos assistidos até 75%',
  'a_video_p95_watched_actions_video_view': 'Vídeos assistidos até 95%',
  'a_video_p100_watched_actions_video_view': 'Vídeos assistidos até 100% (completo)',
  'a_page_engagement': 'Engajamento total com a página',
  
  // FACEBOOK - Conversões principais
  'a_purchase': 'COMPRAS - Número de compras concluídas rastreadas pelo Pixel',
  'a_add_to_cart': 'ADICIONAR AO CARRINHO - Produtos adicionados ao carrinho',
  'a_initiate_checkout': 'INICIAR CHECKOUT - Início do processo de finalização da compra',
  'a_add_payment_info': 'ADICIONAR INFO PAGAMENTO - Usuário adicionou dados de pagamento',
  'a_complete_registration': 'COMPLETAR CADASTRO - Cadastros/registros completos',
  'a_lead': 'LEADS - Formulários de lead/contato preenchidos',
  'a_view_content': 'VISUALIZAR CONTEÚDO - Visualizações de páginas de produto',
  'a_add_to_wishlist': 'LISTA DE DESEJOS - Produtos adicionados à lista de desejos',
  'a_search': 'BUSCA - Pesquisas realizadas no site',
  'a_landing_page_view': 'VISUALIZAÇÃO DE LANDING PAGE - Carregamentos de landing page',
  'a_link_click': 'CLIQUE NO LINK - Cliques em links externos',
  
  // FACEBOOK - Conversões Pixel (offsite)
  'a_offsite_conversion': 'Total de conversões fora do Facebook rastreadas pelo Pixel',
  'a_offsite_conversion_fb_pixel_purchase': 'Compras rastreadas pelo Facebook Pixel',
  'a_offsite_conversion_fb_pixel_add_to_cart': 'Carrinhos rastreados pelo Pixel',
  'a_offsite_conversion_fb_pixel_initiate_checkout': 'Checkouts iniciados pelo Pixel',
  'a_offsite_conversion_fb_pixel_view_content': 'Visualizações de conteúdo pelo Pixel',
  'a_offsite_conversion_fb_pixel_lead': 'Leads gerados rastreados pelo Pixel',
  'a_offsite_conversion_fb_pixel_complete_registration': 'Cadastros completos pelo Pixel',
  'a_offsite_conversion_fb_pixel_add_payment_info': 'Info de pagamento adicionada pelo Pixel',
  'a_offsite_conversion_fb_pixel_add_to_wishlist': 'Lista de desejos pelo Pixel',
  'a_offsite_conversion_fb_pixel_search': 'Buscas rastreadas pelo Pixel',
  'a_offsite_conversion_fb_pixel_custom': 'Eventos customizados do Pixel',
  
  // FACEBOOK - Conversões App Mobile
  'a_app_custom_event': 'Total de eventos customizados do aplicativo',
  'a_app_custom_event_fb_mobile_purchase': 'Compras no app mobile',
  'a_app_custom_event_fb_mobile_add_to_cart': 'Adicionar ao carrinho no app',
  'a_app_custom_event_fb_mobile_initiated_checkout': 'Checkout iniciado no app',
  'a_app_custom_event_fb_mobile_content_view': 'Visualizações de conteúdo no app',
  'a_app_custom_event_fb_mobile_add_to_wishlist': 'Lista de desejos no app',
  'a_app_custom_event_fb_mobile_complete_registration': 'Cadastros no app',
  'a_app_custom_event_fb_mobile_add_payment_info': 'Pagamento adicionado no app',
  'a_app_custom_event_fb_mobile_search': 'Buscas no app',
  'a_app_custom_event_fb_mobile_activate_app': 'Ativações do app',
  'a_app_custom_event_fb_mobile_achievement_unlocked': 'Conquistas desbloqueadas (gamification)',
  'a_app_custom_event_fb_mobile_level_achieved': 'Níveis alcançados (gamification)',
  'a_app_custom_event_fb_mobile_rate': 'Avaliações no app',
  'a_app_custom_event_fb_mobile_spent_credits': 'Créditos gastos no app',
  'a_app_custom_event_fb_mobile_tutorial_completion': 'Tutoriais completos no app',
  'a_app_custom_event_fb_mobile_d2_retention': 'Retenção de 2 dias no app',
  'a_app_custom_event_fb_mobile_d7_retention': 'Retenção de 7 dias no app',
  'a_app_custom_event_other': 'Outros eventos customizados do app',
  'a_app_install': 'Instalações do aplicativo',
  'a_app_engagement': 'Engajamento no aplicativo',
  'a_mobile_app_install': 'Instalações de app mobile',
  
  // FACEBOOK - Conversões Offline
  'a_offline_conversion': 'Total de conversões offline importadas',
  'a_offline_conversion_purchase': 'Compras offline (ex: loja física)',
  'a_offline_conversion_add_to_cart': 'Carrinhos offline',
  'a_offline_conversion_initiate_checkout': 'Checkouts offline',
  'a_offline_conversion_lead': 'Leads offline',
  'a_offline_conversion_complete_registration': 'Cadastros offline',
  'a_offline_conversion_add_payment_info': 'Pagamentos offline',
  'a_offline_conversion_add_to_wishlist': 'Lista de desejos offline',
  'a_offline_conversion_view_content': 'Visualizações offline',
  'a_offline_conversion_search': 'Buscas offline',
  'a_offline_conversion_other': 'Outras conversões offline',
  
  // FACEBOOK - Conversões Omni-channel
  'a_omni_purchase': 'Compras omnichannel (online + offline)',
  'a_omni_add_to_cart': 'Carrinhos omnichannel',
  'a_omni_initiated_checkout': 'Checkouts omnichannel',
  'a_omni_view_content': 'Visualizações omnichannel',
  'a_omni_add_to_wishlist': 'Lista de desejos omnichannel',
  'a_omni_complete_registration': 'Cadastros omnichannel',
  'a_omni_search': 'Buscas omnichannel',
  'a_omni_app_install': 'Instalações omnichannel',
  'a_omni_activate_app': 'Ativações omnichannel',
  'a_omni_achievement_unlocked': 'Conquistas omnichannel',
  'a_omni_level_achieved': 'Níveis omnichannel',
  'a_omni_rate': 'Avaliações omnichannel',
  'a_omni_spend_credits': 'Créditos gastos omnichannel',
  'a_omni_tutorial_completion': 'Tutoriais omnichannel',
  'a_omni_custom': 'Eventos custom omnichannel',
  
  // FACEBOOK - Conversões On-site (no Facebook/Instagram)
  'a_onsite_conversion_purchase': 'Compras dentro do Facebook/Instagram Shop',
  'a_onsite_conversion_add_to_cart': 'Carrinhos no Facebook/Instagram Shop',
  'a_onsite_conversion_initiate_checkout': 'Checkouts no Facebook/Instagram Shop',
  'a_onsite_conversion_view_content': 'Visualizações no Facebook/Instagram',
  'a_onsite_conversion_add_to_wishlist': 'Lista de desejos no Facebook/Instagram',
  'a_onsite_conversion_lead': 'Leads gerados no Facebook (formulários nativos)',
  'a_onsite_conversion_lead_grouped': 'Leads agrupados',
  'a_onsite_conversion_click_to_call': 'Cliques para ligar',
  'a_onsite_conversion_donate': 'Doações',
  'a_onsite_conversion_find_location': 'Buscas de localização',
  'a_onsite_conversion_flow_complete': 'Fluxos completos',
  'a_onsite_conversion_post_save': 'Salvamentos de publicação',
  'a_onsite_conversion_message_to_buy': 'Mensagens para comprar',
  'a_onsite_conversion_other': 'Outras conversões on-site',
  
  // FACEBOOK - Conversões Web específicas
  'a_onsite_web_purchase': 'Compras via web (Facebook Browser)',
  'a_onsite_web_add_to_cart': 'Carrinhos via web',
  'a_onsite_web_initiate_checkout': 'Checkouts via web',
  'a_onsite_web_view_content': 'Visualizações via web',
  'a_onsite_web_lead': 'Leads via web',
  'a_onsite_web_app_purchase': 'Compras via web app',
  'a_onsite_web_app_add_to_cart': 'Carrinhos via web app',
  'a_onsite_web_app_view_content': 'Visualizações via web app',
  
  // FACEBOOK - Conversões App específicas
  'a_onsite_app_purchase': 'Compras via app nativo',
  'a_onsite_app_add_to_cart': 'Carrinhos via app nativo',
  'a_onsite_app_view_content': 'Visualizações via app nativo',
  
  // FACEBOOK - Messaging (WhatsApp, Messenger, Instagram Direct)
  'a_onsite_conversion_total_messaging_connection': 'Total de conexões via mensagem',
  'a_onsite_conversion_messaging_conversation_started_7d': 'Conversas iniciadas (7 dias)',
  'a_onsite_conversion_messaging_conversation_replied_7d': 'Conversas respondidas (7 dias)',
  'a_onsite_conversion_messaging_first_reply': 'Primeiras respostas',
  'a_onsite_conversion_messaging_user_subscribed': 'Usuários inscritos em mensagens',
  'a_onsite_conversion_messaging_welcome_message_view': 'Visualizações de mensagem de boas-vindas',
  'a_onsite_conversion_messaging_user_call_placed': 'Chamadas feitas',
  'a_onsite_conversion_messaging_20s_call_connect': 'Chamadas conectadas +20s',
  'a_onsite_conversion_messaging_60s_call_connect': 'Chamadas conectadas +60s',
  'a_onsite_conversion_messaging_user_conversation_depth_2': 'Conversas com 2+ mensagens',
  'a_onsite_conversion_messaging_user_conversation_depth_3': 'Conversas com 3+ mensagens',
  'a_onsite_conversion_messaging_user_depth_2_message_send': 'Envios de 2ª mensagem',
  'a_onsite_conversion_messaging_user_depth_3_message_send': 'Envios de 3ª mensagem',
  'a_onsite_conversion_messaging_user_depth_5_message_send': 'Envios de 5ª mensagem',
  'a_onsite_conversion_messaging_block': 'Bloqueios',
  'a_onsite_conversion_messaging_order_created_v2': 'Pedidos criados via mensagem',
  'a_onsite_conversion_messaging_order_shipped_v2': 'Pedidos enviados via mensagem',
  'a_onsite_conversion_messaging_business_calling_call_ans': 'Chamadas atendidas (business)',
  'a_onsite_conversion_messaging_business_calling_call_ini': 'Chamadas iniciadas (business)',
  'a_onsite_conversion_messaging_business_calling_call_mis': 'Chamadas perdidas (business)',
  'a_onsite_conversion_messaging_business_calling_opt_in_a': 'Opt-ins de chamadas (aceitos)',
  'a_onsite_conversion_messaging_business_calling_opt_in_d': 'Opt-ins de chamadas (negados)',
  'a_onsite_conversion_messaging_business_calling_opt_in_s': 'Opt-ins de chamadas (enviados)',
  
  // FACEBOOK - Outras conversões
  'a_checkin': 'Check-ins no local',
  'a_rsvp': 'Confirmações de presença em evento',
  'a_commerce_event': 'Eventos de comércio',
  'a_credit_spent': 'Créditos gastos',
  'a_group_join': 'Entradas em grupo',
  'a_interactive_component_tap': 'Toques em componentes interativos',
  'a_outbound_clicks_outbound_click': 'Cliques para fora do anúncio',
  'a_outbound_click': 'Cliques externos',
  'a_app_use': 'Usos do app',
  'a_games_plays': 'Jogadas em jogos',
  'a_web_in_store_purchase': 'Compras na loja física originadas da web',
  
  // FACEBOOK - Chamadas (Call-to-Action)
  'a_call_confirm_grouped': 'Chamadas confirmadas (agrupadas)',
  'a_click_to_call_call_confirm': 'Confirmações de chamadas',
  'a_click_to_call_callback_request_submitted': 'Solicitações de retorno de chamada',
  'a_click_to_call_native_call_placed': 'Chamadas feitas (nativo)',
  'a_click_to_call_native_20s_call_connect': 'Chamadas conectadas +20s (nativo)',
  'a_click_to_call_native_60s_call_connect': 'Chamadas conectadas +60s (nativo)',
  'a_click_to_join_new_channel_member': 'Novos membros de canal',
  
  // FACEBOOK - Conversões por canal
  'a_contact_total': 'Contatos totais',
  'a_contact_website': 'Contatos via website',
  'a_contact_mobile_app': 'Contatos via app mobile',
  'a_contact_offline': 'Contatos offline',
  'a_customize_product_total': 'Personalizações de produto totais',
  'a_customize_product_website': 'Personalizações via website',
  'a_customize_product_mobile_app': 'Personalizações via app',
  'a_customize_product_offline': 'Personalizações offline',
  'a_donate_total': 'Doações totais',
  'a_donate_website': 'Doações via website',
  'a_donate_on_facebook': 'Doações no Facebook',
  'a_donate_mobile_app': 'Doações via app',
  'a_donate_offline': 'Doações offline',
  'a_find_location_total': 'Buscas de localização totais',
  'a_find_location_website': 'Buscas de localização via website',
  'a_find_location_mobile_app': 'Buscas de localização via app',
  'a_find_location_offline': 'Buscas de localização offline',
  'a_schedule_total': 'Agendamentos totais',
  'a_schedule_website': 'Agendamentos via website',
  'a_schedule_mobile_app': 'Agendamentos via app',
  'a_schedule_offline': 'Agendamentos offline',
  'a_start_trial_total': 'Testes gratuitos iniciados (total)',
  'a_start_trial_website': 'Testes gratuitos via website',
  'a_start_trial_mobile_app': 'Testes gratuitos via app',
  'a_start_trial_offline': 'Testes gratuitos offline',
  'a_submit_application_total': 'Aplicações enviadas (total)',
  'a_submit_application_website': 'Aplicações via website',
  'a_submit_application_mobile_app': 'Aplicações via app',
  'a_submit_application_offline': 'Aplicações offline',
  'a_submit_application_on_facebook': 'Aplicações no Facebook',
  'a_subscribe_total': 'Assinaturas totais',
  'a_subscribe_website': 'Assinaturas via website',
  'a_subscribe_mobile_app': 'Assinaturas via app',
  'a_subscribe_offline': 'Assinaturas offline',
  'a_recurring_subscription_payment_total': 'Pagamentos recorrentes totais',
  'a_recurring_subscription_payment_website': 'Pagamentos recorrentes via website',
  'a_recurring_subscription_payment_mobile_app': 'Pagamentos recorrentes via app',
  'a_recurring_subscription_payment_offline': 'Pagamentos recorrentes offline',
  'a_cancel_subscription_total': 'Cancelamentos de assinatura totais',
  'a_cancel_subscription_website': 'Cancelamentos via website',
  'a_cancel_subscription_mobile_app': 'Cancelamentos via app',
  'a_cancel_subscription_offline': 'Cancelamentos offline',
  
  // FACEBOOK - Mobile específico
  'a_ad_click_mobile_app': 'Cliques em anúncios no app mobile',
  'a_ad_impression_mobile_app': 'Impressões de anúncios no app mobile',
  
  // FACEBOOK - Custom/KDD
  'a_offsite_conversion_custom_kdd_total': 'Conversões customizadas KDD totais',
  'a_leadgen_grouped': 'Leads agrupados (formulários nativos)',
  
  // FACEBOOK - Lembrança de anúncio
  'estimated_ad_recallers': 'Estimativa de pessoas que lembrariam do anúncio após 2 dias',
  'estimated_ad_recall_rate': 'Taxa de lembrança estimada do anúncio',
  'cost_per_estimated_ad_recallers': 'Custo por pessoa que lembraria do anúncio',
  
  // FACEBOOK - ROAS (Return on Ad Spend)
  'a_purchase_roas_omni_purchase': 'ROAS de compras omnichannel',
  'a_website_purchase_roas': 'ROAS de compras no website',
  'a_website_purchase_roas_offsite_conversion_fb_pixel_pur': 'ROAS de compras via Pixel',
  
  // FACEBOOK - VALORES (prefixo value_)
  'value_purchase': 'Valor monetário total das compras (R$)',
  'value_add_to_cart': 'Valor dos produtos adicionados ao carrinho',
  'value_add_to_wishlist': 'Valor dos produtos na lista de desejos',
  'value_add_payment_info': 'Valor quando info de pagamento foi adicionada',
  'value_complete_registration': 'Valor associado a cadastros completos',
  'value_initiate_checkout': 'Valor dos checkouts iniciados',
  'value_lead': 'Valor dos leads gerados',
  'value_search': 'Valor das buscas',
  'value_view_content': 'Valor das visualizações de conteúdo',
  'value_app_custom_event_fb_mobile_purchase': 'Valor de compras no app mobile',
  'value_app_custom_event_fb_mobile_add_to_cart': 'Valor de carrinhos no app',
  'value_app_custom_event_fb_mobile_content_view': 'Valor de visualizações no app',
  'value_app_custom_event_fb_mobile_initiated_checkout': 'Valor de checkouts no app',
  'value_app_custom_event_fb_mobile_add_to_wishlist': 'Valor de lista desejos no app',
  'value_app_custom_event_fb_mobile_search': 'Valor de buscas no app',
  'value_app_custom_event_fb_mobile_spent_credits': 'Valor de créditos gastos no app',
  'value_app_custom_event_other': 'Valor de outros eventos do app',
  'value_offline_conversion_purchase': 'Valor de compras offline',
  'value_offsite_conversion_fb_pixel_purchase': 'Valor de compras via Pixel',
  'value_offsite_conversion_fb_pixel_add_to_cart': 'Valor de carrinhos via Pixel',
  'value_offsite_conversion_fb_pixel_initiate_checkout': 'Valor de checkouts via Pixel',
  'value_offsite_conversion_fb_pixel_view_content': 'Valor de visualizações via Pixel',
  'value_offsite_conversion_fb_pixel_lead': 'Valor de leads via Pixel',
  'value_offsite_conversion_fb_pixel_add_payment_info': 'Valor de pagamentos via Pixel',
  'value_offsite_conversion_fb_pixel_add_to_wishlist': 'Valor de lista desejos via Pixel',
  'value_offsite_conversion_fb_pixel_search': 'Valor de buscas via Pixel',
  'value_offsite_conversion_fb_pixel_complete_registration': 'Valor de cadastros via Pixel',
  'value_offsite_conversion_fb_pixel_custom': 'Valor de eventos custom via Pixel',
  'value_omni_purchase': 'Valor de compras omnichannel',
  'value_omni_add_to_cart': 'Valor de carrinhos omnichannel',
  'value_omni_initiated_checkout': 'Valor de checkouts omnichannel',
  'value_omni_view_content': 'Valor de visualizações omnichannel',
  'value_omni_add_to_wishlist': 'Valor de lista desejos omnichannel',
  'value_omni_complete_registration': 'Valor de cadastros omnichannel',
  'value_omni_search': 'Valor de buscas omnichannel',
  'value_omni_custom': 'Valor de eventos custom omnichannel',
  'value_onsite_conversion_purchase': 'Valor de compras on-site',
  'value_onsite_app_purchase': 'Valor de compras via app on-site',
  'value_onsite_app_add_to_cart': 'Valor de carrinhos via app on-site',
  'value_onsite_app_view_content': 'Valor de visualizações via app on-site',
  'value_onsite_web_purchase': 'Valor de compras via web on-site',
  'value_onsite_web_add_to_cart': 'Valor de carrinhos via web on-site',
  'value_onsite_web_initiate_checkout': 'Valor de checkouts via web on-site',
  'value_onsite_web_view_content': 'Valor de visualizações via web on-site',
  'value_onsite_web_lead': 'Valor de leads via web on-site',
  'value_onsite_web_app_purchase': 'Valor de compras via web app on-site',
  'value_onsite_web_app_add_to_cart': 'Valor de carrinhos via web app on-site',
  'value_onsite_web_app_view_content': 'Valor de visualizações via web app on-site',
  'value_web_in_store_purchase': 'Valor de compras na loja originadas da web',
  'value_offsite_conversion_custom_kdd_total': 'Valor de conversões custom KDD',
  
  // FACEBOOK ORÇAMENTO
  'orcamento': 'Valor do orçamento definido para o anúncio específico (R$)',
  
  // GOOGLE ADS
  '_kdd_account_id': 'ID da conta Google Ads (customizado KDD)',
  'segments_date': 'Data do segmento/métrica coletada',
  'metrics_ctr': 'CTR - Taxa de cliques = (clicks / impressions) * 100',
  'metrics_cost': 'Custo total investido na campanha (R$)',
  'metrics_clicks': 'Número total de cliques',
  'metrics_impressions': 'Número total de impressões',
  'metrics_conversions': 'Total de conversões rastreadas',
  'metrics_conversions_value': 'Valor monetário total das conversões (R$)',
  'metrics_cost_per_conversion': 'Custo por conversão = cost / conversions',
  'metrics_cost_per_all_conversions': 'Custo por todas conversões (inclui view-through)',
  'metrics_average_cpm': 'CPM médio - Custo por mil impressões',
  'metrics_videoviewrate': 'Taxa de visualização de vídeos',
  'metrics_activeviewcpm': 'CPM de visualizações ativas (anúncios visíveis)',
  'metrics_orders': 'Número total de pedidos/ordens',
  'metrics_unitssold': 'Unidades vendidas',
  'metrics_averageordervalue': 'Valor médio do pedido (ticket médio)',
  
  // TIKTOK ADS - Identificação
  'advertiser_id': 'ID único do anunciante no TikTok Ads',
  'advertiser_name': 'Nome do anunciante',
  'adgroup_id': 'ID do grupo de anúncios',
  'adgroup_name': 'Nome do grupo de anúncios',
  'ad_text': 'Texto do anúncio',
  
  // TIKTOK - Custos
  'cost_per_result': 'Custo por resultado (conversão principal)',
  'cost_per_conversion': 'Custo por conversão',
  'cost_per_purchase': 'Custo por compra',
  'cost_per_checkout': 'Custo por checkout',
  'cost_per_total_checkout': 'Custo por checkout total',
  'cost_per_complete_payment': 'Custo por pagamento completo',
  'cost_per_initiate_checkout': 'Custo por início de checkout',
  'cost_per_add_to_wishlist': 'Custo por adição à lista de desejos',
  'cost_per_total_add_to_wishlist': 'Custo por lista desejos total',
  'cost_per_view_content': 'Custo por visualização de conteúdo',
  'cost_per_total_view_content': 'Custo por visualização total',
  'cost_per_product_details_page_browse': 'Custo por navegação em página de produto',
  'cost_per_app_event_add_to_cart': 'Custo por carrinho no app',
  'cost_per_total_app_event_add_to_cart': 'Custo por carrinho total no app',
  'cost_per_web_event_add_to_cart': 'Custo por carrinho na web',
  'cost_per_user_registration': 'Custo por cadastro de usuário',
  'cost_per_total_registration': 'Custo por cadastro total',
  'cost_per_registration': 'Custo por registro',
  'cost_per_cta_purchase': 'Custo por compra via CTA',
  'cost_per_cta_registration': 'Custo por cadastro via CTA',
  'cost_per_vta_conversion': 'Custo por conversão view-through',
  'cost_per_vta_purchase': 'Custo por compra view-through',
  'cost_per_vta_registration': 'Custo por cadastro view-through',
  'cost_per_1000_reached': 'Custo por mil pessoas alcançadas',
  'real_time_cost_per_conversion': 'Custo por conversão em tempo real',
  'real_time_cost_per_result': 'Custo por resultado em tempo real',
  
  // TIKTOK - Conversões
  'purchase': 'Número de compras',
  'total_purchase': 'Total de compras (todas atribuições)',
  'total_purchase_value': 'Valor total de compras (R$)',
  'value_per_total_purchase': 'Valor médio por compra',
  'purchase_rate': 'Taxa de compra = (purchases / clicks) * 100',
  'complete_payment': 'Pagamentos completos',
  'complete_payment_rate': 'Taxa de pagamento completo',
  'value_per_complete_payment': 'Valor por pagamento completo',
  'checkout': 'Checkouts',
  'total_checkout': 'Checkouts totais',
  'total_checkout_value': 'Valor total de checkouts',
  'value_per_checkout': 'Valor médio por checkout',
  'checkout_rate': 'Taxa de checkout',
  'initiate_checkout': 'Início de checkouts',
  'total_initiate_checkout_value': 'Valor total de checkouts iniciados',
  'value_per_initiate_checkout': 'Valor por checkout iniciado',
  'initiate_checkout_rate': 'Taxa de início de checkout',
  'add_to_wishlist': 'Adições à lista de desejos',
  'total_add_to_wishlist': 'Lista desejos total',
  'total_add_to_wishlist_value': 'Valor da lista de desejos',
  'value_per_total_add_to_wishlist': 'Valor por item da lista',
  'add_to_wishlist_rate': 'Taxa de adição à lista',
  'view_content': 'Visualizações de conteúdo',
  'total_view_content': 'Visualizações totais',
  'total_view_content_value': 'Valor de visualizações',
  'value_per_total_view_content': 'Valor por visualização',
  'view_content_rate': 'Taxa de visualização',
  'product_details_page_browse': 'Navegações em página de produto',
  'total_product_details_page_browse_value': 'Valor de navegações',
  'value_per_product_details_page_browse': 'Valor por navegação',
  'product_details_page_browse_rate': 'Taxa de navegação',
  'app_event_add_to_cart': 'Carrinhos no app',
  'total_app_event_add_to_cart': 'Carrinhos totais no app',
  'total_app_event_add_to_cart_value': 'Valor de carrinhos no app',
  'value_per_total_app_event_add_to_cart': 'Valor por carrinho no app',
  'app_event_add_to_cart_rate': 'Taxa de carrinho no app',
  'web_event_add_to_cart': 'Carrinhos na web',
  'total_web_event_add_to_cart_value': 'Valor de carrinhos na web',
  'value_per_web_event_add_to_cart': 'Valor por carrinho na web',
  'web_event_add_to_cart_rate': 'Taxa de carrinho na web',
  'user_registration': 'Cadastros de usuário',
  'total_user_registration_value': 'Valor de cadastros',
  'value_per_user_registration': 'Valor por cadastro',
  'user_registration_rate': 'Taxa de cadastro',
  'registration': 'Registros',
  'total_registration': 'Registros totais',
  'registration_rate': 'Taxa de registro',
  'conversion': 'Conversões',
  'conversion_rate': 'Taxa de conversão',
  'real_time_conversion': 'Conversões em tempo real',
  'real_time_conversion_rate_v2': 'Taxa de conversão em tempo real v2',
  'sales_lead': 'Leads de vendas',
  'total_sales_lead': 'Leads de vendas totais',
  'total_sales_lead_value': 'Valor de leads',
  'skan_sales_lead': 'Leads SKAN (iOS)',
  'skan_total_sales_lead': 'Total de leads SKAN',
  'skan_total_sales_lead_value': 'Valor de leads SKAN',
  
  // TIKTOK - View-Through Attribution (VTA)
  'vta_purchase': 'Compras por visualização (sem clique)',
  'vta_conversion': 'Conversões por visualização',
  'vta_registration': 'Cadastros por visualização',
  'vta_app_install': 'Instalações por visualização',
  
  // TIKTOK - Call-to-Action
  'cta_purchase': 'Compras via CTA',
  'cta_registration': 'Cadastros via CTA',
  'cta_conversion': 'Conversões via CTA',
  'cta_app_install': 'Instalações via CTA',
  
  // TIKTOK - Resultados
  'result': 'Resultados (conversão principal configurada)',
  'result_rate': 'Taxa de resultado',
  'real_time_result': 'Resultados em tempo real',
  'real_time_result_rate': 'Taxa de resultado em tempo real',
  
  // TIKTOK - Engajamento
  'likes': 'Curtidas no vídeo',
  'comments': 'Comentários no vídeo',
  'shares': 'Compartilhamentos do vídeo',
  'follows': 'Novos seguidores',
  'profile_visits': 'Visitas ao perfil',
  
  // TIKTOK - Vídeo
  'video_play_actions': 'Reproduções de vídeo',
  'average_video_play': 'Tempo médio de reprodução (segundos)',
  'video_watched_2s': 'Vídeos assistidos por 2+ segundos',
  'video_watched_6s': 'Vídeos assistidos por 6+ segundos',
  'video_views_p25': 'Vídeos assistidos até 25%',
  'video_views_p50': 'Vídeos assistidos até 50%',
  'video_views_p75': 'Vídeos assistidos até 75%',
  'video_views_p100': 'Vídeos assistidos 100% (completo)',
  
  // TIKTOK - ROAS
  'total_active_pay_roas': 'ROAS total ativo = (revenue / spend)'
};

// Ler o arquivo de colunas
const raw = fs.readFileSync('COLUNAS-TRAFEGO-PAGO.txt', 'utf-8');
const lines = raw.split('\n');

let output = '';
output += '═'.repeat(100) + '\n';
output += '          DICIONÁRIO COMPLETO DE DADOS - TRÁFEGO PAGO\n';
output += '═'.repeat(100) + '\n';
output += 'Data: 18 de Junho de 2026\n';
output += 'Sistema: Inteligência Comercial - Alpha Hawk Tecnologia\n';
output += 'Banco: hawktec_alpha-ecommerce\n';
output += 'Total de Tabelas: 7\n';
output += 'Total de Colunas: 900+\n';
output += '═'.repeat(100) + '\n\n\n';

let currentTable = '';
let columnCount = 0;

for(let line of lines) {
  line = line.trim();
  if(!line) continue;
  
  if(line.startsWith('TABELA:')) {
    if(currentTable) {
      output += `\n      Total de colunas nesta tabela: ${columnCount}\n`;
      output += '─'.repeat(100) + '\n\n\n';
    }
    currentTable = line.replace('TABELA: ', '');
    columnCount = 0;
    output += '\n' + '═'.repeat(100) + '\n';
    output += `TABELA: ${currentTable}\n`;
    output += '═'.repeat(100) + '\n\n';
    continue;
  }
  
  if(line.startsWith('===')) continue;
  
  const parts = line.split('|');
  if(parts.length === 2) {
    const colName = parts[0].trim();
    const colType = parts[1].trim();
    columnCount++;
    
    const explanation = explanations[colName] || 'Métrica específica da plataforma - consultar documentação oficial';
    
    output += `[${columnCount}] ${colName}\n`;
    output += `    Tipo: ${colType}\n`;
    output += `    ${explanation}\n\n`;
  }
}

if(currentTable) {
  output += `\n      Total de colunas nesta tabela: ${columnCount}\n`;
  output += '─'.repeat(100) + '\n';
}

output += '\n\n' + '═'.repeat(100) + '\n';
output += '                            FIM DO DICIONÁRIO\n';
output += '═'.repeat(100) + '\n';

fs.writeFileSync('DICIONARIO-COMPLETO-TRAFEGO-PAGO.txt', output);
console.log('✅ Dicionário completo gerado: DICIONARIO-COMPLETO-TRAFEGO-PAGO.txt');
console.log(`📊 Total de colunas documentadas: ${Object.keys(explanations).length}`);
