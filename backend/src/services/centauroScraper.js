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
    // CORREÇÃO: Usar let em vez de const para poder reatribuir depois
    let page = await browser.newPage();
    
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
      // Função especial para detectar e extrair preços no formato "De X Por Y"
      const extractDeParPrices = () => {
        // Procurar elementos que contenham o texto "De R$" ou elementos com classe relacionada
        const deElements = document.querySelectorAll('[class*="preco-de"], [class*="price-old"], .stroke, .original-price');
        const porElements = document.querySelectorAll('[class*="preco-por"], [class*="price-new"], .destaque, .current-price');
        
        let dePrice = null;
        let porPrice = null;
        
        // Primeiro, tentar extrair "De R$" do elemento mais provável
        for (const el of deElements) {
          const text = el.textContent.trim();
          if (text.includes('R$')) {
            const matches = text.match(/R\$\s*(\d+[\.,]\d+)/);
            if (matches && matches[1]) {
              dePrice = matches[1].replace('.', ',');
              break;
            }
          }
        }
        
        // Depois, tentar extrair "Por R$" do elemento mais provável
        for (const el of porElements) {
          const text = el.textContent.trim();
          if (text.includes('R$')) {
            const matches = text.match(/R\$\s*(\d+[\.,]\d+)/);
            if (matches && matches[1]) {
              porPrice = matches[1].replace('.', ',');
              break;
            }
          }
        }
        
        // Tentar o formato mais explícito De/Por
        if (!dePrice || !porPrice) {
          const deParaRegex = /De\s*R\$\s*(\d+[\.,]\d+)[\s\S]*?(?:Por|por)\s*R\$\s*(\d+[\.,]\d+)/i;
          const bodyText = document.body.innerText;
          const deParaMatch = bodyText.match(deParaRegex);
          
          if (deParaMatch) {
            if (!dePrice) dePrice = deParaMatch[1].replace('.', ',');
            if (!porPrice) porPrice = deParaMatch[2].replace('.', ',');
          }
        }
        
        // Verificar no DOM por texto explícito com estrutura clara
        if (!dePrice || !porPrice) {
          // Buscar o elemento de preço principal
          const priceContainer = document.querySelector('.product-price, .price-box, [class*="price-container"]');
          if (priceContainer) {
            const html = priceContainer.innerHTML;
            // Verificar por textos explícitos "De" e "Por"
            const deMatch = html.match(/De\s*R\$\s*(\d+[\.,]\d+)/i);
            const porMatch = html.match(/Por\s*R\$\s*(\d+[\.,]\d+)/i);
            
            if (deMatch && !dePrice) dePrice = deMatch[1].replace('.', ',');
            if (porMatch && !porPrice) porPrice = porMatch[1].replace('.', ',');
          }
        }
        
        return { originalPrice: dePrice, currentPrice: porPrice };
      };

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
      
      // Função para extrair preço com R$
      const extractPriceWithRS = (text) => {
        if (!text) return null;
        const match = text.match(/R\$\s*(\d+[.,]\d+)/);
        return match ? match[1].replace('.', ',') : null;
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
      
      // Extrair preços no formato "De Por" específico da Centauro
      const dePorPrices = extractDeParPrices();
      let originalPrice = dePorPrices.originalPrice;
      let currentPrice = dePorPrices.currentPrice;
      
      if (dePorPrices.originalPrice && dePorPrices.currentPrice) {
        console.log("Preços extraídos no formato De/Por:", dePorPrices);
      }
      
      // Se ainda não tivermos preços, tentar métodos alternativos:
      
      // Verificação adicional específica para a Centauro para "De R$ X,XX" (sem o "Por")
      if (!originalPrice || !currentPrice) {
        const deElement = document.querySelector('.preco-de, .price-old, .original-price');
        if (deElement) {
          const deText = deElement.textContent.trim();
          const deMatch = deText.match(/R\$\s*(\d+[\.,]\d+)/);
          if (deMatch) {
            originalPrice = deMatch[1].replace('.', ',');
            
            // Se temos o preço original mas não o atual, buscar o atual especificamente
            if (!currentPrice) {
              const porElement = document.querySelector('.preco-por, .price-new, .current-price, .highlight, [class*="price-value"]');
              if (porElement) {
                const porText = porElement.textContent.trim();
                const porMatch = porText.match(/R\$\s*(\d+[\.,]\d+)/);
                if (porMatch) {
                  currentPrice = porMatch[1].replace('.', ',');
                }
              }
            }
          }
        }
      }
      
      // ADICIONAR: Prioridade para o preço "no Pix"
      // Buscar especificamente por texto que contenha "no Pix"
      const pixElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent.trim().toLowerCase().includes('no pix') && 
        el.textContent.includes('R$')
      );
      
      if (pixElements.length > 0) {
        for (const el of pixElements) {
          const pixText = el.textContent.trim();
          const pixMatch = pixText.match(/R\$\s*(\d+[\.,]\d+)/);
          if (pixMatch) {
            currentPrice = pixMatch[1].replace('.', ',');
            console.log("Preço no Pix extraído:", currentPrice);
            break;
          }
        }
      }
      
      // Preço atual - verificar múltiplos seletores possíveis (caso os métodos acima falhem)
      if (!currentPrice) {
        const priceSelectors = [
          '.preco-promocional',  // Seletor específico para o preço promocional
          '.valor-por',
          '.showcase-price .price', 
          '.preco-atual',
          '.price-best',
          '[id*="product-price"]',
          '.atual-preco',
          '.preco-atual strong',
          'span.valor',
          '.best-price',
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
          'span[class*="price"]',
          // Específicos Centauro
          'div.highlight .rs',
          'p.no-pix',
          '.prod-price-new',
          'div.product-price .Rs',
          '.normal-price .rs',
          'div[class*="price"] .rs',
          '.best-price-view',
          '.price-new .rs'
        ];
        
        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            currentPrice = cleanPrice(element.textContent);
            if (currentPrice) break;
          }
        }
      }
      
      // Preço original (riscado) - caso os métodos acima falhem
      if (!originalPrice) {
        const originalPriceSelectors = [
          '.preco-de',
          '.valor-de',
          '.preco-antigo',
          '.old-price',
          '.price-old',
          '.preco-list-item .valor',
          '.valor-de strike',
          'span.de',
          '.original-price del',
          '.list-price',
          '.price-box__old',
          '[data-testid*="list-price"]',
          '[class*="oldPrice"]',
          '[class*="original-price"]',
          '[class*="originalPrice"]',
          '[class*="listPrice"]',
          'span[class*="old"]',
          // Específicos Centauro
          'div.price.Rs',
          'p.de',
          '.product-price-old',
          '.product-price .old-price',
          '.strikeout-price',
          '.price-old span',
          '.stroke.rs',
          '.price-old .Rs',
          '.strikethrough-price'
        ];
        
        for (const selector of originalPriceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            originalPrice = cleanPrice(element.textContent);
            if (originalPrice) break;
          }
        }
      }
      
      // Se ainda não encontrou o preço atual, procurar no HTML da página
      if (!currentPrice) {
        const priceRegex = /R\$\s*(\d+[.,]\d+)/g;
        const matches = document.body.textContent.match(priceRegex);
        if (matches && matches.length > 0) {
          currentPrice = cleanPrice(matches[0]);
        }
      }
      
      // Verificar padrão "De R$ X por R$ Y" no texto da página
      if (!originalPrice || !currentPrice) {
        const deParaRegex = /de\s*r\$\s*(\d+[.,]\d+)(?:\s*por)?\s*r\$\s*(\d+[.,]\d+)/i;
        const bodyText = document.body.textContent;
        const deParaMatch = bodyText.match(deParaRegex);
        
        if (deParaMatch) {
          const de = deParaMatch[1].replace('.', ',');
          const por = deParaMatch[2].replace('.', ',');
          
          if (!originalPrice) originalPrice = de;
          if (!currentPrice) currentPrice = por;
        }
      }
      
      // Tentar extrair do elemento "De R$"
      const deElements = document.querySelectorAll('.de, .old-price, .price-old, .original-price, [class*="de"], [class*="original"]');
      for (const el of deElements) {
        const priceText = el.textContent.trim();
        const extracted = extractPriceWithRS(priceText);
        if (extracted && (!originalPrice || originalPrice === '')) {
          originalPrice = extracted;
          break;
        }
      }
      
      // Tentar extrair do elemento "Por R$"
      const porElements = document.querySelectorAll('.por, .new-price, .price-new, .current-price, [class*="por"], [class*="current"]');
      for (const el of porElements) {
        const priceText = el.textContent.trim();
        const extracted = extractPriceWithRS(priceText);
        if (extracted && (!currentPrice || currentPrice === '')) {
          currentPrice = extracted;
          break;
        }
      }
      
      // Elemento específico na Centauro "De/Por"
      try {
        // Procurar diretamente pelo elemento que contém "De R$"
        const deElement = Array.from(document.querySelectorAll('*')).find(el => 
          el.textContent.trim().match(/^De R\$/i)
        );
        
        if (deElement) {
          const deParentElement = deElement.parentElement;
          if (deParentElement) {
            const deText = deParentElement.textContent;
            const deMatch = deText.match(/De R\$\s*(\d+[.,]\d+)/i);
            if (deMatch && deMatch[1]) {
              originalPrice = deMatch[1].replace('.', ',');
            }
          }
        }
        
        // Procurar pelo elemento específico "R$ X,XX"
        // A Centauro normalmente usa este formato para o preço atual
        const rsElements = document.querySelectorAll('.rs, .Rs, [class*="price"] span, [class*="valor"] span');
        for (const el of rsElements) {
          const text = el.textContent.trim();
          if (text.match(/^R\$\s*\d+/)) {
            const extracted = extractPriceWithRS(text);
            if (extracted) {
              if (el.closest('.old-price, .price-old, .original-price')) {
                originalPrice = extracted;
              } else {
                currentPrice = extracted;
              }
            }
          }
        }
      } catch (e) {
        // Ignorar erros ao tentar métodos específicos
      }
      
      // No final da função, verificar se currentPrice contém valor parcelado
      // Se o currentPrice contém um formato como "10x de R$ 45,99", extrair apenas o valor total
      if (currentPrice && currentPrice.includes('x de')) {
        const totalMatch = currentPrice.match(/(\d+)x de R\$\s*(\d+[\.,]\d+)/i);
        if (totalMatch) {
          const parcelas = parseInt(totalMatch[1]);
          const valorParcela = parseFloat(totalMatch[2].replace(',', '.'));
          currentPrice = (parcelas * valorParcela).toFixed(2).replace('.', ',');
        }
      }
      
      // Verificar se o preço atual é menor que o original (como esperado)
      if (originalPrice && currentPrice) {
        const origValue = parseFloat(originalPrice.replace(',', '.'));
        const currValue = parseFloat(currentPrice.replace(',', '.'));
        
        if (origValue <= currValue) {
          // Inverter apenas se a diferença for substancial (> 5% para evitar erros de arredondamento)
          if (currValue > origValue * 1.05) {
            console.log("Invertendo preços porque preço atual > preço original");
            [originalPrice, currentPrice] = [currentPrice, originalPrice];
          }
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
      
      // Tentar extrair informações de um script JSON
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const jsonData = JSON.parse(script.textContent);
            if (jsonData && (jsonData['@type'] === 'Product' || (jsonData.offers && jsonData.name))) {
              // Usar dados do JSON se disponíveis
              if (!productTitle && jsonData.name) {
                productTitle = jsonData.name;
              }
              
              if (!currentPrice && jsonData.offers) {
                const price = typeof jsonData.offers === 'object' ? 
                  jsonData.offers.price : 
                  jsonData.offers[0]?.price;
                
                if (price) {
                  currentPrice = price.toString().replace('.', ',');
                }
              }
              
              if (!productImage && jsonData.image) {
                productImage = Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image;
              }
              
              break;
            }
          } catch (e) {
            // Ignorar erros de parsing
          }
        }
      } catch (e) {
        // Ignorar erros ao processar scripts JSON
      }
      
      // Checagem adicional para garantir que o preço original é maior que o atual
      if (originalPrice && currentPrice) {
        const origValue = parseFloat(originalPrice.replace(',', '.'));
        const currValue = parseFloat(currentPrice.replace(',', '.'));
        
        if (origValue <= currValue) {
          // Se o preço "original" for menor, temos um problema - inverter
          console.log("Inverting prices because original <= current");
          [originalPrice, currentPrice] = [currentPrice, originalPrice];
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
              parentEl.classList.toString().match(/old|original|de|stroke|strike|through/) ||
              parentEl.textContent.toLowerCase().includes('de r$')
            );
            
            priceTexts.push({
              text,
              price,
              isOriginal
            });
          }
        }
        
        // Verificar preços de/por
        const deParaMatches = document.body.textContent.match(/de\s*r\$\s*(\d+[.,]\d+)\s*por\s*r\$\s*(\d+[.,]\d+)/gi);
        let deParaPrices = [];
        
        if (deParaMatches) {
          deParaMatches.forEach(match => {
            const parts = match.match(/de\s*r\$\s*(\d+[.,]\d+)\s*por\s*r\$\s*(\d+[.,]\d+)/i);
            if (parts) {
              deParaPrices.push({
                original: parts[1].replace('.', ','),
                current: parts[2].replace('.', ',')
              });
            }
          });
        }
        
        return {priceTexts, deParaPrices};
      });
      
      console.log("Todos os preços encontrados:", allPricesData);
      
      // Usar de/por matches se disponíveis
      if (allPricesData.deParaPrices && allPricesData.deParaPrices.length > 0) {
        const firstDePara = allPricesData.deParaPrices[0];
        productData.originalPrice = firstDePara.original;
        productData.currentPrice = firstDePara.current;
        console.log("Usando preços de 'de/por' pattern:", firstDePara);
      } 
      // Caso contrário, usar os preços extraídos da página
      else if (allPricesData.priceTexts && allPricesData.priceTexts.length > 0) {
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
        
        // Verificar se o preço original é maior que o preço atual (como esperado)
        if (productData.originalPrice && productData.currentPrice) {
          const origValue = parseFloat(productData.originalPrice.replace(',', '.'));
          const currValue = parseFloat(productData.currentPrice.replace(',', '.'));
          
          if (origValue <= currValue) {
            // Se não for, provavelmente temos um problema. Tente inverter se tivermos mais de um preço.
            if (prices.length >= 2) {
              productData.originalPrice = prices[prices.length - 1].price;
              productData.currentPrice = prices[0].price;
            }
          }
        }
      }
    }
    
    // ADICIONAL: Verificar especificamente por preços com "no Pix"
    const pixData = await page.evaluate(() => {
      const pixElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent.trim().toLowerCase().includes('no pix') && 
        el.textContent.includes('R$')
      );
      
      if (pixElements.length > 0) {
        for (const el of pixElements) {
          const pixText = el.textContent.trim();
          const pixMatch = pixText.match(/R\$\s*(\d+[\.,]\d+)/);
          if (pixMatch) {
            return pixMatch[1].replace('.', ',');
          }
        }
      }
      return null;
    });
    
    if (pixData) {
      console.log("Preço no Pix encontrado:", pixData);
      productData.currentPrice = pixData;
    }
    
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