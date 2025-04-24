// backend/src/services/netshoesScraper.js
const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.scrapeProductData = async (url) => {
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
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Adicionar headers extras
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
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
    
    // Verificar se estamos em uma página de afiliado da Rakuten (tiny.cc)
    if (url.includes('tiny.cc') || url.includes('rakuten')) {
      console.log('Detectado link de afiliado Rakuten, aguardando redirecionamentos...');
      
      // Aguardar mais tempo para redirecionamentos de afiliados
      await wait(5000);
      
      // Obter URL atual após redirecionamentos
      currentUrl = page.url();
      console.log(`URL após redirecionamentos de afiliado: ${currentUrl}`);
    }
    
    // Verificar se estamos em uma página de produto da Netshoes
    const isNetshoesProductPage = await page.evaluate(() => {
      return window.location.href.includes('netshoes.com.br/') && 
             (document.querySelector('.short-description') !== null ||
              document.querySelector('.product-name') !== null ||
              document.querySelector('.product__name') !== null);
    });
    
    if (!isNetshoesProductPage) {
      console.log('Não estamos em uma página de produto da Netshoes. Procurando links...');
      
      // Tentar encontrar link de produto
      const productLink = await page.evaluate(() => {
        // Buscar links que apontam para produtos da Netshoes
        const links = Array.from(document.querySelectorAll('a')).filter(a => 
          a.href && a.href.includes('netshoes.com.br/') && 
          !a.href.includes('/cart') && !a.href.includes('/checkout')
        );
        
        if (links.length > 0) {
          // Priorizar links que parecem ser de produtos
          const productLinks = links.filter(a => 
            a.href.includes('/produto/') || a.href.match(/\-\d+\-\d+\-\d+/)
          );
          
          return productLinks.length > 0 ? productLinks[0].href : links[0].href;
        }
        
        return null;
      });
      
      if (productLink) {
        console.log(`Link de produto encontrado: ${productLink}`);
        await page.goto(productLink, { waitUntil: 'networkidle2', timeout: 60000 });
        await wait(3000);
        
        // Atualizar URL atual
        currentUrl = page.url();
        console.log(`Nova URL após navegar para o produto: ${currentUrl}`);
      } else {
        console.log('Não foi encontrado nenhum link de produto.');
      }
    }
    
    // Rolar a página para garantir que todos os elementos carreguem
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    
    await wait(1000);
    
    // Extrair dados do produto
    const productData = await page.evaluate(() => {
      // Função para limpar texto de preço
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Nome do produto - múltiplos seletores para maior robustez
      const productTitle = 
        document.querySelector('.short-description')?.textContent.trim() || 
        document.querySelector('.product-name')?.textContent.trim() || 
        document.querySelector('.product__name')?.textContent.trim() ||
        document.querySelector('h1')?.textContent.trim();
      
      // Preço atual - verificar múltiplos seletores possíveis
      let currentPrice = '';
      
      // Tentar vários seletores para o preço atual
      const priceSelectors = [
        '.default-price',
        '.price__value',
        '.product-price .price-box .regular-price .price',
        '.product-price-box .product-price__best',
        '.price-final'
      ];
      
      for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
          currentPrice = cleanPrice(priceElement.textContent);
          break;
        }
      }
      
      // Preço original (riscado)
      let originalPrice = '';
      
      // Tentar vários seletores para o preço original
      const originalPriceSelectors = [
        '.old-price',
        '.price__old',
        '.product-price .price-box .old-price .price',
        '.product-price-box .product-price__old',
        '.regular-price .strike'
      ];
      
      for (const selector of originalPriceSelectors) {
        const originalPriceElement = document.querySelector(selector);
        if (originalPriceElement) {
          originalPrice = cleanPrice(originalPriceElement.textContent);
          break;
        }
      }
      
      // Imagem do produto
      const productImage = 
        document.querySelector('.photo-figure img')?.src ||
        document.querySelector('.showcase-product img')?.src ||
        document.querySelector('.product__image img')?.src ||
        document.querySelector('.photo .zoom img')?.src ||
        document.querySelector('meta[property="og:image"]')?.content;
      
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
    
    // Log para depuração
    console.log("Dados extraídos da Netshoes:", JSON.stringify(productData, null, 2));
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Netshoes:', error);
    console.error(error.stack);
    throw new Error(`Falha ao extrair dados do produto na Netshoes: ${error.message}`);
  } finally {
    await browser.close();
  }
};