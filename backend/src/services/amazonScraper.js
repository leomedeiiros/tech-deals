// backend/src/services/amazonScraper.js
const puppeteer = require('puppeteer');

exports.scrapeProductData = async (url) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    // Remover a referência ao executável externo
    ignoreDefaultArgs: ['--disable-extensions']
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // Extrair dados do produto
    const productData = await page.evaluate(() => {
      // Nome do produto
      const productTitle = document.querySelector('#productTitle')?.textContent.trim();
      
      // Preço atual
      let currentPrice = document.querySelector('.a-price .a-offscreen')?.textContent;
      if (!currentPrice) {
        currentPrice = document.querySelector('.priceToPay .a-offscreen')?.textContent || 
                      document.querySelector('#priceblock_ourprice')?.textContent ||
                      document.querySelector('#priceblock_dealprice')?.textContent;
      }
      
      // Preço original (riscado)
      let originalPrice = document.querySelector('.a-text-price .a-offscreen')?.textContent || '';
      if (!originalPrice) {
        originalPrice = document.querySelector('.a-price.a-text-price span.a-offscreen')?.textContent || '';
      }
      
      // Imagem do produto
      const productImage = document.querySelector('#landingImage')?.src || 
                          document.querySelector('#imgBlkFront')?.src ||
                          document.querySelector('#main-image')?.src;
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice ? currentPrice.trim() : 'Preço não disponível',
        originalPrice: originalPrice ? originalPrice.trim() : null,
        imageUrl: productImage || '',
        vendor: 'Amazon'
      };
    });
    
    // Formatar preços
    productData.currentPrice = productData.currentPrice.replace(/^R\$\s*/, '');
    if (productData.originalPrice) {
      productData.originalPrice = productData.originalPrice.replace(/^R\$\s*/, '');
    }
    
    // Adicionar URL do produto
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Amazon:', error);
    throw new Error('Falha ao extrair dados do produto na Amazon');
  } finally {
    await browser.close();
  }
};