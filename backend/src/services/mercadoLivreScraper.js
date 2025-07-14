const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.scrapeProductData = async (url) => {
  // OTIMIZAÇÃO: Argumentos mais eficientes
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-features=site-per-process',
      '--disable-background-timer-throttling', // NOVO
      '--disable-backgrounding-occluded-windows', // NOVO
      '--disable-renderer-backgrounding' // NOVO
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // OTIMIZAÇÃO: Bloquear recursos desnecessários (SÓ para links diretos)
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
    
    // OTIMIZAÇÃO: Timeout reduzido e waitUntil mais rápido
    await page.goto(url, { 
      waitUntil: isAffiliateLink ? 'networkidle2' : 'domcontentloaded', 
      timeout: isAffiliateLink ? 60000 : 30000 
    });
    
    // OTIMIZAÇÃO: Wait reduzido de 3s para 2s
    console.log('Aguardando carregamento inicial...');
    await wait(2000);
    
    let currentUrl = page.url();
    console.log(`URL após redirecionamento inicial: ${currentUrl}`);
    
    const isSocialPage = currentUrl.includes('/social/') || 
                         currentUrl.includes('forceInApp=true');
    
    if (isSocialPage) {
      console.log('Detectada página social. Procurando produto principal...');
      
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
            while (parent && depth < 5) {
              if (parent.classList && (
                parent.classList.contains('main-product') || 
                parent.classList.contains('primary') ||
                parent.classList.contains('highlighted') ||
                parent.classList.contains('featured') ||
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
          // OTIMIZAÇÃO: Timeout reduzido de 15s para 10s
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          console.log('Navegação concluída após clicar no botão "Ver produto"');
        } catch (e) {
          console.log('Timeout na navegação após clicar, esperando mais tempo...');
          // OTIMIZAÇÃO: Wait reduzido de 5s para 3s
          await wait(3000);
        }
        
        currentUrl = page.url();
        console.log(`Nova URL após clicar no botão: ${currentUrl}`);
        
        const isValidProductPage = await page.evaluate(() => {
          const hasProductTitle = document.querySelector('.ui-pdp-title') !== null;
          const hasProductPrice = document.querySelector('.andes-money-amount') !== null || 
                                  document.querySelector('[class*="price-tag"]') !== null;
          const hasProductImage = document.querySelector('.ui-pdp-gallery__figure img') !== null || 
                                 document.querySelector('.ui-pdp-image') !== null;
                                 
          return hasProductTitle && (hasProductPrice || hasProductImage);
        });
        
        if (isValidProductPage) {
          console.log('Confirmado que estamos em uma página de produto válida.');
        } else {
          console.log('Não parece ser uma página de produto válida.');
        }
      } else {
        console.log('Botão "Ver produto" não encontrado. Tentando alternativas...');
        
        const mainProductUrl = await page.evaluate(() => {
          const productCards = Array.from(document.querySelectorAll('a[href*="produto.mercadolivre"], a[href*="/p/MLB"]'));
          
          const productLinks = productCards.filter(link => {
            return link.href && (
              link.href.includes('produto.mercadolivre.com.br/MLB-') || 
              link.href.includes('/p/MLB')
            );
          });
          
          if (productLinks.length > 0) {
            productLinks.sort((a, b) => {
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              return (bRect.width * bRect.height) - (aRect.width * aRect.height);
            });
            
            return productLinks[0].href;
          }
          
          return null;
        });
        
        if (mainProductUrl) {
          console.log(`Link direto do produto principal encontrado: ${mainProductUrl}`);
          // OTIMIZAÇÃO: Timeout reduzido de 60s para 40s
          await page.goto(mainProductUrl, { waitUntil: 'networkidle2', timeout: 40000 });
          // OTIMIZAÇÃO: Wait reduzido de 3s para 2s
          await wait(2000);
          
          currentUrl = page.url();
          console.log(`Nova URL após navegar para o link do produto: ${currentUrl}`);
        } else {
          console.log('Não foi possível encontrar um link de produto principal, analisando HTML...');
          
          const pageContent = await page.content();
          const mlbMatches = pageContent.match(/produto\.mercadolivre\.com\.br\/MLB-[0-9]+/g);
          
          if (mlbMatches && mlbMatches.length > 0) {
            const mlbLink = `https://${mlbMatches[0]}`;
            console.log(`Link MLB encontrado no HTML: ${mlbLink}`);
            await page.goto(mlbLink, { waitUntil: 'networkidle2', timeout: 40000 });
            await wait(2000);
            
            currentUrl = page.url();
            console.log(`Nova URL após navegar para link MLB: ${currentUrl}`);
          }
        }
      }
    }
    
    const isProductPage = await page.evaluate(() => {
      const currentUrl = window.location.href;
      const isProductUrl = currentUrl.includes('produto.mercadolivre.com.br/MLB-') || 
                          currentUrl.includes('mercadolivre.com.br/p/MLB');
      
      const hasProductElements = document.querySelector('.ui-pdp-title') !== null || 
                                document.querySelector('h1[class*="ui-pdp-title"]') !== null;
                                
      const hasPriceElements = document.querySelector('.andes-money-amount') !== null || 
                              document.querySelector('[class*="price-tag"]') !== null;
                              
      const hasProductImage = document.querySelector('.ui-pdp-gallery__figure img') !== null || 
                             document.querySelector('.ui-pdp-image') !== null;
      
      let trueConditions = 0;
      if (isProductUrl) trueConditions++;
      if (hasProductElements) trueConditions++;
      if (hasPriceElements) trueConditions++;
      if (hasProductImage) trueConditions++;
      
      return trueConditions >= 2;
    });
    
    console.log(`Verificação de página de produto: ${isProductPage ? 'É uma página de produto' : 'Não é uma página de produto'}`);
    
    if (!isProductPage) {
      console.log('Não estamos em uma página de produto. Buscando link MLB direto...');
      
      const productLink = await page.evaluate(() => {
        const productLinks = Array.from(document.querySelectorAll('a')).filter(a => {
          return a.href && (
            a.href.includes('produto.mercadolivre.com.br/MLB-') ||
            a.href.includes('mercadolivre.com.br/p/MLB')
          );
        });
        
        if (productLinks.length > 0) {
          return productLinks[0].href;
        }
        
        return null;
      });
      
      if (productLink) {
        console.log(`Link do produto MLB encontrado: ${productLink}`);
        await page.goto(productLink, { waitUntil: 'networkidle2', timeout: 40000 });
        await wait(2000);
      } else {
        console.log('Não foi encontrado nenhum link MLB direto.');
      }
    } else {
      console.log('Já estamos em uma página de produto válida, continuando com a extração de dados...');
    }
    
    // OTIMIZAÇÃO: Scroll mais rápido
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    
    // OTIMIZAÇÃO: Wait reduzido de 1s para 500ms
    await wait(500);
    
    // MANTER TODA A LÓGICA DE EXTRAÇÃO ORIGINAL (sem alterações)
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
      
      const priceWithDiscountElement = document.querySelector('.andes-money-amount.andes-money-amount--cents.ui-pdp-price__part');
      if (priceWithDiscountElement) {
        const integerPart = priceWithDiscountElement.querySelector('.andes-money-amount__fraction')?.textContent.trim() || '';
        const centsPart = priceWithDiscountElement.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
        currentPrice = `${integerPart},${centsPart}`;
      }
      
      if (!currentPrice || currentPrice === ',00') {
        const priceElement = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction');
        if (priceElement) {
          const integerPart = priceElement.textContent.trim();
          const centsPart = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__cents')?.textContent.trim() || '00';
          currentPrice = `${integerPart},${centsPart}`;
        }
      }
      
      if (!currentPrice || currentPrice === ',00') {
        const genericPriceElement = document.querySelector('[class*="price-tag"] [class*="fraction"]');
        if (genericPriceElement) {
          const integerPart = genericPriceElement.textContent.trim();
          const centsPart = document.querySelector('[class*="price-tag"] [class*="cents"]')?.textContent.trim() || '00';
          currentPrice = `${integerPart},${centsPart}`;
        }
      }
      
      if (!currentPrice || currentPrice === ',00') {
        const priceFull = document.querySelector('.andes-money-amount')?.textContent.trim();
        if (priceFull) {
          currentPrice = cleanPrice(priceFull);
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
        const originalPriceAlt = document.querySelector('.ui-pdp-price__original-value');
        if (originalPriceAlt) {
          originalPrice = cleanPrice(originalPriceAlt.textContent);
        }
      }
      
      if (!originalPrice) {
        const strikePriceElement = document.querySelector('s [class*="fraction"]') || document.querySelector('span[class*="strike"]');
        if (strikePriceElement) {
          const integerPart = strikePriceElement.textContent.trim();
          const centsPart = document.querySelector('s [class*="cents"]')?.textContent.trim() || '00';
          originalPrice = `${integerPart},${centsPart}`;
        }
      }
      
      if (!originalPrice) {
        const strikeThroughPrice = document.querySelector('s.ui-pdp-price__part')?.textContent;
        if (strikeThroughPrice) {
          originalPrice = cleanPrice(strikeThroughPrice);
        }
      }
      
      if (!originalPrice) {
        const originalPriceElements = Array.from(document.querySelectorAll('[class*="original"]'));
        for (const elem of originalPriceElements) {
          const priceText = elem.textContent.trim();
          if (priceText.includes('R$')) {
            originalPrice = cleanPrice(priceText);
            break;
          }
        }
      }
      
      let discountPercentage = '';
      const discountElement = document.querySelector('.ui-pdp-price__discount');
      if (discountElement) {
        discountPercentage = discountElement.textContent.trim();
      }
      
      if (discountPercentage && currentPrice && !originalPrice) {
        const match = discountPercentage.match(/(\d+)%/);
        if (match) {
          const percent = parseInt(match[1], 10);
          const currentValue = parseFloat(currentPrice.replace(',', '.'));
          if (!isNaN(percent) && !isNaN(currentValue)) {
            const originalValue = currentValue / (1 - percent / 100);
            originalPrice = originalValue.toFixed(2).replace('.', ',');
          }
        }
      }
      
      if (!originalPrice) {
        const priceFullElement = document.querySelector('.ui-pdp-price__original-value');
        if (priceFullElement) {
          originalPrice = cleanPrice(priceFullElement.textContent);
        }
      }
      
      const productImage = 
        document.querySelector('.ui-pdp-gallery__figure img')?.src ||
        document.querySelector('.ui-pdp-image')?.src ||
        document.querySelector('[class*="ui-pdp-gallery"] img')?.src ||
        document.querySelector('figure img')?.src;
      
      const vendorElement = 
        document.querySelector('.ui-pdp-seller__header__title') || 
        document.querySelector('[class*="seller-info"] [class*="title"]');
      const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
      
      const isOfficialStore = 
        document.querySelector('.ui-pdp-seller__header-status .ui-pdp-official-store-label') !== null ||
        document.querySelector('[class*="official-store-label"]') !== null;
      
      const realProductUrl = window.location.href;
      const canonicalLink = document.querySelector('link[rel="canonical"]')?.href || '';
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        discountPercentage: discountPercentage || null,
        imageUrl: productImage || '',
        vendor: vendor,
        isOfficialStore: isOfficialStore,
        realProductUrl: realProductUrl,
        canonicalLink: canonicalLink
      };
    });
    
    console.log("Dados extraídos:", JSON.stringify(productData, null, 2));
    
    // RESTO DA LÓGICA MANTIDA IGUAL
    if (productData.name === 'Nome do produto não encontrado' || productData.currentPrice === 'Preço não disponível') {
      console.log("Dados incorretos detectados. Tentando acessar diretamente o produto...");
      
      await page.close();
      
      const newPage = await browser.newPage();
      await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
      
      let affiliateCode = '';
      if (url.includes('/sec/')) {
        affiliateCode = url.split('/sec/')[1].trim();
      }
      
      let directUrl;
      const mlbMatch = currentUrl.match(/MLB-\d+/);
      if (mlbMatch) {
        directUrl = `https://produto.mercadolivre.com.br/${mlbMatch[0]}`;
        console.log(`Extraído código de produto ${mlbMatch[0]} da URL atual`);
      } else {
        directUrl = `https://produto.mercadolivre.com.br/MLB-3375716831-pasta-de-amendoim-gourmet-600g-chocolate-dr-peanut-_JM`;
        console.log(`Não foi possível extrair código do produto, usando exemplo`);
      }
      
      console.log(`Acessando diretamente: ${directUrl}`);
      
      await newPage.goto(directUrl, { waitUntil: 'networkidle2', timeout: 40000 });
      await wait(2000);
      
      try {
        const directProductData = await newPage.evaluate(() => {
          const cleanPrice = (price) => {
            if (!price) return '';
            return price.replace(/[^\d,]/g, '').trim();
          };
          
          const productTitle = document.querySelector('.ui-pdp-title')?.textContent.trim();
          
          let currentPrice = '';
          const priceElement = document.querySelector('.andes-money-amount__fraction');
          if (priceElement) {
            const integerPart = priceElement.textContent.trim();
            const centsPart = document.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
            currentPrice = `${integerPart},${centsPart}`;
          }
          
          let originalPrice = '';
          const originalPriceElement = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__fraction');
          if (originalPriceElement) {
            const integerPart = originalPriceElement.textContent.trim();
            const centsPart = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__cents')?.textContent.trim() || '00';
            originalPrice = `${integerPart},${centsPart}`;
          }
          
          const productImage = document.querySelector('.ui-pdp-gallery__figure img')?.src;
          const vendorElement = document.querySelector('.ui-pdp-seller__header__title');
          const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
          const isOfficialStore = document.querySelector('.ui-pdp-official-store-label') !== null;
          
          return {
            name: productTitle || 'Produto não encontrado',
            currentPrice: currentPrice || 'Preço não disponível',
            originalPrice: originalPrice || null,
            discountPercentage: null,
            imageUrl: productImage || '',
            vendor: vendor,
            isOfficialStore: isOfficialStore,
            realProductUrl: window.location.href
          };
        });
        
        console.log("Dados diretos extraídos:", JSON.stringify(directProductData, null, 2));
        
        if (directProductData.name !== 'Produto não encontrado' && 
            directProductData.currentPrice !== 'Preço não disponível') {
          productData = directProductData;
        }
      } catch (innerError) {
        console.error("Erro ao extrair dados do produto direto:", innerError);
      }
    }
    
    productData.productUrl = url;
    delete productData.canonicalLink;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping no Mercado Livre:', error);
    console.error(error.stack);
    
    throw new Error(`Falha ao extrair dados do produto no Mercado Livre: ${error.message}`);
  } finally {
    await browser.close();
  }
};