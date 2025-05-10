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
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
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

// Função para fazer requisição HTTP nativa
const makeHttpRequest = (url, headers) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers,
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error('Erro ao fazer parse da resposta JSON'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
};

// Função para fazer requisição para a API da Shopee
const fetchFromShopeeAPI = async (shopId, itemId, userAgent) => {
  try {
    console.log(`Tentando buscar dados via API: shopId=${shopId}, itemId=${itemId}`);
    
    const apiUrl = `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
    
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Referer': `https://shopee.com.br/product/${shopId}/${itemId}`,
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    const response = await makeHttpRequest(apiUrl, headers);
    
    if (response && response.data && response.data.item) {
      const item = response.data.item;
      const shop = response.data.shop || {};
      
      // Converter preços (Shopee usa preços em centavos)
      let currentPrice = '';
      let originalPrice = '';
      
      if (item.price_min && item.price_max) {
        // Se tem variação de preço, usar o mínimo
        const priceMin = item.price_min / 100000;
        const priceMax = item.price_max / 100000;
        currentPrice = priceMin === priceMax ? 
          priceMin.toFixed(2).replace('.', ',') : 
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
        isShop: shop.is_official_shop === true,
        platform: 'shopee',
        shopId: shopId,
        itemId: itemId
      };
    }
    
    console.log('Resposta da API não contém dados válidos');
    return null;
  } catch (error) {
    console.log('Erro ao buscar dados via API:', error.message);
    return null;
  }
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
      '--window-size=1366,768'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent aleatório
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    
    // Configurar headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
    } catch (error) {
      console.log('Timeout ou erro na navegação, mas continuando com dados capturados...');
    }
    
    // Aguardar um pouco mais para capturas de redirecionamento
    await wait(3000);
    
    // Se conseguimos capturar os IDs do produto, tentar buscar via API
    if (finalShopId && finalItemId) {
      console.log('Tentando buscar dados via API da Shopee...');
      const apiData = await fetchFromShopeeAPI(finalShopId, finalItemId, userAgent);
      
      if (apiData) {
        apiData.productUrl = url;
        apiData.realProductUrl = finalProductUrl;
        console.log('Dados obtidos com sucesso via API');
        return apiData;
      }
    }
    
    // Se não conseguimos via API, tentar buscar diretamente da página
    const currentUrl = page.url();
    console.log(`URL atual: ${currentUrl}`);
    
    // Se estamos numa página de produto válida, tentar extrair dados
    if (currentUrl.includes('/product/') && !currentUrl.includes('/login') && !currentUrl.includes('/error')) {
      console.log('Tentando extrair dados da página...');
      
      const productData = await page.evaluate(() => {
        const data = {
          name: '',
          currentPrice: '',
          originalPrice: '',
          imageUrl: '',
          vendor: 'Shopee'
        };
        
        // Tentar encontrar dados no JSON embutido
        try {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            if (script.textContent.includes('window.__INITIAL_STATE__')) {
              const match = script.textContent.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
              if (match) {
                const state = JSON.parse(match[1]);
                // Procurar dados do produto no state
                if (state.item && state.item.item) {
                  const item = state.item.item;
                  data.name = item.name;
                  if (item.price_min) {
                    data.currentPrice = (item.price_min / 100000).toFixed(2).replace('.', ',');
                  }
                  if (item.price_before_discount) {
                    data.originalPrice = (item.price_before_discount / 100000).toFixed(2).replace('.', ',');
                  }
                  if (item.images && item.images[0]) {
                    data.imageUrl = `https://down-br.img.susercontent.com/file/${item.images[0]}`;
                  }
                  if (state.shop && state.shop.name) {
                    data.vendor = state.shop.name;
                  }
                  return data;
                }
              }
            }
          }
        } catch (e) {
          console.log('Erro ao processar JSON:', e);
        }
        
        // Fallback: extrair do DOM
        const titleElement = document.querySelector('h1, .product-name, [class*="title"]');
        if (titleElement) {
          data.name = titleElement.textContent.trim();
        }
        
        return data;
      });
      
      if (productData && productData.name && productData.name !== '') {
        productData.productUrl = url;
        productData.realProductUrl = currentUrl;
        productData.platform = 'shopee';
        console.log('Dados extraídos da página:', productData);
        return productData;
      }
    }
    
    // Se tudo falhar, mostrar erro específico
    console.log('Falha ao obter dados do produto.');
    throw new Error('Produto não encontrado. A Shopee pode estar bloqueando o acesso ou o link de afiliado está incorreto.');
    
  } catch (error) {
    console.error('Erro ao fazer scraping na Shopee:', error);
    console.error(error.stack);
    
    // Em vez de retornar dados fictícios, retornar um erro mais informativo
    if (error.message.includes('Produto não encontrado')) {
      throw error;
    }
    
    throw new Error(`Falha ao extrair dados do produto da Shopee: ${error.message}`);
  } finally {
    await browser.close();
  }
};