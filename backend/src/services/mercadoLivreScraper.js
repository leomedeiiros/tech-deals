const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.scrapeProductData = async (url) => {
  // Modificar a configuração de lançamento para não usar o Chrome do sistema
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-features=site-per-process'
    ],
    // Remover a referência ao executável externo
    // Deixar o Puppeteer usar o Chrome embutido
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Adicionar flags extras para melhorar o carregamento
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
    
    // Capturar URL após primeiro redirecionamento
    let currentUrl = page.url();
    console.log(`URL após redirecionamento inicial: ${currentUrl}`);
    
    // Verificar se estamos em uma página social ou de perfil
    const isSocialPage = currentUrl.includes('/social/') || 
                         currentUrl.includes('forceInApp=true');
    
    if (isSocialPage) {
      console.log('Detectada página social. Procurando produto principal...');
      
      // Clicar explicitamente no botão "Ver produto" do produto principal
      const productFound = await page.evaluate(() => {
        // Primeiro tenta encontrar o botão "Ver produto" que seja do produto principal
        // (geralmente o primeiro ou o mais destacado na página)
        const verProdutoButtons = Array.from(document.querySelectorAll('a, button')).filter(el => {
          return el.textContent.trim().toLowerCase() === 'ver produto';
        });
        
        // Ordenar por prioridade - botões mais próximos do topo da página
        // geralmente é o produto principal em páginas de afiliados
        if (verProdutoButtons.length > 0) {
          // Ordenar por posição vertical na página
          verProdutoButtons.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            return aRect.top - bRect.top;
          });
          
          // Priorizar botões que estão em cards grandes/principais
          const mainButton = verProdutoButtons.find(btn => {
            // Verificar se algum elemento pai tem uma classe que sugere ser o card principal
            let parent = btn.parentElement;
            let depth = 0;
            while (parent && depth < 5) {
              if (parent.classList && (
                parent.classList.contains('main-product') || 
                parent.classList.contains('primary') ||
                parent.classList.contains('highlighted') ||
                parent.classList.contains('featured') ||
                // Verificar se é maior que os outros cards (geralmente o card principal é maior)
                parent.offsetWidth > 400 || parent.offsetHeight > 300
              )) {
                return true;
              }
              parent = parent.parentElement;
              depth++;
            }
            return false;
          }) || verProdutoButtons[0]; // Caso não encontre, pega o primeiro
          
          // Clicar no botão selecionado
          mainButton.click();
          return true;
        }
        
        return false;
      });
      
      if (productFound) {
        console.log('Botão "Ver produto" encontrado e clicado.');
        
        // Aguardar navegação
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
          console.log('Navegação concluída após clicar no botão "Ver produto"');
        } catch (e) {
          console.log('Timeout na navegação após clicar, esperando mais tempo...');
          await wait(5000);
        }
        
        // Atualizar URL atual
        currentUrl = page.url();
        console.log(`Nova URL após clicar no botão: ${currentUrl}`);
        
        // *** CORREÇÃO AQUI: Verificar se estamos em uma página de produto válida ***
        const isValidProductPage = await page.evaluate(() => {
          // Verificar se existem elementos que confirmam que estamos em uma página de produto válida
          const hasProductTitle = document.querySelector('.ui-pdp-title') !== null;
          const hasProductPrice = document.querySelector('.andes-money-amount') !== null || 
                                  document.querySelector('[class*="price-tag"]') !== null;
          const hasProductImage = document.querySelector('.ui-pdp-gallery__figure img') !== null || 
                                 document.querySelector('.ui-pdp-image') !== null;
                                 
          return hasProductTitle && (hasProductPrice || hasProductImage);
        });
        
        if (isValidProductPage) {
          console.log('Confirmado que estamos em uma página de produto válida.');
        } else {
          console.log('Não parece ser uma página de produto válida.');
        }
      } else {
        console.log('Botão "Ver produto" não encontrado. Tentando alternativas...');
        
        // Alternativa: Procurar pelo card mais proeminente
        const mainProductUrl = await page.evaluate(() => {
          // Tentar encontrar o card de produto principal (geralmente o primeiro ou maior)
          const productCards = Array.from(document.querySelectorAll('a[href*="produto.mercadolivre"], a[href*="/p/MLB"]'));
          
          // Filtra para remover links que não são de produtos
          const productLinks = productCards.filter(link => {
            return link.href && (
              link.href.includes('produto.mercadolivre.com.br/MLB-') || 
              link.href.includes('/p/MLB')
            );
          });
          
          if (productLinks.length > 0) {
            // Ordenar links por tamanho do elemento pai (card)
            productLinks.sort((a, b) => {
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              // Card maior vem primeiro
              return (bRect.width * bRect.height) - (aRect.width * aRect.height);
            });
            
            return productLinks[0].href;
          }
          
          return null;
        });
        
        if (mainProductUrl) {
          console.log(`Link direto do produto principal encontrado: ${mainProductUrl}`);
          await page.goto(mainProductUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          await wait(3000);
          
          // Atualizar URL atual
          currentUrl = page.url();
          console.log(`Nova URL após navegar para o link do produto: ${currentUrl}`);
        } else {
          console.log('Não foi possível encontrar um link de produto principal, analisando HTML...');
          
          // Procurar diretamente por links MLB no HTML da página
          const pageContent = await page.content();
          const mlbMatches = pageContent.match(/produto\.mercadolivre\.com\.br\/MLB-[0-9]+/g);
          
          if (mlbMatches && mlbMatches.length > 0) {
            // Construir o link completo
            const mlbLink = `https://${mlbMatches[0]}`;
            console.log(`Link MLB encontrado no HTML: ${mlbLink}`);
            await page.goto(mlbLink, { waitUntil: 'networkidle2', timeout: 60000 });
            await wait(3000);
            
            // Atualizar URL atual
            currentUrl = page.url();
            console.log(`Nova URL após navegar para link MLB: ${currentUrl}`);
          }
        }
      }
    }
    
    // ***** CORREÇÃO: Melhorar a verificação da página de produto *****
    const isProductPage = await page.evaluate(() => {
      // Verificamos se estamos em uma página de produto do Mercado Livre
      // de várias maneiras possíveis
      
      // 1. Verificar pelo URL
      const currentUrl = window.location.href;
      const isProductUrl = currentUrl.includes('produto.mercadolivre.com.br/MLB-') || 
                          currentUrl.includes('mercadolivre.com.br/p/MLB');
      
      // 2. Verificar pelos elementos na página
      const hasProductElements = document.querySelector('.ui-pdp-title') !== null || 
                                document.querySelector('h1[class*="ui-pdp-title"]') !== null;
                                
      // 3. Verificar pelo preço
      const hasPriceElements = document.querySelector('.andes-money-amount') !== null || 
                              document.querySelector('[class*="price-tag"]') !== null;
                              
      // 4. Verificar pela imagem do produto
      const hasProductImage = document.querySelector('.ui-pdp-gallery__figure img') !== null || 
                             document.querySelector('.ui-pdp-image') !== null;
      
      // Retornar true se pelo menos duas destas condições forem verdadeiras
      let trueConditions = 0;
      if (isProductUrl) trueConditions++;
      if (hasProductElements) trueConditions++;
      if (hasPriceElements) trueConditions++;
      if (hasProductImage) trueConditions++;
      
      return trueConditions >= 2;
    });
    
    console.log(`Verificação de página de produto: ${isProductPage ? 'É uma página de produto' : 'Não é uma página de produto'}`);
    
    // ***** CORREÇÃO: Só buscar outro link se realmente não for uma página de produto *****
    if (!isProductPage) {
      console.log('Não estamos em uma página de produto. Buscando link MLB direto...');
      
      // Procurar por links para páginas de produto
      const productLink = await page.evaluate(() => {
        // Procurar por links que correspondam ao padrão MLB
        const productLinks = Array.from(document.querySelectorAll('a')).filter(a => {
          return a.href && (
            a.href.includes('produto.mercadolivre.com.br/MLB-') ||
            a.href.includes('mercadolivre.com.br/p/MLB')
          );
        });
        
        if (productLinks.length > 0) {
          return productLinks[0].href;
        }
        
        return null;
      });
      
      if (productLink) {
        console.log(`Link do produto MLB encontrado: ${productLink}`);
        await page.goto(productLink, { waitUntil: 'networkidle2', timeout: 60000 });
        await wait(3000);
      } else {
        console.log('Não foi encontrado nenhum link MLB direto.');
      }
    } else {
      console.log('Já estamos em uma página de produto válida, continuando com a extração de dados...');
    }
    
    // Rolar a página para garantir que todos os elementos carreguem
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    
    await wait(1000);
    
    // Extrair dados do produto com consultas ajustadas
    const productData = await page.evaluate(() => {
      // Função para limpar texto de preço
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Nome do produto - uso de múltiplos seletores para maior robustez
      const productTitle = 
        document.querySelector('.ui-pdp-title')?.textContent.trim() || 
        document.querySelector('h1[class*="ui-pdp-title"]')?.textContent.trim() ||
        document.querySelector('h1')?.textContent.trim();
      
      // Preço atual - verificar múltiplos seletores possíveis
      let currentPrice = '';
      
      // Tentativa 1: seletor para preço com desconto
      const priceWithDiscountElement = document.querySelector('.andes-money-amount.andes-money-amount--cents.ui-pdp-price__part');
      if (priceWithDiscountElement) {
        const integerPart = priceWithDiscountElement.querySelector('.andes-money-amount__fraction')?.textContent.trim() || '';
        const centsPart = priceWithDiscountElement.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
        currentPrice = `${integerPart},${centsPart}`;
      }
      
      // Tentativa 2: outro seletor para preço atual
      if (!currentPrice || currentPrice === ',00') {
        const priceElement = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction');
        if (priceElement) {
          const integerPart = priceElement.textContent.trim();
          const centsPart = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__cents')?.textContent.trim() || '00';
          currentPrice = `${integerPart},${centsPart}`;
        }
      }
      
      // Tentativa 3: outro seletor genérico para preço atual
      if (!currentPrice || currentPrice === ',00') {
        const genericPriceElement = document.querySelector('[class*="price-tag"] [class*="fraction"]');
        if (genericPriceElement) {
          const integerPart = genericPriceElement.textContent.trim();
          const centsPart = document.querySelector('[class*="price-tag"] [class*="cents"]')?.textContent.trim() || '00';
          currentPrice = `${integerPart},${centsPart}`;
        }
      }
      
      // Tentativa 4: pegar o preço diretamente do elemento que mostra R$ XX,XX
      if (!currentPrice || currentPrice === ',00') {
        const priceFull = document.querySelector('.andes-money-amount')?.textContent.trim();
        if (priceFull) {
          currentPrice = cleanPrice(priceFull);
        }
      }
      
      // Preço original (riscado) - verificar múltiplos seletores possíveis
      let originalPrice = '';
      
      // Tentativa 1: seletor para preço original mais comum
      const originalPriceElement = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__fraction');
      if (originalPriceElement) {
        const integerPart = originalPriceElement.textContent.trim();
        const centsPart = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__cents')?.textContent.trim() || '00';
        originalPrice = `${integerPart},${centsPart}`;
      }
      
      // Tentativa 2: seletor alternativo para preço original
      if (!originalPrice) {
        const originalPriceAlt = document.querySelector('.ui-pdp-price__original-value');
        if (originalPriceAlt) {
          originalPrice = cleanPrice(originalPriceAlt.textContent);
        }
      }
      
      // Tentativa 3: outro seletor para preço riscado
      if (!originalPrice) {
        const strikePriceElement = document.querySelector('s [class*="fraction"]') || document.querySelector('span[class*="strike"]');
        if (strikePriceElement) {
          const integerPart = strikePriceElement.textContent.trim();
          const centsPart = document.querySelector('s [class*="cents"]')?.textContent.trim() || '00';
          originalPrice = `${integerPart},${centsPart}`;
        }
      }
      
      // Tentativa 4: tentar encontrar o elemento de preço riscado
      if (!originalPrice) {
        const strikeThroughPrice = document.querySelector('s.ui-pdp-price__part')?.textContent;
        if (strikeThroughPrice) {
          originalPrice = cleanPrice(strikeThroughPrice);
        }
      }
      
      // Tentativa 5: procurar por texto "R$ XX,XX" dentro de elementos com class contendo "original"
      if (!originalPrice) {
        const originalPriceElements = Array.from(document.querySelectorAll('[class*="original"]'));
        for (const elem of originalPriceElements) {
          const priceText = elem.textContent.trim();
          if (priceText.includes('R$')) {
            originalPrice = cleanPrice(priceText);
            break;
          }
        }
      }
      
      // Tentar obter a porcentagem de desconto
      let discountPercentage = '';
      const discountElement = document.querySelector('.ui-pdp-price__discount');
      if (discountElement) {
        discountPercentage = discountElement.textContent.trim();
      }
      
      // Se temos a porcentagem de desconto e o preço atual, mas não o preço original, calcular
      if (discountPercentage && currentPrice && !originalPrice) {
        const match = discountPercentage.match(/(\d+)%/);
        if (match) {
          const percent = parseInt(match[1], 10);
          const currentValue = parseFloat(currentPrice.replace(',', '.'));
          if (!isNaN(percent) && !isNaN(currentValue)) {
            const originalValue = currentValue / (1 - percent / 100);
            originalPrice = originalValue.toFixed(2).replace('.', ',');
          }
        }
      }
      
      // Se temos o preço full e o valor do desconto, calcular o preço original
      if (!originalPrice) {
        const priceFullElement = document.querySelector('.ui-pdp-price__original-value');
        if (priceFullElement) {
          originalPrice = cleanPrice(priceFullElement.textContent);
        }
      }
      
      // Imagem do produto - múltiplos seletores para maior robustez
      const productImage = 
        document.querySelector('.ui-pdp-gallery__figure img')?.src ||
        document.querySelector('.ui-pdp-image')?.src ||
        document.querySelector('[class*="ui-pdp-gallery"] img')?.src ||
        document.querySelector('figure img')?.src;
      
      // Vendedor - múltiplos seletores para maior robustez
      const vendorElement = 
        document.querySelector('.ui-pdp-seller__header__title') || 
        document.querySelector('[class*="seller-info"] [class*="title"]');
      const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
      
      // Determinar se é loja oficial - múltiplos seletores
      const isOfficialStore = 
        document.querySelector('.ui-pdp-seller__header-status .ui-pdp-official-store-label') !== null ||
        document.querySelector('[class*="official-store-label"]') !== null;
      
      // Obter o link real do produto (para debug)
      const realProductUrl = window.location.href;
      
      // Obter o link original do Mercado Livre (não o redirecionado)
      const canonicalLink = document.querySelector('link[rel="canonical"]')?.href || '';
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        discountPercentage: discountPercentage || null,
        imageUrl: productImage || '',
        vendor: vendor,
        isOfficialStore: isOfficialStore,
        realProductUrl: realProductUrl,
        canonicalLink: canonicalLink
      };
    });
    
    // Log para depuração
    console.log("Dados extraídos:", JSON.stringify(productData, null, 2));
    
    // Verificar se os dados estão corretos
    if (productData.name === 'Nome do produto não encontrado' || productData.currentPrice === 'Preço não disponível') {
      console.log("Dados incorretos detectados. Tentando acessar diretamente o produto...");
      
      // Fechar a página atual
      await page.close();
      
      // Abrir nova página e acessar diretamente o produto
      const newPage = await browser.newPage();
      await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
      
      // Extrair o código do link afiliado se possível
      let affiliateCode = '';
      if (url.includes('/sec/')) {
        affiliateCode = url.split('/sec/')[1].trim();
      }
      
      // Para o Mercado Livre, tente extrair MLB da URL atual
      let directUrl;
      const mlbMatch = currentUrl.match(/MLB-\d+/);
      if (mlbMatch) {
        directUrl = `https://produto.mercadolivre.com.br/${mlbMatch[0]}`;
        console.log(`Extraído código de produto ${mlbMatch[0]} da URL atual`);
      } else {
        // Última tentativa - usar produto de exemplo
        directUrl = `https://produto.mercadolivre.com.br/MLB-3375716831-pasta-de-amendoim-gourmet-600g-chocolate-dr-peanut-_JM`;
        console.log(`Não foi possível extrair código do produto, usando exemplo`);
      }
      
      console.log(`Acessando diretamente: ${directUrl}`);
      
      await newPage.goto(directUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await wait(3000);
      
      try {
        // Extrair dados novamente usando a nova página
        const directProductData = await newPage.evaluate(() => {
          // Função para limpar texto de preço
          const cleanPrice = (price) => {
            if (!price) return '';
            return price.replace(/[^\d,]/g, '').trim();
          };
          
          // Nome do produto
          const productTitle = document.querySelector('.ui-pdp-title')?.textContent.trim();
          
          // Preço atual
          let currentPrice = '';
          const priceElement = document.querySelector('.andes-money-amount__fraction');
          if (priceElement) {
            const integerPart = priceElement.textContent.trim();
            const centsPart = document.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
            currentPrice = `${integerPart},${centsPart}`;
          }
          
          // Preço original
          let originalPrice = '';
          const originalPriceElement = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__fraction');
          if (originalPriceElement) {
            const integerPart = originalPriceElement.textContent.trim();
            const centsPart = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__cents')?.textContent.trim() || '00';
            originalPrice = `${integerPart},${centsPart}`;
          }
          
          // Imagem
          const productImage = document.querySelector('.ui-pdp-gallery__figure img')?.src;
          
          // Vendedor
          const vendorElement = document.querySelector('.ui-pdp-seller__header__title');
          const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
          
          // Loja oficial
          const isOfficialStore = document.querySelector('.ui-pdp-official-store-label') !== null;
          
          return {
            name: productTitle || 'Produto não encontrado',
            currentPrice: currentPrice || 'Preço não disponível',
            originalPrice: originalPrice || null,
            discountPercentage: null,
            imageUrl: productImage || '',
            vendor: vendor,
            isOfficialStore: isOfficialStore,
            realProductUrl: window.location.href
          };
        });
        
        console.log("Dados diretos extraídos:", JSON.stringify(directProductData, null, 2));
        
        if (directProductData.name !== 'Produto não encontrado' && 
            directProductData.currentPrice !== 'Preço não disponível') {
          // Usar os dados diretos se parecerem válidos
          productData = directProductData;
        }
      } catch (innerError) {
        console.error("Erro ao extrair dados do produto direto:", innerError);
      }
    }
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    // Remover propriedades temporárias
    delete productData.canonicalLink;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping no Mercado Livre:', error);
    console.error(error.stack);
    
    // Deve lançar o erro para que o controlador saiba que falhou
    throw new Error(`Falha ao extrair dados do produto no Mercado Livre: ${error.message}`);
  } finally {
    await browser.close();
  }
};