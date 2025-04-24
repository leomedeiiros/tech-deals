// backend/src/services/centauroScraper.js
const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Adicionar headers extras
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    
    // Desativar cache para garantir dados atualizados
    await page.setCacheEnabled(false);
    
    console.log(`Navegando para URL: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    });
    
    // Aguardar carregamento inicial
    console.log('Aguardando carregamento inicial...');
    await wait(3000);
    
    // Capturar URL após redirecionamento
    let currentUrl = page.url();
    console.log(`URL após redirecionamento: ${currentUrl}`);
    
    // Verificar se estamos em uma página de afiliado da Awin (tidd.ly)
    if (url.includes('tidd.ly') || url.includes('awin')) {
      console.log('Detectado link de afiliado Awin, aguardando redirecionamentos...');
      
      // Aguardar mais tempo para redirecionamentos de afiliados
      await wait(5000);
      
      // Obter URL atual após redirecionamentos
      currentUrl = page.url();
      console.log(`URL após redirecionamentos de afiliado: ${currentUrl}`);
    }
    
    // Verificar se estamos em uma página de produto da Centauro
    const isCentauroProductPage = await page.evaluate(() => {
      return window.location.href.includes('centauro.com.br/') && 
             (document.querySelector('.product-name') !== null ||
              document.querySelector('.product__title') !== null ||
              document.querySelector('[data-cy="product-title"]') !== null);
    });
    
    if (!isCentauroProductPage) {
      console.log('Não estamos em uma página de produto da Centauro. Procurando links...');
      
      // Tentar encontrar link de produto
      const productLink = await page.evaluate(() => {
        // Buscar links que apontam para produtos da Centauro
        const links = Array.from(document.querySelectorAll('a')).filter(a => 
          a.href && a.href.includes('centauro.com.br/') && 
          !a.href.includes('/cart') && !a.href.includes('/checkout')
        );
        
        if (links.length > 0) {
          // Priorizar links que parecem ser de produtos
          const productLinks = links.filter(a => 
            a.href.includes('/p/') || a.href.match(/\d+\/\d+\/\d+/)
          );
          
          return productLinks.length > 0 ? productLinks[0].href : links[0].href;
        }
        
        return null;
      });
      
      if (productLink) {
        console.log(`Link de produto encontrado: ${productLink}`);
        await page.goto(productLink, { waitUntil: 'networkidle2', timeout: 60000 });
        await wait(3000);
        
        // Atualizar URL atual
        currentUrl = page.url();
        console.log(`Nova URL após navegar para o produto: ${currentUrl}`);
      } else {
        console.log('Não foi encontrado nenhum link de produto.');
      }
    }
    
    // Rolar a página para garantir que todos os elementos carreguem
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    
    await wait(1000);
    
    // Extrair dados do produto
    const productData = await page.evaluate(() => {
      // Função para limpar texto de preço
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Nome do produto - múltiplos seletores para maior robustez
      const productTitle = 
        document.querySelector('.product-name')?.textContent.trim() || 
        document.querySelector('.product__title')?.textContent.trim() || 
        document.querySelector('[data-cy="product-title"]')?.textContent.trim() ||
        document.querySelector('h1')?.textContent.trim();
      
      // Preço atual - verificar múltiplos seletores possíveis
      let currentPrice = '';
      
      // Tentar vários seletores para o preço atual
      const priceSelectors = [
        '.price-final',
        '.product-price__value',
        '[data-cy="current-price"]',
        '.product-price .price',
        '.product__price-value'
      ];
      
      for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
          currentPrice = cleanPrice(priceElement.textContent);
          break;
        }
      }
      
      // Preço original (riscado)
      let originalPrice = '';
      
      // Tentar vários seletores para o preço original
      const originalPriceSelectors = [
        '.price-original',
        '.product-price__list-price',
        '[data-cy="list-price"]',
        '.product-price .list-price',
        '.product__price-from'
      ];
      
      for (const selector of originalPriceSelectors) {
        const originalPriceElement = document.querySelector(selector);
        if (originalPriceElement) {
          originalPrice = cleanPrice(originalPriceElement.textContent);
          break;
        }
      }
      
      // Imagem do produto
      const productImage = 
        document.querySelector('.showcase-product img')?.src ||
        document.querySelector('.product__image img')?.src ||
        document.querySelector('[data-cy="product-image"] img')?.src ||
        document.querySelector('.showcase-image img')?.src ||
        document.querySelector('meta[property="og:image"]')?.content;
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: 'Centauro',
        platform: 'centauro',
        realProductUrl: window.location.href
      };
    });
    
    // Log para depuração
    console.log("Dados extraídos da Centauro:", JSON.stringify(productData, null, 2));
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Centauro:', error);
    console.error(error.stack);
    throw new Error(`Falha ao extrair dados do produto na Centauro: ${error.message}`);
  } finally {
    await browser.close();
  }
};