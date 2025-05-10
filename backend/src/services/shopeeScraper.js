// backend/src/services/shopeeScraper.js
const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para gerar um user agent aleatório
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
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
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
      '--window-size=1920,1080'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent aleatório
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    
    // Configurar headers extras para parecer mais com um navegador real
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'sec-ch-ua': '"Google Chrome";v="118", "Chromium";v="118", "Not=A?Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    });
    
    // Configurar cookies e storage para parecer um navegador real
    await page.evaluateOnNewDocument(() => {
      // Sobrescrever as propriedades que os sites usam para detectar bots
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          }
        ],
      });
      
      // Adicionar WebGL
      const getParameter = WebGLRenderingContext.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Open Source Technology Center';
        }
        if (parameter === 37446) {
          return 'Mesa DRI Intel(R) Haswell Mobile ';
        }
        return getParameter(parameter);
      };
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
    await wait(5000);
    
    // Capturar URL após redirecionamento
    let currentUrl = page.url();
    console.log(`URL após redirecionamento: ${currentUrl}`);
    
    // Verificar se há modais de localização e fechá-los
    try {
      const locationModal = await page.$('[data-testid="location-modal-close"]');
      if (locationModal) {
        console.log('Fechando modal de localização...');
        await locationModal.click();
        await wait(1000);
      }
    } catch (e) {
      console.log('Nenhum modal de localização encontrado ou erro ao fechar.');
    }
    
    // Verificar cookies
    try {
      const cookieButtons = await page.$$('button:has-text("Aceitar"), button:has-text("Accept")');
      if (cookieButtons.length > 0) {
        console.log('Aceitando cookies...');
        await cookieButtons[0].click();
        await wait(1000);
      }
    } catch (e) {
      console.log('Nenhum botão de cookies encontrado ou erro ao clicar.');
    }
    
    // Rolar a página para carregar todo o conteúdo
    await page.evaluate(() => {
      window.scrollTo(0, 300);
      setTimeout(() => window.scrollTo(0, 600), 300);
      setTimeout(() => window.scrollTo(0, 0), 600);
    });
    
    await wait(2000);
    
    // Tirar screenshot para debug
    await page.screenshot({path: 'shopee-produto.png'});
    
    // Extrair dados do produto
    const productData = await page.evaluate(() => {
      // Função para limpar texto de preço
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Função para extrair preço com R$
      const extractPriceWithRS = (text) => {
        if (!text) return null;
        const match = text.match(/R\$\s*(\d+[.,]\d+)/);
        return match ? match[1].replace('.', ',') : null;
      };
      
      // Nome do produto - múltiplos seletores para maior robustez
      let productTitle = '';
      const titleSelectors = [
        '[data-testid="product-detail-page"]  h1',
        '.product-name',
        '[class*="product-detail"] h1',
        '[class*="product-title"]',
        'h1[class*="title"]',
        'h1.title',
        'h1'
      ];
      
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          productTitle = element.textContent.trim();
          break;
        }
      }
      
      // Preço atual - verificar múltiplos seletores possíveis
      let currentPrice = '';
      
      // Tentativa 1: seletores específicos da Shopee
      const priceSelectors = [
        '.product-price__current-price',
        '.current-price',
        '[data-testid="product-price-current"]',
        'div[class*="price-current"] span',
        'div[class*="current-price"] span',
        'span[class*="current"]',
        '.price-wrapper span',
        '[class*="product-price"] [class*="current"]',
        'div.OitPAv'  // Classe específica da Shopee para preço atual
      ];
      
      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          currentPrice = cleanPrice(element.textContent);
          if (currentPrice) break;
        }
      }
      
      // Se ainda não encontrou, procurar por texto que contenha R$
      if (!currentPrice) {
        const allTexts = document.body.textContent;
        const matches = allTexts.match(/R\$\s*(\d+[\.\,]?\d*)/g);
        if (matches && matches.length > 0) {
          // Pegar o primeiro preço encontrado
          currentPrice = cleanPrice(matches[0]);
        }
      }
      
      // Preço original (riscado) - múltiplos seletores possíveis
      let originalPrice = '';
      
      const originalPriceSelectors = [
        '.product-price__original-price',
        '.original-price',
        '[data-testid="product-price-original"]',
        'div[class*="price-original"] span',
        'div[class*="original-price"] span',
        'span[class*="original"]',
        'span[class*="before"]',
        'del',
        'strike',
        's',
        'div.d7k1pa'  // Classe específica da Shopee para preço riscado
      ];
      
      for (const selector of originalPriceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          originalPrice = cleanPrice(element.textContent);
          if (originalPrice) break;
        }
      }
      
      // Tentar extrair porcentagem de desconto
      let discountPercentage = '';
      const discountSelectors = [
        '.product-price__discount',
        '[class*="discount"]',
        '[class*="off"]',
        '[class*="save"]',
        'span.u1qGdc'  // Classe específica da Shopee para desconto
      ];
      
      for (const selector of discountSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.includes('%')) {
          discountPercentage = element.textContent.trim();
          break;
        }
      }
      
      // Imagem do produto
      let productImage = '';
      const imageSelectors = [
        '[data-testid="product-image-gallery"] img',
        '.product-image img',
        'div[class*="product-image"] img',
        'div[class*="gallery"] img',
        'img[class*="product"]',
        'meta[property="og:image"]',
        'div.o6mPWf img'  // Classe específica da Shopee para galeria
      ];
      
      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          productImage = selector === 'meta[property="og:image"]' ? 
            element.getAttribute('content') : 
            element.getAttribute('src');
          if (productImage && !productImage.startsWith('data:')) {
            // Verificar se é uma imagem válida (não ícone ou thumb)
            if (productImage.includes('_tn.') || productImage.includes('icon')) {
              continue;
            }
            break;
          }
        }
      }
      
      // Vendedor - múltiplos seletores
      let vendor = 'Shopee';
      const vendorSelectors = [
        '[data-testid="seller-name"]',
        '.seller-name',
        '[class*="seller"] [class*="name"]',
        '[class*="shop-name"]',
        'a[href*="/shop/"]'
      ];
      
      for (const selector of vendorSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          vendor = element.textContent.trim();
          break;
        }
      }
      
      // Verificar se o preço atual é menor que o original (como esperado)
      if (originalPrice && currentPrice) {
        const origValue = parseFloat(originalPrice.replace(',', '.'));
        const currValue = parseFloat(currentPrice.replace(',', '.'));
        
        if (origValue <= currValue) {
          // Se não for, pode ser um erro. Inverter apenas se a diferença for substancial (> 5%)
          if (currValue > origValue * 1.05) {
            console.log("Invertendo preços porque original <= current");
            [originalPrice, currentPrice] = [currentPrice, originalPrice];
          }
        }
      }
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        discountPercentage: discountPercentage || null,
        imageUrl: productImage || '',
        vendor: vendor,
        isShop: vendor !== 'Shopee',
        platform: 'shopee',
        realProductUrl: window.location.href
      };
    });
    
    // Verificação adicional para extrair os preços corretos
    if (productData.name !== 'Nome do produto não encontrado') {
      // Extrair os preços da página inteira
      const allPricesData = await page.evaluate(() => {
        // Função auxiliar para extrair preço com formato R$
        const extractPrice = (text) => {
          if (!text) return null;
          const match = text.match(/R\$\s*(\d+[.,]\d+)/);
          return match ? match[1].replace('.', ',') : null;
        };
        
        // Pegar todos os textos que contêm R$
        const priceTexts = [];
        const walker = document.createTreeWalker(
          document.body, 
          NodeFilter.SHOW_TEXT, 
          { acceptNode: node => node.textContent.includes('R$') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
        );
        
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const text = node.textContent.trim();
          
          // Ignorar nós vazios
          if (!text) continue;
          
          const price = extractPrice(text);
          if (price) {
            // Verificar se é preço original baseado no contexto
            const parentEl = node.parentElement;
            const isOriginal = parentEl && (
              parentEl.classList.toString().match(/original|before|strike|through|del|old/) ||
              parentEl.textContent.toLowerCase().includes('de r$') ||
              parentEl.tagName.toLowerCase() === 'del' ||
              parentEl.tagName.toLowerCase() === 's'
            );
            
            priceTexts.push({
              text,
              price,
              isOriginal
            });
          }
        }
        
        return {priceTexts};
      });
      
      console.log("Todos os preços encontrados:", allPricesData);
      
      // Caso contrário, usar os preços extraídos da página
      if (allPricesData.priceTexts && allPricesData.priceTexts.length > 0) {
        // Converter para números para comparação
        const prices = allPricesData.priceTexts.map(item => ({
          ...item,
          value: parseFloat(item.price.replace(',', '.'))
        }));
        
        // Ordenar preços (menor para maior)
        prices.sort((a, b) => a.value - b.value);
        
        // Se temos elementos marcados como originais, usar eles
        const originalPrices = prices.filter(p => p.isOriginal);
        const currentPrices = prices.filter(p => !p.isOriginal);
        
        // Se temos preços originais identificados, usar o maior deles
        if (originalPrices.length > 0) {
          // Pegar o maior preço original
          originalPrices.sort((a, b) => b.value - a.value);
          productData.originalPrice = originalPrices[0].price;
        } 
        // Caso contrário, se temos pelo menos 2 preços, o maior é provavelmente o original
        else if (prices.length >= 2) {
          productData.originalPrice = prices[prices.length - 1].price;
        }
        
        // Se temos preços atuais identificados, usar o menor deles
        if (currentPrices.length > 0) {
          productData.currentPrice = currentPrices[0].price;
        } 
        // Caso contrário, se temos pelo menos 1 preço, o menor é provavelmente o atual
        else if (prices.length >= 1) {
          productData.currentPrice = prices[0].price;
        }
      }
    }
    
    // Log para depuração
    console.log("Dados extraídos da Shopee:", JSON.stringify(productData, null, 2));
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Shopee:', error);
    console.error(error.stack);
    
    // Retornar dados fictícios em caso de erro para não quebrar a aplicação
    return {
      name: "Produto Shopee (Placeholder)",
      currentPrice: "29",
      originalPrice: "59",
      imageUrl: "",
      vendor: "Shopee",
      platform: "shopee",
      productUrl: url,
      isPlaceholder: true,
      error: error.message
    };
  } finally {
    await browser.close();
  }
};