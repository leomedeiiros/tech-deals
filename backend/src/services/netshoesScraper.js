// backend/src/services/netshoesScraper.js
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
    
    // Verificar se estamos em uma página de afiliado da Rakuten (tiny.cc)
    if (url.includes('tiny.cc') || url.includes('rakuten')) {
      console.log('Detectado link de afiliado Rakuten, aguardando redirecionamentos...');
      
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
    
    // Extrair código do produto da URL
    let productCode = '';
    if (currentUrl.includes('netshoes.com.br')) {
      const productCodeMatch = currentUrl.match(/([A-Z0-9]{3}-\d+-\d+)/i);
      if (productCodeMatch && productCodeMatch[1]) {
        productCode = productCodeMatch[1];
        console.log(`Código do produto extraído: ${productCode}`);
      }
    }
    
    // Rolar a página para carregar todo o conteúdo
    await page.evaluate(() => {
      window.scrollTo(0, 300);
      setTimeout(() => window.scrollTo(0, 600), 300);
      setTimeout(() => window.scrollTo(0, 0), 600);
    });
    
    await wait(2000);
    
    // Tirar screenshot para debug
    await page.screenshot({path: 'netshoes-produto.png'});
    
    // Extrair dados do produto com foco no formato "De X Por Y" da Netshoes
    const productData = await page.evaluate(() => {
      // Função especial para extrair preços no formato "De X Por Y" da Netshoes
      const extractNetshoesDeParPrices = () => {
        // Procurar elementos específicos da Netshoes para preços
        const deElement = document.querySelector('.list-price, .price-box__list, .valor-de, [class*="original-price"]');
        const porElement = document.querySelector('.default-price, .price-box__best, .valor-por, [class*="best-price"]');
        
        let dePrice = null;
        let porPrice = null;
        
        // Extrair preço original
        if (deElement) {
          const deText = deElement.textContent.trim();
          const deMatch = deText.match(/R\$\s*(\d+[\.,]\d+)/);
          if (deMatch) {
            dePrice = deMatch[1].replace('.', ',');
          }
        }
        
        // Extrair preço atual/promocional
        if (porElement) {
          const porText = porElement.textContent.trim();
          const porMatch = porText.match(/R\$\s*(\d+[\.,]\d+)/);
          if (porMatch) {
            porPrice = porMatch[1].replace('.', ',');
          }
        }
        
        // Tentar extrair usando o formato explícito "De R$ X Por R$ Y"
        if (!dePrice || !porPrice) {
          const deParaRegex = /De\s*R\$\s*(\d+[\.,]\d+)[\s\S]*?Por\s*R\$\s*(\d+[\.,]\d+)/i;
          const bodyText = document.body.innerText;
          const deParaMatch = bodyText.match(deParaRegex);
          
          if (deParaMatch) {
            if (!dePrice) dePrice = deParaMatch[1].replace('.', ',');
            if (!porPrice) porPrice = deParaMatch[2].replace('.', ',');
          }
        }
        
        // Procurar por formato alternativo no HTML
        if (!dePrice || !porPrice) {
          // Buscar o container principal de preços na Netshoes
          const priceContainer = document.querySelector('.product-price-box, .product-price, [class*="price-container"]');
          if (priceContainer) {
            const html = priceContainer.innerHTML;
            // Extrair preços do HTML
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
        '.short-description',
        '.product-name',
        '.product__name',
        'h1[data-testid*="product-name"]',
        'h1[class*="name"]',
        'h1[class*="title"]',
        '.info-product h1',
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
      
      // NOVA IMPLEMENTAÇÃO: Extrair preços no formato De/Por da Netshoes
      const dePorPrices = extractNetshoesDeParPrices();
      let originalPrice = dePorPrices.originalPrice;
      let currentPrice = dePorPrices.currentPrice;
      
      if (dePorPrices.originalPrice && dePorPrices.currentPrice) {
        console.log("Preços extraídos no formato De/Por:", dePorPrices);
      }
      
      // Se não encontramos os preços com o método especializado, tentar métodos alternativos
      
      // Preço atual - verificar múltiplos seletores possíveis
      if (!currentPrice) {
        const priceSelectors = [
          '.default-price',
          '.price__value',
          '.product-price .price-box .regular-price .price',
          '.product-price-box .product-price__best',
          '.price-final',
          '.product-price .value',
          '.product-price strong',
          '[data-testid*="price"]',
          '[class*="currentPrice"]',
          '[class*="finalPrice"]',
          '[class*="bestPrice"]',
          '.price .sale strong',
          'span[class*="price"]',
          'div[class*="price"]',
          // Específicos Netshoes
          '.product-price__best',
          '.product-price__value',
          '.price-box__best',
          '.valor-por',
          '.actual-price',
          '.price-box__price'
        ];
        
        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            currentPrice = cleanPrice(element.textContent);
            if (currentPrice) break;
          }
        }
      }
      
      // Se ainda não encontrou o preço, procurar no HTML da página
      if (!currentPrice) {
        const priceRegex = /R\$\s*(\d+[.,]\d+)/g;
        const matches = document.body.textContent.match(priceRegex);
        if (matches && matches.length > 0) {
          currentPrice = cleanPrice(matches[0]);
        }
      }
      
      // Preço original (riscado) - se não encontrado no método De/Por
      if (!originalPrice) {
        const originalPriceSelectors = [
          '.old-price',
          '.price__old',
          '.product-price .price-box .old-price .price',
          '.product-price-box .product-price__old',
          '.regular-price .strike',
          '[data-testid*="original-price"]',
          '[class*="oldPrice"]',
          '[class*="listPrice"]',
          '.price .regular',
          'span[class*="list-price"]',
          'span[class*="old"]',
          // Específicos Netshoes
          '.price-box__list',
          '.list-price',
          '.valor-de',
          '.original-price',
          '.list-price span'
        ];
        
        for (const selector of originalPriceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            originalPrice = cleanPrice(element.textContent);
            if (originalPrice) break;
          }
        }
      }
      
      // Verificação especial para preço e desconto na Netshoes
      try {
        const priceContainer = document.querySelector('div[class*="price-container"]');
        if (priceContainer) {
          // Procurar o elemento de desconto (off, desconto, etc.)
          const offElement = priceContainer.querySelector('[class*="off"]');
          if (offElement) {
            const offText = offElement.textContent.trim();
            const percentMatch = offText.match(/(\d+)%/);
            
            if (percentMatch && currentPrice) {
              // Se temos porcentagem de desconto e preço atual, podemos calcular o original
              const percent = parseInt(percentMatch[1], 10);
              const currValue = parseFloat(currentPrice.replace(',', '.'));
              
              if (!isNaN(percent) && !isNaN(currValue) && percent > 0) {
                // Fórmula: preço_original = preço_atual / (1 - desconto_percentual/100)
                const origValue = currValue / (1 - percent/100);
                originalPrice = origValue.toFixed(2).replace('.', ',');
              }
            }
          }
        }
      } catch (e) {
        // Ignorar erros ao tentar método específico
      }
      
      // Verificar se há o texto "De R$ X Por R$ Y" na página
      const deParaRegex = /de\s*r\$\s*(\d+[.,]\d+)(?:\s*por)?\s*r\$\s*(\d+[.,]\d+)/i;
      const bodyText = document.body.textContent;
      const deParaMatch = bodyText.match(deParaRegex);
      
      if (deParaMatch) {
        const de = deParaMatch[1].replace('.', ',');
        const por = deParaMatch[2].replace('.', ',');
        
        if (!originalPrice) originalPrice = de;
        if (!currentPrice) currentPrice = por;
      }
      
      // Buscar elementos específicos com "De" e "Por"
      const deElement = document.querySelector('.price__old, .list-price, span[class*="old"], [class*="list-price"]');
      if (deElement && !originalPrice) {
        const deText = deElement.textContent.trim();
        const extracted = extractPriceWithRS(deText);
        if (extracted) {
          originalPrice = extracted;
        }
      }
      
      const porElement = document.querySelector('.price__best, .default-price, span[class*="best"], [class*="price-best"]');
      if (porElement && !currentPrice) {
        const porText = porElement.textContent.trim();
        const extracted = extractPriceWithRS(porText);
        if (extracted) {
          currentPrice = extracted;
        }
      }
      
      // Verificar se o header de preço existe (preço principal na Netshoes)
      const priceHeader = document.querySelector('.product-price');
      if (priceHeader) {
        // Procurar diretamente no HTML do elemento
        const html = priceHeader.innerHTML;
        const oldPriceMatch = html.match(/de\s*r\$\s*(\d+[.,]\d+)/i);
        const newPriceMatch = html.match(/por\s*r\$\s*(\d+[.,]\d+)/i);
        
        if (oldPriceMatch && oldPriceMatch[1]) {
          originalPrice = oldPriceMatch[1].replace('.', ',');
        }
        
        if (newPriceMatch && newPriceMatch[1]) {
          currentPrice = newPriceMatch[1].replace('.', ',');
        }
      }
      
      // Verificar se o preço atual contém informações de parcelamento e limpar
      if (currentPrice && currentPrice.includes('x de')) {
        const match = currentPrice.match(/(\d+)[xX]\s*de\s*R\$\s*(\d+[.,]\d+)/i);
        if (match) {
          // Ignorar o parcelamento, ficar apenas com o valor da parcela
          currentPrice = match[2].replace('.', ',');
        }
      }
      
      // Imagem do produto
      let productImage = '';
      const imageSelectors = [
        '.photo-figure img',
        '.showcase-product img',
        '.product__image img',
        '.photo .zoom img',
        'meta[property="og:image"]',
        'div[class*="productImage"] img',
        'img[data-testid*="main-image"]',
        'img[class*="mainImage"]',
        'img[id*="product-image"]'
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
        imageUrl: productImage || '',
        vendor: 'Netshoes',
        platform: 'netshoes',
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
              parentEl.classList.toString().match(/old|original|de|list|strike|through|before/) ||
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
        
        // Verificar elementos específicos da Netshoes
        let netshoesSpecific = {};
        
        try {
          const priceBox = document.querySelector('.default-price, .price__value, .product-price__value');
          const oldPriceBox = document.querySelector('.list-price, .price__old, .product-price__old');
          
          if (priceBox) {
            netshoesSpecific.currentPrice = extractPrice(priceBox.textContent);
          }
          
          if (oldPriceBox) {
            netshoesSpecific.originalPrice = extractPrice(oldPriceBox.textContent);
          }
          
          // Verificar se há elemento de desconto
          const discountElement = document.querySelector('span[class*="-off"], [class*="discount"]');
          if (discountElement) {
            const discountText = discountElement.textContent;
            const percentMatch = discountText.match(/(\d+)%/);
            if (percentMatch) {
              netshoesSpecific.discountPercent = parseInt(percentMatch[1]);
            }
          }
        } catch (e) {
          // Ignorar erros
        }
        
        return {priceTexts, deParaPrices, netshoesSpecific};
      });
      
      console.log("Todos os preços encontrados:", allPricesData);
      
      // Usar de/por matches se disponíveis
      if (allPricesData.deParaPrices && allPricesData.deParaPrices.length > 0) {
        const firstDePara = allPricesData.deParaPrices[0];
        productData.originalPrice = firstDePara.original;
        productData.currentPrice = firstDePara.current;
        console.log("Usando preços de 'de/por' pattern:", firstDePara);
      } 
      // Verificar dados específicos Netshoes
      else if (allPricesData.netshoesSpecific && 
               allPricesData.netshoesSpecific.currentPrice && 
               allPricesData.netshoesSpecific.originalPrice) {
        productData.currentPrice = allPricesData.netshoesSpecific.currentPrice;
        productData.originalPrice = allPricesData.netshoesSpecific.originalPrice;
        console.log("Usando preços dos elementos específicos Netshoes");
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
      
      // Se temos desconto percentual específico da Netshoes e preço atual, mas não original
      if (allPricesData.netshoesSpecific && 
          allPricesData.netshoesSpecific.discountPercent && 
          allPricesData.netshoesSpecific.discountPercent > 0 &&
          productData.currentPrice && 
          (!productData.originalPrice || productData.originalPrice === 'null')) {
        
        const percent = allPricesData.netshoesSpecific.discountPercent;
        const currValue = parseFloat(productData.currentPrice.replace(',', '.'));
        
        if (!isNaN(currValue)) {
          const origValue = currValue / (1 - percent/100);
          productData.originalPrice = origValue.toFixed(2).replace('.', ',');
          console.log(`Calculou preço original ${productData.originalPrice} a partir do desconto ${percent}%`);
        }
      }
    }
    
    // Corrigir URL da imagem se necessário
    if (productData.imageUrl && productData.imageUrl.startsWith('https://static.netshoes.com.brhttps://')) {
      productData.imageUrl = productData.imageUrl.replace('https://static.netshoes.com.brhttps://', 'https://');
    }
    
    // Log para depuração
    console.log("Dados extraídos da Netshoes:", JSON.stringify(productData, null, 2));
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Netshoes:', error);
    console.error(error.stack);
    
    // Retornar dados fictícios em caso de erro para não quebrar a aplicação
    return {
      name: "Tênis Esportivo Netshoes (Placeholder)",
      currentPrice: "349",
      originalPrice: "599",
      imageUrl: "https://static.netshoes.com.br/produtos/tenis-adidas-runfalcon-3-masculino/28/FB9-0006-128/FB9-0006-128_zoom1.jpg",
      vendor: "Netshoes",
      platform: "netshoes",
      productUrl: url,
      isPlaceholder: true,
      error: error.message
    };
  } finally {
    await browser.close();
  }
};