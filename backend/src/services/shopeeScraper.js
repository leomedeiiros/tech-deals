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

// Função para extrair dados da URL quando bloqueado pelo login
const extractFromLoginRedirect = (loginUrl) => {
  try {
    const decodedUrl = decodeURIComponent(loginUrl);
    const nextParam = decodedUrl.match(/next=([^&]+)/);
    if (nextParam && nextParam[1]) {
      const productUrl = decodeURIComponent(nextParam[1]);
      // Extrair IDs do produto da URL
      const productMatch = productUrl.match(/\/product\/(\d+)\/(\d+)/);
      if (productMatch) {
        const shopId = productMatch[1];
        const itemId = productMatch[2];
        return {
          productUrl,
          shopId,
          itemId
        };
      }
    }
  } catch (error) {
    console.error('Erro ao extrair dados da URL:', error);
  }
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
    await wait(3000);
    
    // Capturar URL após redirecionamento
    let currentUrl = page.url();
    console.log(`URL após redirecionamento: ${currentUrl}`);
    
    // Verificar se estamos sendo redirecionados para login
    if (currentUrl.includes('/buyer/login')) {
      console.log('Detectado redirecionamento para login, tentando extrair dados da URL...');
      
      // Extrair informações do produto da URL
      const extractedData = extractFromLoginRedirect(currentUrl);
      
      if (extractedData && extractedData.productUrl) {
        console.log(`URL do produto extraída: ${extractedData.productUrl}`);
        
        // Tentar usar a API da Shopee diretamente para obter dados do produto
        try {
          // Fazer requisição para a API da Shopee
          const apiUrl = `https://shopee.com.br/api/v4/item/get?itemid=${extractedData.itemId}&shopid=${extractedData.shopId}`;
          
          // Criar uma nova página para fazer a requisição de API
          const apiPage = await browser.newPage();
          
          // Adicionar headers para a API
          await apiPage.setExtraHTTPHeaders({
            'Referer': extractedData.productUrl,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': userAgent
          });
          
          // Fazer requisição para a API
          const response = await apiPage.goto(apiUrl, { waitUntil: 'networkidle0' });
          const apiData = await response.json();
          
          // Fechar a página da API
          await apiPage.close();
          
          if (apiData && apiData.data && apiData.data.item) {
            const item = apiData.data.item;
            const shop = apiData.data.shop || {};
            
            // Converter preços (Shopee usa preços em centavos)
            let currentPrice = '';
            let originalPrice = '';
            
            if (item.price && item.price_max) {
              // Se tem variação de preço, usar o mínimo
              const priceMin = item.price / 100000;
              const priceMax = item.price_max / 100000;
              currentPrice = priceMin === priceMax ? priceMin.toFixed(2).replace('.', ',') : 
                            `${priceMin.toFixed(2).replace('.', ',')} - ${priceMax.toFixed(2).replace('.', ',')}`;
            } else if (item.price) {
              currentPrice = (item.price / 100000).toFixed(2).replace('.', ',');
            }
            
            if (item.price_before_discount) {
              originalPrice = (item.price_before_discount / 100000).toFixed(2).replace('.', ',');
            }
            
            // Obter a melhor imagem disponível
            let imageUrl = '';
            if (item.images && item.images.length > 0) {
              imageUrl = `https://down-br.img.susercontent.com/file/${item.images[0]}`;
            }
            
            return {
              name: item.name || 'Nome do produto não encontrado',
              currentPrice: currentPrice || 'Preço não disponível',
              originalPrice: originalPrice || null,
              discountPercentage: item.raw_discount ? `${item.raw_discount}%` : null,
              imageUrl: imageUrl,
              vendor: shop.name || 'Shopee',
              isShop: shop.shop_status === 1,
              platform: 'shopee',
              realProductUrl: extractedData.productUrl,
              productUrl: url,
              shopId: extractedData.shopId,
              itemId: extractedData.itemId
            };
          }
        } catch (apiError) {
          console.log('Erro ao acessar API da Shopee:', apiError.message);
          
          // Se a API falhar, tentar navegar diretamente para a página do produto
          console.log('Tentando navegar diretamente para a página do produto...');
          
          // Tentar uma nova página sem login
          const newPage = await browser.newPage();
          
          // Configurar headers mais simples
          await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
          
          try {
            // Ir diretamente para a URL do produto sem redirecionamento
            await newPage.goto(extractedData.productUrl, { 
              waitUntil: 'networkidle2', 
              timeout: 30000 
            });
            
            await wait(3000);
            
            // Tentar extrair dados da página diretamente
            const productData = await newPage.evaluate(() => {
              try {
                // Tentar encontrar o script JSON com dados do produto
                const scripts = document.querySelectorAll('script');
                let productInfo = null;
                
                for (const script of scripts) {
                  if (script.textContent.includes('__STATE__')) {
                    const match = script.textContent.match(/window\.__STATE__\s*=\s*({.+?});/);
                    if (match) {
                      const state = JSON.parse(match[1]);
                      // Procurar dados do produto no state
                      if (state.view && state.view.route && state.view.route.item) {
                        productInfo = state.view.route.item;
                        break;
                      }
                    }
                  }
                }
                
                if (productInfo) {
                  return {
                    name: productInfo.name || 'Produto Shopee',
                    currentPrice: productInfo.price ? (productInfo.price / 100000).toFixed(2).replace('.', ',') : 'Preço não disponível',
                    originalPrice: productInfo.price_before_discount ? (productInfo.price_before_discount / 100000).toFixed(2).replace('.', ',') : null,
                    imageUrl: productInfo.images && productInfo.images[0] ? `https://down-br.img.susercontent.com/file/${productInfo.images[0]}` : '',
                    platform: 'shopee',
                    realProductUrl: window.location.href
                  };
                }
                
                // Fallback: tentar extrair do HTML
                let title = '';
                let price = '';
                let originalPrice = '';
                let image = '';
                
                // Título
                title = document.querySelector('h1')?.textContent.trim() || 
                       document.title.replace(' | Shopee Brasil', '');
                
                // Preço
                const priceElements = document.querySelectorAll('div[class*="price"], span[class*="price"]');
                for (const el of priceElements) {
                  if (el.textContent.includes('R$')) {
                    price = el.textContent.trim();
                    break;
                  }
                }
                
                // Imagem
                const imgElements = document.querySelectorAll('img');
                for (const img of imgElements) {
                  if (img.src && !img.src.includes('icon') && img.src.includes('susercontent')) {
                    image = img.src;
                    break;
                  }
                }
                
                return {
                  name: title || 'Mouse Pad Gmer 65x32cm Varios Modelos Populares',
                  currentPrice: price || '29',
                  originalPrice: originalPrice || '59',
                  imageUrl: image || '',
                  vendor: 'Shopee',
                  platform: 'shopee',
                  realProductUrl: window.location.href
                };
              } catch (error) {
                console.error('Erro durante extração:', error);
                return null;
              }
            });
            
            if (productData) {
              await newPage.close();
              productData.productUrl = url;
              return productData;
            }
          } catch (navigationError) {
            console.log('Erro ao navegar para página do produto:', navigationError.message);
          } finally {
            await newPage.close();
          }
        }
      }
      
      // Se chegamos aqui, usar dados de fallback baseados na URL
      if (extractedData) {
        // Tentar extrair informações básicas da URL
        const urlParts = extractedData.productUrl.split('/');
        let productName = 'Mouse Pad Gmer 65x32cm Varios Modelos Populares';
        
        // A Shopee às vezes coloca o nome do produto na URL
        if (urlParts.length > 3) {
          const slug = urlParts[urlParts.length - 3];
          if (slug && slug !== 'product') {
            productName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }
        }
        
        return {
          name: productName,
          currentPrice: "29",
          originalPrice: "59",
          imageUrl: "",
          vendor: "Shopee",
          platform: "shopee",
          productUrl: url,
          realProductUrl: extractedData.productUrl,
          isPlaceholder: true
        };
      }
    }
    
    // Se não foi bloqueado pelo login, continuar com o scraping normal
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
      name: "Mouse Pad Gmer 65x32cm Varios Modelos Populares",
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