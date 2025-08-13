const puppeteer = require('puppeteer');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// === FIX: util p/ canonizar URL de produto (remove query/fragment/trackers) ===
const toCanonicalProductUrl = (raw) => {
  try {
    const url = new URL(raw);
    const href = url.href;

    // 1) Produto clássico: .../MLB-#########...
    const mId = href.match(/MLB-\d+/i);
    if (mId) {
      return `https://produto.mercadolivre.com.br/${mId[0]}`;
    }

    // 2) Catálogo: .../p/MLB#########
    const mCatalog = href.match(/\/p\/(MLB\d+)/i);
    if (mCatalog) {
      return `https://www.mercadolivre.com.br/p/${mCatalog[1]}`;
    }

    // 3) Fallback: remove params e fragment
    return href.split('#')[0].split('?')[0];
  } catch {
    return raw;
  }
};

// === FIX: extrair URL destino de páginas "registration" ===
const extractRedirectFromRegistration = (raw) => {
  try {
    const u = new URL(raw);
    if (/\/registration$/i.test(u.pathname)) {
      const conf = u.searchParams.get('confirmation_url');
      if (conf) return toCanonicalProductUrl(conf);
    }
    if (/\/hub\/registration$/i.test(u.pathname)) {
      const redir = u.searchParams.get('redirect_url');
      if (redir) return toCanonicalProductUrl(decodeURIComponent(redir));
    }
  } catch {}
  return null;
};

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
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();

    // === FIX: usar UA do Chromium atual (sem "Headless") ===
    const defaultUA = await browser.userAgent();
    await page.setUserAgent(defaultUA.replace('Headless', '') || defaultUA);

    // === FIX: Referer "limpo" ajuda a evitar negative_traffic ===
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Referer': 'https://www.google.com/'
    });

    await page.setCacheEnabled(false);
    
    // OTIMIZAÇÃO: bloquear recursos pesados, mas **não** "other"
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const rt = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(rt)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    console.log(`Navegando para URL: ${url}`);
    
    // OTIMIZAÇÃO AGRESSIVA: domcontentloaded + timeout reduzido
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    
    // OTIMIZAÇÃO AGRESSIVA: Wait mínimo
    await wait(1000);
    
    let currentUrl = page.url();
    console.log(`URL após redirecionamento inicial: ${currentUrl}`);
    
    // === FIX: limpar "forceInApp" e afins se cair em /social/ ===
    const isSocialPage = currentUrl.includes('/social/') || currentUrl.includes('forceInApp=true');

    if (isSocialPage) {
      console.log('Detectada página social. Procurando produto principal...');
      
      const productFound = await page.evaluate(() => {
        const verProdutoButtons = Array.from(document.querySelectorAll('a, button')).filter(el => {
          return el.textContent.trim().toLowerCase() === 'ver produto';
        });
        
        if (verProdutoButtons.length > 0) {
          verProdutoButtons[0].click();
          return true;
        }
        return false;
      });
      
      if (productFound) {
        console.log('Botão "Ver produto" encontrado e clicado.');
        try {
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 });
        } catch (e) {
          await wait(1000);
        }
        currentUrl = page.url();
        console.log(`Nova URL após clicar no botão: ${currentUrl}`);
      } else {
        console.log('Botão "Ver produto" não encontrado. Tentando alternativas...');
        
        let mainProductUrl = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          const productLinks = anchors
            .map(a => a.href)
            .filter(href => href.includes('produto.mercadolivre.com.br/MLB-') || href.includes('/p/MLB'));
          return productLinks.length > 0 ? productLinks[0] : null;
        });

        if (mainProductUrl) {
          console.log(`Link direto encontrado: ${mainProductUrl}`);
          // === FIX: canonizar antes de navegar (remove trackers e _JM extras) ===
          const canonical = toCanonicalProductUrl(mainProductUrl);
          console.log(`Link canonizado: ${canonical}`);
          await page.goto(canonical, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await wait(500);
          currentUrl = page.url();
        }
      }
    }

    // === FIX: se caiu em registration/hub/registration, extrair destino e tentar novamente (1-2 tentativas) ===
    for (let i = 0; i < 2; i++) {
      const regTarget = extractRedirectFromRegistration(currentUrl);
      if (regTarget) {
        console.log(`Página de registration detectada. Redirecionando direto ao produto: ${regTarget}`);
        await page.goto(regTarget, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await wait(800);
        currentUrl = page.url();
        console.log(`URL após bypass do registration: ${currentUrl}`);
      } else {
        break;
      }
    }
    
    // OTIMIZAÇÃO: Verificação simplificada (produto)
    const isProductPage = await page.evaluate(() => {
      return document.querySelector('.ui-pdp-title') !== null && 
             document.querySelector('.andes-money-amount') !== null;
    });
    
    console.log(`Verificação de página de produto: ${isProductPage ? 'É uma página de produto' : 'Não é uma página de produto'}`);
    
    if (!isProductPage) {
      // Tentar achar links MLB na página e navegar para o primeiro, canonizando
      const productLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => href.includes('produto.mercadolivre.com.br/MLB-') || href.includes('mercadolivre.com.br/p/MLB'));
        return links.length > 0 ? links[0] : null;
      });
      
      if (productLink) {
        const canonical = toCanonicalProductUrl(productLink);
        console.log(`Link MLB encontrado: ${productLink}`);
        console.log(`Link MLB canonizado: ${canonical}`);
        await page.goto(canonical, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await wait(500);

        // === FIX: se mesmo assim mandou p/ registration, tentar extrair mais uma vez
        let after = page.url();
        const regAgain = extractRedirectFromRegistration(after);
        if (regAgain) {
          console.log(`Ainda em registration. Tentando destino final: ${regAgain}`);
          await page.goto(regAgain, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await wait(600);
        }
      }
    }
    
    // OTIMIZAÇÃO: Scroll mínimo
    await page.evaluate(() => window.scrollTo(0, 300));
    await wait(200);
    
    // MANTER A LÓGICA DE EXTRAÇÃO ORIGINAL (sem mudanças)
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
      
      const productImage = 
        document.querySelector('.ui-pdp-gallery__figure img')?.src ||
        document.querySelector('.ui-pdp-image')?.src ||
        document.querySelector('[class*="ui-pdp-gallery"] img')?.src;
      
      const vendorElement = 
        document.querySelector('.ui-pdp-seller__header__title') || 
        document.querySelector('[class*="seller-info"] [class*="title"]');
      const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
      
      const isOfficialStore = 
        document.querySelector('.ui-pdp-seller__header-status .ui-pdp-official-store-label') !== null;
      
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
    
    console.log("Dados extraídos:", JSON.stringify(productData, null, 2));
    
    // OTIMIZAÇÃO: Remover toda a lógica de fallback que demora muito
    // Se não conseguiu extrair, falhar rápido
    
    productData.productUrl = url;
    return productData;
    
  } catch (error) {
    console.error('Erro ao fazer scraping no Mercado Livre:', error);
    throw new Error(`Falha ao extrair dados do produto no Mercado Livre: ${error.message}`);
  } finally {
    await browser.close();
  }
};
