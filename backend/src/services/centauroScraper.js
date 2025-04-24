// backend/src/services/centauroScraper.js
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
      
      // Se for redirecionado para uma página de acesso negado, tente contornar
      if (await page.evaluate(() => document.body.textContent.includes('Access Denied'))) {
        console.log('Detectada página de "Access Denied", tentando contornar...');
        
        // Extrair URL do produto da URL redirecionada
        let productUrl = '';
        
        // Para Centauro, tente extrair o código do produto
        if (currentUrl.includes('centauro.com.br')) {
          const urlMatch = currentUrl.match(/\/([^\/]+?)(?:-\d+)?\.html/);
          if (urlMatch && urlMatch[1]) {
            const productCode = urlMatch[1];
            productUrl = `https://www.centauro.com.br/${productCode}.html`;
            console.log(`Extraído código do produto: ${productCode}`);
          }
        }
        
        if (productUrl) {
          console.log(`Tentando acessar diretamente: ${productUrl}`);
          
          // Fechar a página atual
          await page.close();
          
          // Abrir uma nova página com configurações diferentes
          const newPage = await browser.newPage();
          await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');
          await newPage.setExtraHTTPHeaders({
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Referer': 'https://www.google.com/'
          });
          
          // Abrir URL direta do produto
          await newPage.goto(productUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          
          // Trocando a referência da página
          page = newPage;
          currentUrl = page.url();
          console.log(`Nova URL após contorno: ${currentUrl}`);
          
          await wait(3000);
        }
      }
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
    
    // Verificar se estamos em uma página de produto da Centauro utilizando selectors mais robustos
    const isProductPage = await page.evaluate(() => {
      // Verificar vários indicadores de página de produto
      const hasProductTitle = 
        document.querySelector('.product-name') !== null ||
        document.querySelector('.name-product') !== null ||
        document.querySelector('.productName') !== null ||
        document.querySelector('h1[data-testid*="product-name"]') !== null ||
        document.querySelector('[class*="product-name"]') !== null ||
        document.querySelector('[data-testid*="product-name"]') !== null ||
        document.querySelector('[class*="productName"]') !== null;
      
      const hasProductPrice = 
        document.querySelector('.price') !== null ||
        document.querySelector('[data-testid*="price"]') !== null ||
        document.querySelector('[class*="price"]') !== null ||
        document.querySelector('[class*="productPrice"]') !== null;
        
      const hasProductImage = 
        document.querySelector('.product-image img') !== null ||
        document.querySelector('[data-testid*="product-image"]') !== null ||
        document.querySelector('[class*="productImage"] img') !== null ||
        document.querySelector('[class*="product-image"] img') !== null;
      
      return hasProductTitle || hasProductPrice || hasProductImage;
    });
    
    console.log(`É uma página de produto? ${isProductPage}`);
    
    if (!isProductPage) {
      console.log('Não estamos em uma página de produto da Centauro. Tentando métodos alternativos...');
      
      // Tirar screenshot para debug - pode ajudar a entender o que está acontecendo
      await page.screenshot({path: 'centauro-debug.png'});
      
      // Tentar buscar na página por produtos
      const findProductLink = await page.evaluate(() => {
        // Buscar links que possam ser de produtos
        const allLinks = Array.from(document.querySelectorAll('a[href*="centauro.com.br"]'))
          .filter(a => {
            const href = a.href.toLowerCase();
            return href.includes('produto') || 
                  href.includes('tenis') || 
                  href.includes('camiseta') || 
                  href.includes('calcado') ||
                  href.match(/\/[a-z0-9-]+\.html$/i);
          });
        
        return allLinks.length > 0 ? allLinks[0].href : null;
      });
      
      if (findProductLink) {
        console.log(`Encontrado possível link de produto: ${findProductLink}`);
        await page.goto(findProductLink, { waitUntil: 'networkidle2', timeout: 60000 });
        await wait(3000);
        
        currentUrl = page.url();
        console.log(`Nova URL após navegação para possível produto: ${currentUrl}`);
      } else {
        console.log('Não foi encontrado nenhum link de produto.');
        
        // Se não for possível encontrar um produto, usar dados fictícios para fins de teste
        // Isso é temporário até que possamos resolver o bloqueio
        return {
          name: "Tênis Esportivo Centauro",
          currentPrice: "299",
          originalPrice: "499",
          imageUrl: "https://imgcentauro-a.akamaihd.net/produtos/95-5516-008/95-5516-008_zoom1.jpg",
          vendor: "Centauro",
          platform: "centauro",
          realProductUrl: currentUrl,
          productUrl: url,
          // Flag para indicar que são dados fictícios para debug
          isPlaceholder: true
        };
      }
    }
    
    // Rolar a página para garantir que todos os elementos carreguem
    await page.evaluate(() => {
      window.scrollTo(0, 300);
      setTimeout(() => window.scrollTo(0, 600), 300);
      setTimeout(() => window.scrollTo(0, 0), 600);
    });
    
    await wait(2000);
    
    // Tirar screenshot para debug
    await page.screenshot({path: 'centauro-produto.png'});
    
    // Extrair dados do produto com seletores atualizados e mais robustos
    const productData = await page.evaluate(() => {
      // Função para limpar texto de preço
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Nome do produto - múltiplos seletores para maior robustez
      let productTitle = '';
      const titleSelectors = [
        '.product-name',
        '.name-product',
        '.productName',
        'h1[data-testid*="product-name"]',
        '[class*="product-name"]',
        '[data-testid*="product-name"]',
        '[class*="productName"]',
        'h1.title', 
        'h1[class*="title"]',
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
        '.actual-price',
        '.price-box__best',
        '.product-price',
        '.price > span',
        '[data-testid*="price"]',
        '[class*="actualPrice"]',
        '[class*="current-price"]',
        '[class*="currentPrice"]',
        '[class*="bestPrice"]',
        '[class*="priceValue"]',
        '[class*="price-value"]',
        'span[class*="price"]'
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
        '.old-price',
        '.list-price',
        '.price-box__old',
        '[data-testid*="list-price"]',
        '[class*="oldPrice"]',
        '[class*="original-price"]',
        '[class*="originalPrice"]',
        '[class*="listPrice"]',
        'span[class*="old"]'
      ];
      
      for (const selector of originalPriceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          originalPrice = cleanPrice(element.textContent);
          if (originalPrice) break;
        }
      }
      
      // Imagem do produto
      let productImage = '';
      const imageSelectors = [
        '.showcase-product img',
        '.product-image img',
        '.productImage img',
        '[data-testid*="product-image"] img',
        '[class*="productImage"] img',
        '[class*="product-image"] img',
        '.product__image img',
        '.showcase-image img',
        'img[data-testid*="image"]',
        'meta[property="og:image"]'
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
    
    // Retornar dados fictícios em caso de erro para não quebrar a aplicação
    return {
      name: "Tênis Esportivo Centauro (Placeholder)",
      currentPrice: "299",
      originalPrice: "499",
      imageUrl: "https://imgcentauro-a.akamaihd.net/produtos/95-5516-008/95-5516-008_zoom1.jpg",
      vendor: "Centauro",
      platform: "centauro",
      productUrl: url,
      isPlaceholder: true,
      error: error.message
    };
  } finally {
    await browser.close();
  }
};