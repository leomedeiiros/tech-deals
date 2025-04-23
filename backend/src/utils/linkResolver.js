// backend/src/utils/linkResolver.js
const puppeteer = require('puppeteer');
const axios = require('axios');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para expandir URLs encurtadas
async function expandShortUrl(shortUrl) {
  console.log(`Tentando expandir URL encurtada: ${shortUrl}`);
  
  // Verifica se é um link da Awin, Rakuten ou outros encurtadores conhecidos
  const isShortLink = 
    shortUrl.includes('tidd.ly') || 
    shortUrl.includes('tiny.cc') || 
    shortUrl.includes('bit.ly') ||
    shortUrl.includes('tinyurl.com') ||
    shortUrl.includes('awin1.com') ||
    shortUrl.includes('rakuten.co') ||
    shortUrl.includes('prf.hn');
  
  if (!isShortLink) {
    return shortUrl; // Não é um link encurtado conhecido
  }
  
  try {
    // Fazer uma requisição HEAD para obter o destino
    const response = await axios.head(shortUrl, {
      maxRedirects: 10,
      validateStatus: status => status >= 200 && status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      }
    });
    
    // Se a URL final é diferente da original, significa que houve redirecionamento
    const finalUrl = response.request.res.responseUrl || shortUrl;
    
    if (finalUrl !== shortUrl) {
      console.log(`URL encurtada expandida para: ${finalUrl}`);
      return finalUrl;
    }
    
    // Se não conseguiu expandir com axios, tenta com puppeteer
    return null;
  } catch (error) {
    console.log(`Erro ao expandir URL com axios: ${error.message}`);
    return null; // Continuar com puppeteer
  }
}

exports.resolveUrl = async (url) => {
  const TIMEOUT_MS = 20000; // 20 segundos para timeout
  
  // Primeiro tenta expandir com método simples
  const expandedUrl = await expandShortUrl(url);
  if (expandedUrl && expandedUrl !== url) {
    return expandedUrl;
  }
  
  // Verifica as plataformas suportadas diretas (sem precisar resolver)
  const directSupportedPlatforms = [
    'mercadolivre.com/sec/',
    'mercadolibre.com/sec/',
    'netshoes.com.br',
    'nike.com.br', 
    'centauro.com.br',
    'magazineluiza.com.br',
    'amazon.com.br',
    'amazon.com'
  ];
  
  // Para links diretos das plataformas suportadas, não precisamos resolver
  if (directSupportedPlatforms.some(platform => url.includes(platform))) {
    console.log(`Link direto de plataforma suportada detectado: ${url}`);
    return url;
  }
  
  // Para links encurtados ou de afiliados, precisamos resolver com puppeteer
  console.log(`Iniciando puppeteer para resolver URL: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Configurar timeout para navegação
    page.setDefaultNavigationTimeout(TIMEOUT_MS);
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Desativar cache para garantir dados atualizados
    await page.setCacheEnabled(false);
    
    // Capturar todos os redirecionamentos
    let allRedirects = [];
    page.on('response', response => {
      const status = response.status();
      if (status >= 300 && status <= 399) {
        const location = response.headers()['location'];
        if (location) {
          allRedirects.push(location);
          console.log(`Redirecionamento detectado: ${location}`);
        }
      }
    });
    
    // Interceptar requisições para acelerar a navegação
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Abortar requisições de recursos não essenciais
      if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log(`Navegando para URL: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT_MS
    });
    
    // Aguardar um momento para garantir que a página carregou
    await wait(2000);
    
    // Obter a URL atual
    const currentUrl = page.url();
    console.log(`URL após navegação: ${currentUrl}`);
    
    // Capturar a URL destino de redirecionamentos AWIN (comum em links de afiliados)
    const awaitRedirectUrl = await page.evaluate(() => {
      // Buscar URL em meta refresh (usado em algumas páginas de redirecionamento)
      const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
      if (metaRefresh) {
        const content = metaRefresh.getAttribute('content');
        const match = content.match(/URL=(['"]?)([^'"]+)\1/i);
        if (match && match[2]) {
          return match[2];
        }
      }
      
      // Buscar URL em script de redirecionamento
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent;
        if (text.includes('window.location') || text.includes('location.href')) {
          const urlMatch = text.match(/(?:window\.location|location\.href)\s*=\s*['"]([^'"]+)['"]/);
          if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
          }
        }
      }
      
      // Buscar links específicos em páginas de afiliados
      const affiliateLink = document.querySelector('a[href*="netshoes"], a[href*="centauro"], a[href*="nike"]');
      if (affiliateLink) {
        return affiliateLink.href;
      }
      
      return null;
    });
    
    if (awaitRedirectUrl) {
      console.log(`URL de redirecionamento encontrada no HTML: ${awaitRedirectUrl}`);
      // Verificar se é uma URL relativa
      if (awaitRedirectUrl.startsWith('/')) {
        const parsedUrl = new URL(currentUrl);
        const baseUrl = parsedUrl.origin;
        return baseUrl + awaitRedirectUrl;
      }
      return awaitRedirectUrl;
    }
    
    // Identificar plataforma específica
    let resolvedUrl = currentUrl;
    
    // Centauro: Extrair URL do produto direto
    if (currentUrl.includes('centauro.com.br')) {
      const centauroProductUrl = await page.evaluate(() => {
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical && canonical.href) {
          return canonical.href;
        }
        // Outra tentativa para Centauro
        const productMetas = document.querySelector('meta[property="og:url"]');
        if (productMetas && productMetas.content) {
          return productMetas.content;
        }
        return null;
      });
      
      if (centauroProductUrl) {
        resolvedUrl = centauroProductUrl;
        console.log(`URL do produto Centauro encontrada: ${resolvedUrl}`);
      }
    }
    
    // Nike: Extrair URL do produto
    else if (currentUrl.includes('nike.com.br')) {
      const nikeProductUrl = await page.evaluate(() => {
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical && canonical.href) {
          return canonical.href;
        }
        // Outra tentativa para Nike
        const productMetas = document.querySelector('meta[property="og:url"]');
        if (productMetas && productMetas.content) {
          return productMetas.content;
        }
        return window.location.href;
      });
      
      if (nikeProductUrl) {
        resolvedUrl = nikeProductUrl;
        console.log(`URL do produto Nike encontrada: ${resolvedUrl}`);
      }
    }
    
    // Netshoes: Extrair URL do produto
    else if (currentUrl.includes('netshoes.com.br')) {
      const netshoesProductUrl = await page.evaluate(() => {
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical && canonical.href) {
          return canonical.href;
        }
        // Outra tentativa para Netshoes
        const productMetas = document.querySelector('meta[property="og:url"]');
        if (productMetas && productMetas.content) {
          return productMetas.content;
        }
        return window.location.href;
      });
      
      if (netshoesProductUrl) {
        resolvedUrl = netshoesProductUrl;
        console.log(`URL do produto Netshoes encontrada: ${resolvedUrl}`);
      }
    }
    
    // Limpar a URL para remover parâmetros de rastreamento
    try {
      const urlObj = new URL(resolvedUrl);
      
      // Parâmetros que queremos manter
      const keepParams = ['id', 'p', 'produto', 'cor', 'tamanho', 's'];
      
      // Remover parâmetros de rastreamento
      const params = Array.from(urlObj.searchParams.keys());
      params.forEach(param => {
        if (!keepParams.includes(param.toLowerCase())) {
          urlObj.searchParams.delete(param);
        }
      });
      
      // Remover hash/fragment, exceto quando necessário para o produto
      if (urlObj.hash && !urlObj.hash.includes('produto')) {
        urlObj.hash = '';
      }
      
      resolvedUrl = urlObj.toString();
      console.log(`URL limpa: ${resolvedUrl}`);
    } catch (err) {
      console.log(`Erro ao limpar URL: ${err.message}`);
      // Manter a URL original em caso de erro
    }
    
    return resolvedUrl;
  } catch (error) {
    console.error('Erro ao resolver URL:', error);
    console.error(error.stack);
    // Se der erro, retorna a URL original
    return url;
  } finally {
    await browser.close();
  }
};