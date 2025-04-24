// backend/src/services/nikeScraper.js
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
      
      // Simular uma tela comum
      window.innerWidth = 1920;
      window.innerHeight = 1080;
      window.outerWidth = 1920;
      window.outerHeight = 1080;
      window.screen = {
        availWidth: 1920,
        availHeight: 1080,
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelDepth: 24
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
    
    // Verificar se estamos em uma página de afiliado da Awin (tidd.ly)
    if (url.includes('tidd.ly') || url.includes('awin')) {
      console.log('Detectado link de afiliado Awin, aguardando redirecionamentos...');
      
      // Aguardar mais tempo para redirecionamentos de afiliados
      await wait(8000);
      
      // Verificar se há um botão de consentimento de cookies para clicar
      try {
        const cookieButton = await page.$('button[id*="cookie"], button[class*="cookie"], button[id*="gdpr"], button[class*="gdpr"], button[id*="aceitar"], button[class*="aceitar"], button[id*="accept"], button[class*="accept"]');
        if (cookieButton) {
          console.log('Botão de cookie encontrado, clicando...');
          await cookieButton.click();
          await wait(2000);
        }
      } catch (e) {
        console.log('Nenhum botão de cookie encontrado ou erro ao clicar.');
      }
      
      // Obter URL atual após redirecionamentos
      currentUrl = page.url();
      console.log(`URL após redirecionamentos de afiliado: ${currentUrl}`);
    }
    
    // Verificação adicional para botões de aceitação de cookies
    try {
      // Tentar encontrar e clicar em vários possíveis botões de cookie
      const cookieSelectors = [
        'button[id*="cookie"][id*="accept"]',
        'button[class*="cookie"][class*="accept"]',
        'button[id*="gdpr"]',
        'button[class*="gdpr"]',
        'button[id*="aceitar"]',
        'button[class*="aceitar"]',
        'button[id*="accept"]',
        'button[class*="accept"]',
        'a[id*="cookie"][id*="accept"]',
        'a[class*="cookie"][class*="accept"]'
      ];
      
      for (const selector of cookieSelectors) {
        const cookieButton = await page.$(selector);
        if (cookieButton) {
          console.log(`Botão de cookie encontrado com seletor ${selector}, clicando...`);
          await cookieButton.click();
          await wait(1000);
          break;
        }
      }
    } catch (e) {
      console.log('Erro ao lidar com diálogos de cookie:', e.message);
    }
    
    // Rolar a página para carregar todo o conteúdo
    await page.evaluate(() => {
      window.scrollTo(0, 300);
      setTimeout(() => window.scrollTo(0, 600), 300);
      setTimeout(() => window.scrollTo(0, 0), 600);
    });
    
    await wait(2000);
    
    // Tirar screenshot para debug
    await page.screenshot({path: 'nike-produto.png'});
    
    // Extrair dados do produto com seletores atualizados e mais robustos
    const productData = await page.evaluate(() => {
      // Função para limpar texto de preço
      const cleanPrice = (price) => {
        if (!price) return '';
        
        // Verificar se temos múltiplos preços concatenados
        if (price.length > 10) {
          // Se houver mais de 10 caracteres, provavelmente temos preços concatenados
          // Pegar apenas o primeiro preço
          const matches = price.match(/(\d+,\d+)/);
          if (matches && matches[1]) {
            return matches[1];
          }
        }
        
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Nome do produto - múltiplos seletores para maior robustez
      let productTitle = '';
      const titleSelectors = [
        'h1.title-product',
        '[data-test="product-title"]',
        '.product-title',
        'h1[class*="title"]',
        'h1[class*="product-name"]',
        'h1[data-testid*="product-name"]',
        'h1.headline-2',
        'h1.css-zis9ta',
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
      const priceSelectors = [
        '.current-price',
        '.price.is-current',
        '.product-price',
        '[data-test="product-price"]',
        '[data-test="product-price-reduced"]',
        '.css-1sltfzp',
        '.css-xq9k5q',
        'div[data-test*="current-price"]',
        'div[class*="price"] span',
        '.product-info-price span',
        'span[class*="current-price"]',
        'span[class*="sales-price"]',
        // Seletores específicos Nike Brasil
        '.valor-por',
        'span.atual',
        '.product-info-price .valor',
        '.elemento_preco .valor-por',
        '.price .sale'
      ];
      
      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          currentPrice = cleanPrice(element.textContent);
          if (currentPrice) break;
        }
      }
      
      // Se ainda não encontrou o preço, procurar no HTML da página
      if (!currentPrice) {
        const priceRegex = /R\$\s*(\d+[\.,]?\d*)/g;
        const matches = document.body.textContent.match(priceRegex);
        if (matches && matches.length > 0) {
          currentPrice = cleanPrice(matches[0]);
        }
      }
      
      // Preço original (riscado)
      let originalPrice = '';
      const originalPriceSelectors = [
        '.suggested-price',
        '.price.is-suggested',
        '.product-suggested-price',
        '[data-test="product-price-original"]',
        '.css-0',
        'div[data-test*="list-price"]',
        'div[class*="list-price"]',
        'div[class*="previous-price"]',
        'del[class*="price"]',
        'span[class*="old-price"]',
        // Novos seletores específicos para Nike Brasil
        'div.priceBefore',
        'span.before', 
        '.original-price',
        'del.valor-anterior',
        '.product-price div span:not(.atual)',
        '.valor-de',
        '.preco-list-item .valor'
      ];
      
      for (const selector of originalPriceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          originalPrice = cleanPrice(element.textContent);
          if (originalPrice) break;
        }
      }
      
      // Verificação de preço original baseada no HTML
      if (!originalPrice) {
        // Tente encontrar um padrão comum de preço riscado
        const html = document.body.innerHTML;
        const priceRegex = /de\s*R\$\s*(\d+[\.,]?\d*)/gi;
        const matches = html.match(priceRegex);
        if (matches && matches.length > 0) {
          const firstMatch = matches[0];
          const priceMatch = firstMatch.match(/\d+[\.,]?\d*/);
          if (priceMatch) {
            originalPrice = priceMatch[0];
          }
        }
      }
      
      // Imagem do produto
      let productImage = '';
      const imageSelectors = [
        '.photo-product-zoom img',
        '.product-image img',
        '[data-test="product-image"] img',
        '.carousel img',
        'meta[property="og:image"]',
        'img.css-viwop1',
        'img[data-test*="product-image"]',
        'div[class*="pdp-image"] img',
        'div[class*="image-grid"] img',
        'picture img',
        // Seletores específicos Nike Brasil
        '.foto-produto-detalhe img',
        '.showcase-product img',
        '.product-img img'
      ];
      
      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          productImage = selector === 'meta[property="og:image"]' ? 
            element.getAttribute('content') : 
            element.getAttribute('src');
          if (productImage) break;
        }
      }
      
      // Tentar extrair informações de um script JSON
      let scriptData = null;
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const jsonData = JSON.parse(script.textContent);
            if (jsonData && (jsonData['@type'] === 'Product' || (jsonData.offers && jsonData.name))) {
              scriptData = jsonData;
              break;
            }
          } catch (e) {
            // Ignorar erros de parsing
          }
        }
      } catch (e) {
        // Ignorar erros ao processar scripts JSON
      }
      
      // Usar dados do script JSON se disponíveis
      if (scriptData) {
        if (!productTitle && scriptData.name) {
          productTitle = scriptData.name;
        }
        
        if (!currentPrice && scriptData.offers && scriptData.offers.price) {
          currentPrice = scriptData.offers.price.toString();
        }
        
        if (!productImage && scriptData.image) {
          productImage = Array.isArray(scriptData.image) ? scriptData.image[0] : scriptData.image;
        }
      }
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: 'Nike',
        platform: 'nike',
        realProductUrl: window.location.href
      };
    });
    
    // Log para depuração
    console.log("Dados extraídos da Nike:", JSON.stringify(productData, null, 2));
    
    // Pós-processamento para corrigir formatos de preço
    if (productData.currentPrice && productData.currentPrice.length > 10) {
      // Tentar extrair o primeiro número da string
      const priceMatch = productData.currentPrice.match(/(\d+,\d+)/);
      if (priceMatch && priceMatch[1]) {
        productData.currentPrice = priceMatch[1];
      }
    }
    
    // Se ainda não conseguimos o preço, usar um placeholder para teste
    if (!productData.currentPrice || productData.currentPrice === 'Preço não disponível') {
      // Com base no nome do produto, determinar um preço fictício razoável
      let placeholderPrice = "499";
      let placeholderOriginalPrice = "799";
      
      // Se o nome contém palavras-chave
      if (productData.name) {
        const name = productData.name.toLowerCase();
        if (name.includes('air max') || name.includes('jordan')) {
          placeholderPrice = "899";
          placeholderOriginalPrice = "1299";
        } else if (name.includes('camiseta') || name.includes('camisa')) {
          placeholderPrice = "199";
          placeholderOriginalPrice = "299";
        }
      }
      
      productData.currentPrice = placeholderPrice;
      productData.originalPrice = placeholderOriginalPrice;
      productData.isPlaceholder = true;
    }
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Nike:', error);
    console.error(error.stack);
    
    // Retornar dados fictícios em caso de erro para não quebrar a aplicação
    return {
      name: "Tênis Nike Performance (Placeholder)",
      currentPrice: "499",
      originalPrice: "799",
      imageUrl: "https://imgnike-a.akamaihd.net/1300x1300/024817IDA4.jpg",
      vendor: "Nike",
      platform: "nike",
      productUrl: url,
      isPlaceholder: true,
      error: error.message
    };
  } finally {
    await browser.close();
  }
};