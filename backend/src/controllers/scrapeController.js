// backend/src/controllers/scrapeController.js
const amazonScraper = require('../services/amazonScraper');
const mercadoLivreScraper = require('../services/mercadoLivreScraper');
const centauroScraper = require('../services/centauroScraper');
const netshoesScraper = require('../services/netshoesScraper');
const nikeScraper = require('../services/nikeScraper');
const linkResolver = require('../utils/linkResolver');
const whatsappService = require('../services/whatsappService');
const geminiService = require('../services/geminiService');
const { isShopeeMessage, processShopeeMessage } = require('../services/shopeeMessageProcessor');

exports.scrapeProduct = async (req, res) => {
 try {
   const { url } = req.body;
   
   if (!url) {
     return res.status(400).json({ error: 'URL não fornecida' });
   }

   console.log(`Iniciando scraping para URL: ${url}`);
   
   // NOVA LÓGICA: Verificar se é mensagem da Shopee
   if (isShopeeMessage(url)) {
     console.log('Detectada mensagem da Shopee, processando...');
     try {
       const processedData = await processShopeeMessage(url);
       console.log('Mensagem da Shopee processada com sucesso:', processedData);
       return res.json(processedData);
     } catch (error) {
       console.error('Erro ao processar mensagem da Shopee:', error);
       return res.status(500).json({ 
         error: 'Falha ao processar mensagem da Shopee', 
         details: error.message 
       });
     }
   }
   
   // LÓGICA ORIGINAL PARA LINKS NORMAIS
   
   // Verificar se é link de afiliado do Mercado Livre
   const isMercadoLivreAffiliate = url.includes('mercadolivre.com/sec/') || url.includes('mercadolibre.com/sec/');
   
   // Verificar se é link da Awin (Centauro/Nike)
   const isAwinAffiliate = url.includes('tidd.ly/');
   
   // Verificar se é link da Rakuten (Netshoes)
   const isRakutenAffiliate = url.includes('tiny.cc/');
   
   // Verificar se é link de afiliado da Shopee NORMAL (não mensagem)
   const isShopeeAffiliate = url.includes('shopee.com.br') || url.includes('s.shopee.com.br');
   
   // Verificar se os links de afiliados podem ser passados diretamente para os scrapers específicos
   if (isMercadoLivreAffiliate) {
     console.log('Link de afiliado do Mercado Livre detectado. Usando scraper direto.');
     const productData = await mercadoLivreScraper.scrapeProductData(url);
     productData.productUrl = url;
     console.log('Dados do produto extraídos com sucesso:', productData);
     return res.json(productData);
   }
   
   if (isAwinAffiliate && url.includes('3Ey3rLE')) {
     console.log('Link de afiliado da Centauro detectado. Usando scraper direto.');
     const productData = await centauroScraper.scrapeProductData(url);
     productData.productUrl = url;
     console.log('Dados do produto extraídos com sucesso:', productData);
     return res.json(productData);
   }
   
   if (isAwinAffiliate && url.includes('4cvXuvd')) {
     console.log('Link de afiliado da Nike detectado. Usando scraper direto.');
     const productData = await nikeScraper.scrapeProductData(url);
     productData.productUrl = url;
     console.log('Dados do produto extraídos com sucesso:', productData);
     return res.json(productData);
   }
   
   if (isRakutenAffiliate && url.includes('ebah001')) {
     console.log('Link de afiliado da Netshoes detectado. Usando scraper direto.');
     const productData = await netshoesScraper.scrapeProductData(url);
     productData.productUrl = url;
     console.log('Dados do produto extraídos com sucesso:', productData);
     return res.json(productData);
   }
   
   // SHOPEE NORMAL: usar fallback direto (sem scraper)
   if (isShopeeAffiliate) {
     console.log('Link normal da Shopee detectado. Usando fallback.');
     
     const fallbackData = {
       name: 'Produto da Shopee',
       currentPrice: '39',
       originalPrice: '79',
       imageUrl: '',
       vendor: 'Shopee',
       platform: 'shopee',
       productUrl: url,
       isPlaceholder: true,
       message: 'Dados obtidos de forma limitada. Use mensagens completas para melhor processamento.'
     };
     
     console.log('Dados de fallback da Shopee:', fallbackData);
     return res.json(fallbackData);
   }
   
   // Para outros links, resolver URL e determinar qual scraper usar
   const resolvedUrl = await linkResolver.resolveUrl(url);
   console.log(`URL resolvida: ${resolvedUrl}`);
   
   let productData;
   
   if (resolvedUrl.includes('amazon.com.br') || resolvedUrl.includes('amazon.com')) {
     console.log('Usando Amazon Scraper');
     productData = await amazonScraper.scrapeProductData(resolvedUrl);
   } else if (
     resolvedUrl.includes('mercadolivre.com.br') || 
     resolvedUrl.includes('mercadolibre.com')
   ) {
     console.log('Usando Mercado Livre Scraper');
     productData = await mercadoLivreScraper.scrapeProductData(resolvedUrl);
   } else if (
     resolvedUrl.includes('centauro.com.br')
   ) {
     console.log('Usando Centauro Scraper');
     productData = await centauroScraper.scrapeProductData(resolvedUrl);
   } else if (
     resolvedUrl.includes('netshoes.com.br')
   ) {
     console.log('Usando Netshoes Scraper');
     productData = await netshoesScraper.scrapeProductData(resolvedUrl);
   } else if (
     resolvedUrl.includes('nike.com.br') || 
     resolvedUrl.includes('nike.com/br') ||
     resolvedUrl.includes('nike.com/tenis') ||
     resolvedUrl.includes('nike.com')
   ) {
     console.log('Usando Nike Scraper');
     productData = await nikeScraper.scrapeProductData(resolvedUrl);
   } else if (
     resolvedUrl.includes('shopee.com.br')
   ) {
     console.log('Usando fallback da Shopee (URL resolvida)');
     productData = {
       name: 'Produto da Shopee',
       currentPrice: '39',
       originalPrice: '79',
       imageUrl: '',
       vendor: 'Shopee',
       platform: 'shopee',
       isPlaceholder: true
     };
   } else {
     return res.status(400).json({ error: 'URL não suportada. Apenas Amazon, Mercado Livre, Centauro, Netshoes, Nike e Shopee são suportados.' });
   }
   
   productData.productUrl = url;

   if (!productData.name || productData.name === 'Nome do produto não encontrado') {
     console.warn('Alerta: Nome do produto não foi extraído corretamente');
   }
   
   if (!productData.currentPrice || productData.currentPrice === 'Preço não disponível') {
     console.warn('Alerta: Preço atual não foi extraído corretamente');
   }
   
   console.log('Dados do produto extraídos com sucesso:', productData);
   res.json(productData);
 } catch (error) {
   console.error('Erro ao fazer scraping:', error);
   res.status(500).json({ error: 'Falha ao obter dados do produto', details: error.message });
 }
};

exports.sendWhatsApp = async (req, res) => {
 try {
   const { message, chatName } = req.body;
   
   if (!message || !chatName) {
     return res.status(400).json({ error: 'Mensagem ou nome do chat não fornecidos' });
   }
   
   await whatsappService.sendMessage(message, chatName);
   res.json({ success: true, message: 'Mensagem enviada com sucesso' });
 } catch (error) {
   console.error('Erro ao enviar mensagem:', error);
   res.status(500).json({ error: 'Falha ao enviar mensagem', details: error.message });
 }
};

exports.generateAIImage = async (req, res) => {
 try {
   const { prompt, apiKey, productData } = req.body;
   
   if (!prompt || !apiKey || !productData) {
     return res.status(400).json({ 
       error: 'Prompt, chave de API e dados do produto são obrigatórios' 
     });
   }
   
   console.log(`Iniciando geração de imagem com prompt: "${prompt}"`);
   
   const result = await geminiService.generateImage(prompt, apiKey, productData);
   
   if (result.success) {
     // Transformar URL relativa em URL completa
     const baseUrl = req.protocol + '://' + req.get('host');
     result.imageUrl = baseUrl + result.imageUrl;
     
     res.json(result);
   } else {
     res.status(500).json(result);
   }
 } catch (error) {
   console.error('Erro ao gerar imagem com IA:', error);
   res.status(500).json({ 
     error: 'Falha ao gerar imagem com IA', 
     details: error.message 
   });
 }
};