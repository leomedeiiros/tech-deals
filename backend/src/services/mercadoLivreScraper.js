const puppeteer = require('puppeteer');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.scrapeProductData = async (url) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-features=site-per-process'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Para links de afiliado /sec/, não otimizar muito para não quebrar redirecionamentos
    const isAffiliateLink = url.includes('/sec/');
    
    if (!isAffiliateLink) {
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    
    await page.setCacheEnabled(false);
    
    console.log(`Navegando para URL: ${url}`);
    
    if (isAffiliateLink) {
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      await wait(4000);
    } else {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      await wait(1500);
    }
    
    let currentUrl = page.url();
    console.log(`URL após redirecionamento: ${currentUrl}`);
    
    const isSocialPage = currentUrl.includes('/social/') || 
                         currentUrl.includes('forceInApp=true');
    
    if (isSocialPage) {
      console.log('Detectada página social. Procurando produto do link de afiliado...');
      
      // CORREÇÃO: Procurar pelo botão "Ir para produto" correto
      const productFound = await page.evaluate(() => {
        // Procurar especificamente por "Ir para produto" em elementos <a> com href
        const irParaProdutoButtons = Array.from(document.querySelectorAll('a')).filter(el => {
          return el.textContent.trim().toLowerCase() === 'ir para produto' && el.href;
        });
        
        console.log(`Encontrados ${irParaProdutoButtons.length} botões "Ir para produto"`);
        
        if (irParaProdutoButtons.length > 0) {
          // Se há múltiplos, pegar o primeiro (que geralmente é o produto em destaque)
          const targetButton = irParaProdutoButtons[0];
          console.log(`Clicando no botão: ${targetButton.href}`);
          targetButton.click();
          return true;
        }
        
        return false;
      });
      
      if (productFound) {
        console.log('Botão "Ir para produto" encontrado e clicado.');
        
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        } catch (e) {
          console.log('Timeout na navegação, esperando mais tempo...');
          await wait(3000);
        }
        
        currentUrl = page.url();
        console.log(`Nova URL após clicar: ${currentUrl}`);
      } else {
        console.log('Botão "Ir para produto" não encontrado. Tentando alternativas...');
        
        // Fallback: Buscar diretamente por links de produto
        const productLink = await page.evaluate(() => {
          const productLinks = Array.from(document.querySelectorAll('a')).filter(a => {
            return a.href && (
              a.href.includes('produto.mercadolivre.com.br/MLB-') ||
              a.href.includes('mercadolivre.com.br/p/MLB')
            );
          });
          
          return productLinks.length > 0 ? productLinks[0].href : null;
        });
        
        if (productLink) {
          console.log(`Link direto encontrado: ${productLink}`);
          await page.goto(productLink, { waitUntil: 'networkidle2', timeout: 60000 });
          await wait(3000);
          currentUrl = page.url();
        }
      }
    }
    
    // CORREÇÃO: Verificação mais flexível da página de produto
    const isProductPage = await page.evaluate(() => {
      // Se tem título e preço do produto, é página de produto válida
      const hasProductElements = document.querySelector('.ui-pdp-title') !== null;
      const hasPriceElements = document.querySelector('.andes-money-amount') !== null;
      
      return hasProductElements && hasPriceElements;
    });
    
    console.log(`É página de produto: ${isProductPage}`);
    
    if (!isProductPage) {
      throw new Error('Não conseguiu navegar para a página do produto específico');
    }
    
    // Scroll otimizado
    await page.evaluate(() => window.scrollTo(0, 300));
    await wait(1000);
    
    // Extrair dados do produto
    const productData = await page.evaluate(() => {
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      const productTitle = 
        document.querySelector('.ui-pdp-title')?.textContent.trim() || 
        document.querySelector('h1[class*="ui-pdp-title"]')?.textContent.trim() ||
        document.querySelector('h1')?.textContent.trim();
      
      let currentPrice = '';
      const mainPriceElement = document.querySelector('.andes-money-amount.andes-money-amount--cents.ui-pdp-price__part');
      if (mainPriceElement) {
        const integerPart = mainPriceElement.querySelector('.andes-money-amount__fraction')?.textContent.trim() || '';
        const centsPart = mainPriceElement.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
        currentPrice = `${integerPart},${centsPart}`;
      }
      
      if (!currentPrice || currentPrice === ',00') {
        const fallbackPrice = document.querySelector('.andes-money-amount')?.textContent.trim();
        if (fallbackPrice) {
          currentPrice = cleanPrice(fallbackPrice);
        }
      }
      
      let originalPrice = '';
      const originalPriceElement = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__fraction');
      if (originalPriceElement) {
        const integerPart = originalPriceElement.textContent.trim();
        const centsPart = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__cents')?.textContent.trim() || '00';
        originalPrice = `${integerPart},${centsPart}`;
      }
      
      if (!originalPrice) {
        const originalFallback = document.querySelector('.ui-pdp-price__original-value')?.textContent;
        if (originalFallback) {
          originalPrice = cleanPrice(originalFallback);
        }
      }
      
      const productImage = 
        document.querySelector('.ui-pdp-gallery__figure img')?.src ||
        document.querySelector('.ui-pdp-image')?.src ||
        document.querySelector('[class*="ui-pdp-gallery"] img')?.src;
      
      const vendorElement = document.querySelector('.ui-pdp-seller__header__title');
      const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
      
      const isOfficialStore = document.querySelector('.ui-pdp-seller__header-status .ui-pdp-official-store-label') !== null;
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: vendor,
        isOfficialStore: isOfficialStore,
        realProductUrl: window.location.href
      };
    });
    
    console.log('✅ Dados extraídos:', {
      name: productData.name.substring(0, 50) + '...',
      currentPrice: productData.currentPrice,
      originalPrice: productData.originalPrice
    });
    
    productData.productUrl = url;
    return productData;
    
  } catch (error) {
    console.error('❌ Erro no scraper Mercado Livre:', error.message);
    throw new Error(`Falha ao extrair dados do produto no Mercado Livre: ${error.message}`);
  } finally {
    await browser.close();
  }
};