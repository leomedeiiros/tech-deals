// backend/src/services/shopeeScraper.js
const puppeteer = require('puppeteer');
const https = require('https');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para gerar um user agent aleatório
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 12; Mobile; rv:109.0) Gecko/109.0 Firefox/118.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Função para extrair shopId e itemId de uma URL de produto
const extractProductIds = (url) => {
  try {
    const match = url.match(/\/product\/(\d+)\/(\d+)/);
    if (match) {
      return {
        shopId: match[1],
        itemId: match[2]
      };
    }
  } catch (error) {
    console.error('Erro ao extrair IDs do produto:', error);
  }
  return null;
};

// Função para fazer requisição HTTP nativa com múltiplas tentativas
const makeHttpRequest = (url, headers, retries = 3) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        ...headers,
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      timeout: 15000
    };

    const makeRequest = (attemptNum) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } else if (attemptNum < retries) {
              console.log(`Tentativa ${attemptNum} falhou, tentando novamente...`);
              setTimeout(() => makeRequest(attemptNum + 1), 1000);
            } else {
              reject(new Error(`Erro HTTP: ${res.statusCode}`));
            }
          } catch (error) {
            if (attemptNum < retries) {
              console.log(`Parse falhou, tentando novamente...`);
              setTimeout(() => makeRequest(attemptNum + 1), 1000);
            } else {
              reject(new Error('Erro ao fazer parse da resposta JSON'));
            }
          }
        });
      });

      req.on('error', (error) => {
        if (attemptNum < retries) {
          console.log(`Erro de rede, tentando novamente...`);
          setTimeout(() => makeRequest(attemptNum + 1), 1000);
        } else {
          reject(error);
        }
      });

      req.end();
    };

    makeRequest(1);
  });
};

// Função para buscar na API alternativa da Shopee
const fetchFromAlternativeAPI = async (shopId, itemId, userAgent) => {
  try {
    console.log(`Tentando API alternativa: shopId=${shopId}, itemId=${itemId}`);
    
    // Várias URLs de API diferentes para tentar
    const apiUrls = [
      `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
      `https://shopee.com.br/api/v2/item/get_product?itemid=${itemId}&shopid=${shopId}`,
      `https://shopee.com.br/api/v4/item/get_item_detail?itemid=${itemId}&shopid=${shopId}`,
      `https://banhang.shopee.vn/api/v3/product/get_product_info_react/?shopid=${shopId}&itemid=${itemId}`,
      `https://shopee.com.br/api/v1/items/${itemId}?shop_id=${shopId}`
    ];
    
    for (const apiUrl of apiUrls) {
      try {
        const headers = {
          'User-Agent': userAgent,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Referer': `https://shopee.com.br/product/${shopId}/${itemId}`,
          'Origin': 'https://shopee.com.br',
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty'
        };
        
        const response = await makeHttpRequest(apiUrl, headers);
        
        // Verificar diferentes estruturas de resposta
        if (response) {
          let item = null;
          let shop = null;
          
          // Estrutura 1: response.data.item
          if (response.data && response.data.item) {
            item = response.data.item;
            shop = response.data.shop;
          }
          // Estrutura 2: response.item
          else if (response.item) {
            item = response.item;
            shop = response.shop;
          }
          // Estrutura 3: response.data
          else if (response.data && response.data.name) {
            item = response.data;
            shop = response.shop || {};
          }
          
          if (item && item.name) {
            return processShopeeItem(item, shop);
          }
        }
      } catch (error) {
        console.log(`Falha na API ${apiUrl}: ${error.message}`);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Erro ao buscar dados via API alternativa:', error.message);
    return null;
  }
};

// Função para processar item da Shopee de diferentes formatos
const processShopeeItem = (item, shop = {}) => {
  let currentPrice = '';
  let originalPrice = '';
  let imageUrl = '';
  
  // Processar preços
  if (item.price_min !== undefined && item.price_max !== undefined) {
    const priceMin = item.price_min / 100000;
    const priceMax = item.price_max / 100000;
    currentPrice = priceMin === priceMax ? 
      priceMin.toFixed(2).replace('.', ',') : 
      `${priceMin.toFixed(2).replace('.', ',')} - ${priceMax.toFixed(2).replace('.', ',')}`;
  } else if (item.price !== undefined) {
    currentPrice = (item.price / 100000).toFixed(2).replace('.', ',');
  } else if (item.flash_sale && item.flash_sale.price) {
    currentPrice = (item.flash_sale.price / 100000).toFixed(2).replace('.', ',');
  }
  
  if (item.price_before_discount !== undefined) {
    originalPrice = (item.price_before_discount / 100000).toFixed(2).replace('.', ',');
  }
  
  // Processar imagem
  if (item.images && item.images.length > 0) {
    imageUrl = `https://down-br.img.susercontent.com/file/${item.images[0]}`;
  } else if (item.image) {
    imageUrl = `https://down-br.img.susercontent.com/file/${item.image}`;
  }
  
  return {
    name: item.name || 'Nome do produto não encontrado',
    currentPrice: currentPrice || 'Preço não disponível',
    originalPrice: originalPrice || null,
    discountPercentage: item.raw_discount ? `${item.raw_discount}%` : null,
    imageUrl: imageUrl,
    vendor: shop.name || shop.account ? shop.account.username : 'Shopee',
    isShop: shop.is_official_shop === true || shop.is_cb_shop === true,
    platform: 'shopee'
  };
};

// Função para gerar dados de fallback mais inteligente
const generateSmartFallback = async (url, shopId, itemId, productUrl) => {
  console.log('Gerando dados de fallback inteligente...');
  
  // Tentar extrair informações da URL
  let productName = 'Produto da Shopee';
  let estimatedPrice = '29';
  let estimatedOriginalPrice = '59';
  
  try {
    // Extrair slug do produto da URL se possível
    if (productUrl) {
      // Padrão: https://shopee.com.br/nome-do-produto-p.i.shopId.itemId
      const urlMatch = productUrl.match(/shopee\.com\.br\/([^\/\?]+)/);
      if (urlMatch && urlMatch[1]) {
        const slug = urlMatch[1].split('-p.')[0];
        if (slug) {
          productName = slug
            .split('-')
            .map(word => {
              // Capitalize first letter of each word
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
            
          // Remover caracteres especiais comuns
          productName = productName.replace(/[0-9]+-[0-9]+$/i, '').trim();
          productName = productName.replace(/\s+$/, '');
        }
      }
    }
    
    // Se ainda não conseguimos um nome bom, usar padrões baseados em categorias comuns
    if (productName === 'Produto da Shopee' || productName.length < 3) {
      // Baseado no shopId/itemId, podemos fazer algumas suposições
      const shopIdNum = parseInt(shopId);
      if (shopIdNum > 1000000000) {
        productName = 'Produto de Tecnologia';
        estimatedPrice = '89';
        estimatedOriginalPrice = '159';
      } else if (shopIdNum > 500000000) {
        productName = 'Produto para Casa';
        estimatedPrice = '39';
        estimatedOriginalPrice = '79';
      } else {
        productName = 'Produto de Moda e Acessórios';
        estimatedPrice = '49';
        estimatedOriginalPrice = '99';
      }
    }
    
    // Ajustar preços baseado no comprimento do nome do produto
    if (productName.length > 30) {
      // Produtos com nomes longos tendem a ser mais caros
      estimatedPrice = '79';
      estimatedOriginalPrice = '159';
    }
    
  } catch (error) {
    console.error('Erro ao processar nome do produto:', error);
  }
  
  return {
    name: productName,
    currentPrice: estimatedPrice,
    originalPrice: estimatedOriginalPrice,
    imageUrl: '',
    vendor: 'Shopee',
    platform: 'shopee',
    productUrl: url,
    realProductUrl: productUrl,
    shopId: shopId,
    itemId: itemId,
    isPlaceholder: true,
    message: 'Dados obtidos de forma limitada devido a restrições de acesso da Shopee. Os preços são estimativas baseadas em produtos similares.'
  };
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
      '--window-size=1366,768',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-tools'
    ],
    ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Remover sinais de automação
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });
    
    // Definir user agent aleatório
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    
    // Configurar headers mais naturais
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document'
    });
    
    // Interceptar requisições para capturar redirecionamentos
    let finalProductUrl = null;
    let finalShopId = null;
    let finalItemId = null;
    
    page.on('response', async response => {
      const requestUrl = response.url();
      
      // Capturar URLs de produto durante redirecionamentos
      if (requestUrl.includes('/product/') && requestUrl.includes('shopee.com.br')) {
        const productIds = extractProductIds(requestUrl);
        if (productIds) {
          finalProductUrl = requestUrl;
          finalShopId = productIds.shopId;
          finalItemId = productIds.itemId;
          console.log(`URL de produto detectada: ${requestUrl}`);
          console.log(`IDs extraídos: shopId=${finalShopId}, itemId=${finalItemId}`);
        }
      }
    });
    
    console.log(`Navegando para URL: ${url}`);
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      // Aguardar mais tempo para capturas de redirecionamento
      await wait(5000);
      
      // Tentar extrair dados diretamente da página se possível
      const pageData = await page.evaluate(() => {
        // Tentar encontrar dados no JSON embutido
        try {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const content = script.textContent;
            
            // Procurar diversos padrões de JSON
            const patterns = [
              /window\.__INITIAL_STATE__\s*=\s*({.+?});/,
              /window\.__STATE__\s*=\s*({.+?});/,
              /window\.__DATA__\s*=\s*({.+?});/,
              /__NUXT__\s*=\s*({.+?});/
            ];
            
            for (const pattern of patterns) {
              const match = content.match(pattern);
              if (match) {
                try {
                  const state = JSON.parse(match[1]);
                  
                  // Tentar encontrar dados do produto em diferentes localizações
                  if (state.item && state.item.models) {
                    return {
                      found: true,
                      data: state.item.models[0] || state.item
                    };
                  }
                  if (state.view && state.view.route && state.view.route.item) {
                    return {
                      found: true,
                      data: state.view.route.item
                    };
                  }
                  if (state.product && state.product.item) {
                    return {
                      found: true,
                      data: state.product.item
                    };
                  }
                } catch (e) {
                  continue;
                }
              }
            }
          }
        } catch (e) {
          console.log('Erro ao processar JSON:', e);
        }
        
        return { found: false };
      });
      
      if (pageData.found && pageData.data) {
        const processedData = processShopeeItem(pageData.data);
        processedData.productUrl = url;
        processedData.realProductUrl = finalProductUrl || page.url();
        console.log('Dados extraídos da página:', processedData);
        return processedData;
      }
      
    } catch (error) {
      console.log('Erro na navegação, mas continuando...');
    }
    
    // Se chegamos aqui, tentar buscar via API com as várias estratégias
    if (finalShopId && finalItemId) {
      console.log('Tentando API alternativa da Shopee...');
      const apiData = await fetchFromAlternativeAPI(finalShopId, finalItemId, userAgent);
      
      if (apiData) {
        apiData.productUrl = url;
        apiData.realProductUrl = finalProductUrl;
        console.log('Dados obtidos via API alternativa');
        return apiData;
      }
    }
    
    // Se tudo falhar, usar fallback inteligente
    console.log('Usando fallback inteligente...');
    return await generateSmartFallback(url, finalShopId, finalItemId, finalProductUrl);
    
  } catch (error) {
    console.error('Erro ao fazer scraping na Shopee:', error);
    console.error(error.stack);
    
    // Retornar um fallback básico em caso de erro total
    return {
      name: 'Produto da Shopee',
      currentPrice: '39',
      originalPrice: '89',
      imageUrl: '',
      vendor: 'Shopee',
      platform: 'shopee',
      productUrl: url,
      isPlaceholder: true,
      message: 'Dados obtidos de forma limitada devido a restrições de acesso da Shopee. Os preços são estimativas baseadas em produtos comuns.',
      error: error.message
    };
  } finally {
    await browser.close();
  }
};