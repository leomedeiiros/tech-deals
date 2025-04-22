// backend/src/controllers/scrapeController.js
const amazonScraper = require('../services/amazonScraper');
const mercadoLivreScraper = require('../services/mercadoLivreScraper');
const linkResolver = require('../utils/linkResolver');
const whatsappService = require('../services/whatsappService');

exports.scrapeProduct = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    console.log(`Iniciando scraping para URL: ${url}`);
    
    const isMercadoLivreAffiliate = url.includes('mercadolivre.com/sec/') || url.includes('mercadolibre.com/sec/');
    
    if (isMercadoLivreAffiliate) {
      console.log('Link de afiliado do Mercado Livre detectado. Usando scraper direto.');
      const productData = await mercadoLivreScraper.scrapeProductData(url);
      productData.productUrl = url;
      console.log('Dados do produto extraídos com sucesso:', productData);
      return res.json(productData);
    }
    
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
    } else {
      return res.status(400).json({ error: 'URL não suportada. Apenas Amazon e Mercado Livre são suportados.' });
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