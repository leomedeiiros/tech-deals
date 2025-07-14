const puppeteer = require('puppeteer');

// Função auxiliar otimizada
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
      '--disable-features=site-per-process',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // OTIMIZAÇÃO: Bloquear recursos desnecessários
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // User agent otimizado
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Headers essenciais apenas
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9'
    });
    
    await page.setCacheEnabled(false);
    
    console.log(`Navegando para URL: ${url}`);
    
    // OTIMIZAÇÃO: domcontentloaded + timeout reduzido
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // OTIMIZAÇÃO: Wait reduzido de 4s para 1.5s
    await wait(1500);
    
    let currentUrl = page.url();
    console.log(`URL atual: ${currentUrl}`);
    
    // OTIMIZAÇÃO: Verificação mais rápida se é página social
    const isSocialPage = currentUrl.includes('/social/') || 
                         currentUrl.includes('forceInApp=true');
    
    if (isSocialPage) {
      console.log('Detectada página social. Procurando produto principal...');
      
      // Encontrar e clicar no botão "Ver produto" de forma otimizada
      const productFound = await page.evaluate(() => {
        const verProdutoButtons = Array.from(document.querySelectorAll('a, button')).filter(el => {
          return el.textContent.trim().toLowerCase() === 'ver produto';
        });
        
        if (verProdutoButtons.length > 0) {
          verProdutoButtons.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            return aRect.top - bRect.top;
          });
          
          const mainButton = verProdutoButtons.find(btn => {
            let parent = btn.parentElement;
            let depth = 0;
            while (parent && depth < 3) { // Reduzido de 5 para 3
              if (parent.classList && (
                parent.classList.contains('main-product') || 
                parent.classList.contains('primary') ||
                parent.offsetWidth > 400 || parent.offsetHeight > 300
              )) {
                return true;
              }
              parent = parent.parentElement;
              depth++;
            }
            return false;
          }) || verProdutoButtons[0];
          
          mainButton.click();
          return true;
        }
        return false;
      });
      
      if (productFound) {
        console.log('Botão "Ver produto" encontrado e clicado.');
        
        try {
          // OTIMIZAÇÃO: Timeout reduzido para 10s
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (e) {
          console.log('Timeout na navegação, continuando...');
          // OTIMIZAÇÃO: Wait reduzido de 5s para 2s
          await wait(2000);
        }
        
        currentUrl = page.url();
        console.log(`Nova URL: ${currentUrl}`);
      }
    }
    
    // OTIMIZAÇÃO: Verificação mais eficiente da página de produto
    const isProductPageCheck = await page.evaluate(() => {
      const currentUrl = window.location.href;
      const isProductUrl = currentUrl.includes('produto.mercadolivre.com.br/MLB-') || 
                          currentUrl.includes('mercadolivre.com.br/p/MLB');
      
      const hasProductElements = document.querySelector('.ui-pdp-title') !== null;
      const hasPriceElements = document.querySelector('.andes-money-amount') !== null;
      
      return isProductUrl || (hasProductElements && hasPriceElements);
    });
    
    // OTIMIZAÇÃO: Só buscar outro link se realmente necessário
    if (!isProductPageCheck) {
      console.log('Procurando link MLB direto...');
      
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
        console.log(`Navegando para: ${productLink}`);
        await page.goto(productLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // OTIMIZAÇÃO: Wait reduzido de 3s para 1s
        await wait(1000);
      }
    }
    
    // OTIMIZAÇÃO: Scroll mais rápido
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });
    await wait(500); // Reduzido de 1s para 500ms
    
    // Extrair dados do produto (mantido igual, mas otimizado)
    const productData = await page.evaluate(() => {
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Nome do produto
      const productTitle = 
        document.querySelector('.ui-pdp-title')?.textContent.trim() || 
        document.querySelector('h1[class*="ui-pdp-title"]')?.textContent.trim() ||
        document.querySelector('h1')?.textContent.trim();
      
      // Preço atual - versão otimizada
      let currentPrice = '';
      
      // Buscar preço principal primeiro
      const mainPriceElement = document.querySelector('.andes-money-amount.andes-money-amount--cents.ui-pdp-price__part');
      if (mainPriceElement) {
        const integerPart = mainPriceElement.querySelector('.andes-money-amount__fraction')?.textContent.trim() || '';
        const centsPart = mainPriceElement.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
        currentPrice = `${integerPart},${centsPart}`;
      }
      
      // Fallback rápido se não encontrou
      if (!currentPrice || currentPrice === ',00') {
        const fallbackPrice = document.querySelector('.andes-money-amount')?.textContent.trim();
        if (fallbackPrice) {
          currentPrice = cleanPrice(fallbackPrice);
        }
      }
      
      // Preço original - versão otimizada
      let originalPrice = '';
      
      const originalPriceElement = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__fraction');
      if (originalPriceElement) {
        const integerPart = originalPriceElement.textContent.trim();
        const centsPart = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__cents')?.textContent.trim() || '00';
        originalPrice = `${integerPart},${centsPart}`;
      }
      
      // Fallback para preço original
      if (!originalPrice) {
        const originalFallback = document.querySelector('.ui-pdp-price__original-value')?.textContent;
        if (originalFallback) {
          originalPrice = cleanPrice(originalFallback);
        }
      }
      
      // Imagem do produto
      const productImage = 
        document.querySelector('.ui-pdp-gallery__figure img')?.src ||
        document.querySelector('.ui-pdp-image')?.src ||
        document.querySelector('[class*="ui-pdp-gallery"] img')?.src;
      
      // Vendedor
      const vendorElement = document.querySelector('.ui-pdp-seller__header__title');
      const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
      
      // Loja oficial
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
    
    // Log otimizado
    console.log('✅ Dados extraídos:', {
      name: productData.name.substring(0, 50) + '...',
      currentPrice: productData.currentPrice,
      originalPrice: productData.originalPrice
    });
    
    // OTIMIZAÇÃO: Verificação rápida de dados válidos
    if (productData.name === 'Nome do produto não encontrado' || 
        productData.currentPrice === 'Preço não disponível') {
      
      console.log("❌ Dados incompletos, tentando método direto...");
      
      // Extrair código MLB da URL atual para tentativa direta
      const mlbMatch = currentUrl.match(/MLB-\d+/);
      if (mlbMatch) {
        const directUrl = `https://produto.mercadolivre.com.br/${mlbMatch[0]}`;
        console.log(`🔄 Tentativa direta: ${directUrl}`);
        
        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await wait(1000); // Reduzido drasticamente
        
        // Extrair dados novamente (versão simplificada)
        const directData = await page.evaluate(() => {
          const cleanPrice = (price) => price ? price.replace(/[^\d,]/g, '').trim() : '';
          
          const title = document.querySelector('.ui-pdp-title')?.textContent.trim();
          const priceElement = document.querySelector('.andes-money-amount__fraction');
          let currentPrice = '';
          
          if (priceElement) {
            const integer = priceElement.textContent.trim();
            const cents = document.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
            currentPrice = `${integer},${cents}`;
          }
          
          const originalElement = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__fraction');
          let originalPrice = '';
          if (originalElement) {
            const integer = originalElement.textContent.trim();
            const cents = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__cents')?.textContent.trim() || '00';
            originalPrice = `${integer},${cents}`;
          }
          
          const image = document.querySelector('.ui-pdp-gallery__figure img')?.src;
          const vendor = document.querySelector('.ui-pdp-seller__header__title')?.textContent.trim() || 'Mercado Livre';
          
          return {
            name: title || 'Produto do Mercado Livre',
            currentPrice: currentPrice || 'Preço não disponível',
            originalPrice: originalPrice || null,
            imageUrl: image || '',
            vendor: vendor,
            isOfficialStore: false,
            realProductUrl: window.location.href
          };
        });
        
        // Usar dados diretos se forem melhores
        if (directData.name !== 'Produto do Mercado Livre' && 
            directData.currentPrice !== 'Preço não disponível') {
          Object.assign(productData, directData);
        }
      }
    }
    
    // Preservar URL original
    productData.productUrl = url;
    
    return productData;
    
  } catch (error) {
    console.error('❌ Erro no scraper Mercado Livre:', error.message);
    throw new Error(`Falha ao extrair dados do produto no Mercado Livre: ${error.message}`);
  } finally {
    await browser.close();
  }
};