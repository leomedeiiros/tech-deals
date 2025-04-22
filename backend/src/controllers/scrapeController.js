// backend/src/controllers/scrapeController.js
const amazonScraper = require('../services/amazonScraper');
const mercadoLivreScraper = require('../services/mercadoLivreScraper');
const linkResolver = require('../utils/linkResolver');
const whatsappService = require('../services/whatsappService');
const fs = require('fs');
const path = require('path');

exports.scrapeProduct = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    console.log(`Iniciando scraping para URL: ${url}`);
    
    // Verificar se é um link do Mercado Livre no formato sec
    const isMercadoLivreAffiliate = url.includes('mercadolivre.com/sec/') || url.includes('mercadolibre.com/sec/');
    
    // Para links do Mercado Livre no formato sec, não precisamos resolver - vamos direto para o scraping
    if (isMercadoLivreAffiliate) {
      console.log('Link de afiliado do Mercado Livre detectado. Usando scraper direto.');
      const productData = await mercadoLivreScraper.scrapeProductData(url);
      console.log('Dados do produto extraídos com sucesso:', productData);
      return res.json(productData);
    }
    
    // Para outros links, resolvemos normalmente
    const resolvedUrl = await linkResolver.resolveUrl(url);
    console.log(`URL resolvida: ${resolvedUrl}`);
    
    let productData;
    
    // Determinar qual scraper usar baseado na URL
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
    
    // Verificar se os dados foram extraídos corretamente
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
    console.error(error.stack);
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

exports.uploadImage = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }
    
    // Construir URL da imagem que foi salva
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log(`Imagem enviada com sucesso: ${imageUrl}`);
    
    res.json({ 
      success: true, 
      imageUrl,
      message: 'Imagem enviada com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    res.status(500).json({ 
      error: 'Falha ao fazer upload da imagem', 
      details: error.message 
    });
  }
};