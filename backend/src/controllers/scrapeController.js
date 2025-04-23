// backend/src/controllers/scrapeController.js
const amazonScraper = require('../services/amazonScraper');
const mercadoLivreScraper = require('../services/mercadoLivreScraper');
const sportsScraper = require('../services/sportsScraper'); // Novo scraper para sites esportivos
const linkResolver = require('../utils/linkResolver');
const whatsappService = require('../services/whatsappService');

exports.scrapeProduct = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    console.log(`Iniciando scraping para URL: ${url}`);
    
    // Verificar o tipo de URL
    const isMercadoLivreAffiliate = url.includes('mercadolivre.com/sec/') || url.includes('mercadolibre.com/sec/');
    const isTiddlyLink = url.includes('tidd.ly/');
    const isTinyccLink = url.includes('tiny.cc/');
    const isBitlyLink = url.includes('bit.ly/');
    const isOtherShortLink = url.includes('tinyurl.com/') || url.includes('prf.hn/');
    const isShortLink = isTiddlyLink || isTinyccLink || isBitlyLink || isOtherShortLink;
    
    // Determinar o tipo de site
    const isAmazonLink = url.includes('amazon.com.br') || url.includes('amazon.com');
    const isCentauroLink = url.includes('centauro.com.br');
    const isNikeLink = url.includes('nike.com.br');
    const isNetshoesLink = url.includes('netshoes.com.br');
    const isSportsLink = isCentauroLink || isNikeLink || isNetshoesLink;

    let productData;
    let resolvedUrl = url;
    
    // Tratar links diretos do Mercado Livre
    if (isMercadoLivreAffiliate) {
      console.log('Link de afiliado do Mercado Livre detectado. Usando scraper direto.');
      productData = await mercadoLivreScraper.scrapeProductData(url);
      productData.productUrl = url;
      console.log('Dados do produto extraídos com sucesso:', productData);
      productData.platform = 'mercadolivre';
      return res.json(productData);
    }
    
    // Para outros links, resolver e identificar o serviço correto
    console.log(`Resolvendo URL: ${url}`);
    resolvedUrl = await linkResolver.resolveUrl(url);
    console.log(`URL resolvida: ${resolvedUrl}`);
    
    if (resolvedUrl.includes('amazon.com.br') || resolvedUrl.includes('amazon.com')) {
      console.log('Usando Amazon Scraper');
      productData = await amazonScraper.scrapeProductData(resolvedUrl);
      productData.platform = 'amazon';
    } else if (
      resolvedUrl.includes('mercadolivre.com.br') || 
      resolvedUrl.includes('mercadolibre.com')
    ) {
      console.log('Usando Mercado Livre Scraper');
      productData = await mercadoLivreScraper.scrapeProductData(resolvedUrl);
      productData.platform = 'mercadolivre';
    } else if (
      resolvedUrl.includes('centauro.com.br') ||
      resolvedUrl.includes('nike.com.br') ||
      resolvedUrl.includes('netshoes.com.br')
    ) {
      console.log('Usando Sports Scraper para site esportivo');
      productData = await sportsScraper.scrapeProductData(resolvedUrl);
      
      // Definir a plataforma específica
      if (resolvedUrl.includes('centauro.com.br')) {
        productData.platform = 'centauro';
      } else if (resolvedUrl.includes('nike.com.br')) {
        productData.platform = 'nike';
      } else if (resolvedUrl.includes('netshoes.com.br')) {
        productData.platform = 'netshoes';
      }
    } else {
      return res.status(400).json({ 
        error: 'URL não suportada. Apenas Amazon, Mercado Livre, Centauro, Nike e Netshoes são suportados.',
        resolvedUrl
      });
    }
    
    // Manter o URL original para preservar o link de afiliado
    productData.productUrl = url;
    
    // Verificar se os dados essenciais foram obtidos
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