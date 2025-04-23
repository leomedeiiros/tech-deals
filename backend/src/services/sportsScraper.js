// backend/src/services/sportsScraper.js
const puppeteer = require('puppeteer');

// Função auxiliar para aguardar
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
    ignoreDefaultArgs: ['--disable-extensions']
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Aumentar o timeout para garantir que a página carregue completamente
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Aguardar um momento para garantir que todo o conteúdo dinâmico seja carregado
    await wait(2000);
    
    // Determinar qual site estamos acessando
    const isCentauro = url.includes('centauro.com.br');
    const isNike = url.includes('nike.com.br');
    const isNetshoes = url.includes('netshoes.com.br');
    
    // Extrair dados específicos baseado no site
    let productData;
    
    if (isCentauro) {
      productData = await extractCentauroData(page);
    } else if (isNike) {
      productData = await extractNikeData(page);
    } else if (isNetshoes) {
      productData = await extractNetshoesData(page);
    } else {
      throw new Error('Site não suportado');
    }
    
    // Limpar e formatar preços
    cleanPrices(productData);
    
    // Adicionar URL do produto
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error(`Erro ao fazer scraping de site esportivo (${url}):`, error);
    throw new Error(`Falha ao extrair dados do site esportivo: ${error.message}`);
  } finally {
    await browser.close();
  }
};

// Função para extrair dados da Centauro
async function extractCentauroData(page) {
  return await page.evaluate(() => {
    // Funções auxiliares
    const getBySelector = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.textContent.trim() : null;
    };
    
    // Nome do produto
    const name = getBySelector('.product-name, h1[data-productname], .product-title') ||
                getBySelector('h1');
    
    // Preços
    let currentPrice = '';
    let originalPrice = '';
    let hasDiscount = false;
    
    // Buscar preço atual
    const currentPriceEl = document.querySelector('.product-price-sell, .default-price, .product-price-actual');
    if (currentPriceEl) {
      currentPrice = currentPriceEl.textContent.trim().replace(/[^\d,]/g, '');
    }
    
    // Buscar preço original (riscado)
    const originalPriceEl = document.querySelector('.product-price-old, .old-price, .product-price-from');
    if (originalPriceEl) {
      originalPrice = originalPriceEl.textContent.trim().replace(/[^\d,]/g, '');
      hasDiscount = true;
    }
    
    // Se não encontrou preço original, usar o atual
    if (!originalPrice) {
      originalPrice = currentPrice;
    }
    
    // Imagem do produto
    let imageUrl = '';
    const imgEl = document.querySelector('.showcase-image img, .product-image-wrapper img, .main-product-image');
    if (imgEl && imgEl.src) {
      imageUrl = imgEl.src;
    } else {
      // Tentar encontrar no data-src ou em outros atributos
      const imgElAlt = document.querySelector('[data-src], [data-lazy], .lazy-load');
      if (imgElAlt) {
        imageUrl = imgElAlt.getAttribute('data-src') || imgElAlt.getAttribute('data-lazy') || '';
      }
    }
    
    // Tentar encontrar em meta tags se ainda não encontrou
    if (!imageUrl) {
      const metaImg = document.querySelector('meta[property="og:image"]');
      if (metaImg) {
        imageUrl = metaImg.getAttribute('content') || '';
      }
    }
    
    // Vendedor (geralmente é a própria Centauro)
    const vendor = 'Centauro';
    
    return {
      name: name || 'Nome do produto não encontrado',
      currentPrice: currentPrice || 'Preço não disponível',
      originalPrice: originalPrice || '',
      imageUrl,
      vendor,
      isOfficialStore: true,
      hasDiscount
    };
  });
}

// Função para extrair dados da Nike
async function extractNikeData(page) {
  return await page.evaluate(() => {
    // Nome do produto
    const name = document.querySelector('h1.product-info__name')?.textContent.trim() ||
                document.querySelector('.product-title')?.textContent.trim() ||
                document.querySelector('h1')?.textContent.trim();
    
    // Preços
    let currentPrice = '';
    let originalPrice = '';
    let hasDiscount = false;
    
    // Preço atual
    const currentPriceEl = document.querySelector('.product-price.is--current-price, .product-price.css-11s12ax');
    if (currentPriceEl) {
      currentPrice = currentPriceEl.textContent.trim().replace(/[^\d,]/g, '');
    }
    
    // Preço original
    const originalPriceEl = document.querySelector('.product-price.is--striked-out, .product-price--strikethrough');
    if (originalPriceEl) {
      originalPrice = originalPriceEl.textContent.trim().replace(/[^\d,]/g, '');
      hasDiscount = true;
    }
    
    // Se não encontrou preço original, usar o atual
    if (!originalPrice) {
      originalPrice = currentPrice;
    }
    
    // Imagem do produto
    let imageUrl = '';
    const imgEl = document.querySelector('.product-gallery__image, .css-viwop1 img, .css-1yz3p8 img');
    if (imgEl && imgEl.src) {
      imageUrl = imgEl.src;
    } else {
      // Tentar encontrar no data-src
      const imgElAlt = document.querySelector('[data-src], [data-qa="image-overlay"]');
      if (imgElAlt) {
        imageUrl = imgElAlt.getAttribute('data-src') || '';
      }
    }
    
    // Tentar encontrar em meta tags se ainda não encontrou
    if (!imageUrl) {
      const metaImg = document.querySelector('meta[property="og:image"]');
      if (metaImg) {
        imageUrl = metaImg.getAttribute('content') || '';
      }
    }
    
    // Vendedor (Nike oficial)
    const vendor = 'Nike';
    
    return {
      name: name || 'Nome do produto não encontrado',
      currentPrice: currentPrice || 'Preço não disponível',
      originalPrice: originalPrice || '',
      imageUrl,
      vendor,
      isOfficialStore: true,
      hasDiscount
    };
  });
}

// Função para extrair dados da Netshoes
async function extractNetshoesData(page) {
  return await page.evaluate(() => {
    // Nome do produto
    const name = document.querySelector('.short-description h1')?.textContent.trim() ||
                document.querySelector('h1.name')?.textContent.trim() ||
                document.querySelector('h1')?.textContent.trim();
    
    // Preços
    let currentPrice = '';
    let originalPrice = '';
    let hasDiscount = false;
    
    // Preço atual
    const currentPriceEl = document.querySelector('.default-price, .price-final, .price-box .regular-price .price');
    if (currentPriceEl) {
      currentPrice = currentPriceEl.textContent.trim().replace(/[^\d,]/g, '');
    }
    
    // Preço original
    const originalPriceEl = document.querySelector('.old-price, .price-box .old-price .price');
    if (originalPriceEl) {
      originalPrice = originalPriceEl.textContent.trim().replace(/[^\d,]/g, '');
      hasDiscount = true;
    }
    
    // Se não encontrou preço original, usar o atual
    if (!originalPrice) {
      originalPrice = currentPrice;
    }
    
    // Imagem do produto
    let imageUrl = '';
    const imgEl = document.querySelector('#product-image-zoom, .photo-figure img, .zoom-lens + img');
    if (imgEl && imgEl.src) {
      imageUrl = imgEl.src;
    } else {
      // Tentar encontrar no data-src
      const imgElAlt = document.querySelector('[data-src], [data-large-img-url]');
      if (imgElAlt) {
        imageUrl = imgElAlt.getAttribute('data-src') || imgElAlt.getAttribute('data-large-img-url') || '';
      }
    }
    
    // Tentar encontrar em meta tags se ainda não encontrou
    if (!imageUrl) {
      const metaImg = document.querySelector('meta[property="og:image"]');
      if (metaImg) {
        imageUrl = metaImg.getAttribute('content') || '';
      }
    }
    
    // Verificar se é vendido pela Netshoes ou por terceiros
    let vendor = 'Netshoes';
    let isOfficialStore = true;
    
    const vendorEl = document.querySelector('.sold-and-delivery .seller, .product-seller-info');
    if (vendorEl) {
      const vendorText = vendorEl.textContent.trim();
      if (vendorText && !vendorText.toLowerCase().includes('netshoes')) {
        vendor = vendorText;
        isOfficialStore = false;
      }
    }
    
    return {
      name: name || 'Nome do produto não encontrado',
      currentPrice: currentPrice || 'Preço não disponível',
      originalPrice: originalPrice || '',
      imageUrl,
      vendor,
      isOfficialStore,
      hasDiscount
    };
  });
}

// Função para limpar e formatar preços
function cleanPrices(data) {
  // Remover caracteres indesejados do preço atual
  if (data.currentPrice && data.currentPrice !== 'Preço não disponível') {
    // Garantir que preço tenha vírgula decimal
    if (!data.currentPrice.includes(',')) {
      data.currentPrice = data.currentPrice + ',00';
    }
  }
  
  // Remover caracteres indesejados do preço original
  if (data.originalPrice) {
    // Garantir que preço tenha vírgula decimal
    if (!data.originalPrice.includes(',')) {
      data.originalPrice = data.originalPrice + ',00';
    }
  }
  
  // Se não houver originalPrice, usar currentPrice
  if (!data.originalPrice && data.currentPrice) {
    data.originalPrice = data.currentPrice;
  }
  
  // Calcular desconto percentual se tiver desconto
  if (data.hasDiscount && data.originalPrice && data.currentPrice) {
    try {
      const original = parseFloat(data.originalPrice.replace('.', '').replace(',', '.'));
      const current = parseFloat(data.currentPrice.replace('.', '').replace(',', '.'));
      
      if (original > current) {
        const discountPercentage = Math.round(((original - current) / original) * 100);
        data.discountPercentage = discountPercentage;
      } else {
        data.discountPercentage = 0;
        data.hasDiscount = false;
      }
    } catch (error) {
      console.log('Erro ao calcular porcentagem de desconto:', error);
      data.discountPercentage = 0;
    }
  } else {
    data.discountPercentage = 0;
  }
}
if (data.originalPrice === data.currentPrice) {
    data.hasDiscount = false;
    data.discountPercentage = 0;
  }
// Função para extrair dados de outros sites esportivos (exemplo genérico)
async function extractGenericSportData(page) {
return await page.evaluate(() => {
  // Seletores genéricos para tentar capturar informações em diversos sites
  const name = document.querySelector('h1.product-title, h1.product-name, h1.title, h1')?.textContent.trim();

  // Extração de preços com múltiplos padrões
  let currentPrice = '';
  let originalPrice = '';
  let hasDiscount = false;

  // Tentar encontrar preço atual em vários seletores comuns
  const priceSelectors = [
    '.price--current', 
    '.current-price', 
    '.product-price',
    '.price-final',
    '.sale-price',
    '[itemprop="price"]',
    '.price-sales',
    '.final-price'
  ];

  for (const selector of priceSelectors) {
    if (!currentPrice) {
      const el = document.querySelector(selector);
      if (el) currentPrice = el.textContent.trim().replace(/[^\d,]/g, '');
    }
  }

  // Tentar encontrar preço original para comparação
  const originalPriceSelectors = [
    '.price--original',
    '.original-price',
    '.product-compare-price',
    '.old-price',
    '.price-before',
    '.price-standard',
    '.list-price'
  ];

  for (const selector of originalPriceSelectors) {
    if (!originalPrice) {
      const el = document.querySelector(selector);
      if (el) {
        originalPrice = el.textContent.trim().replace(/[^\d,]/g, '');
        hasDiscount = true;
      }
    }
  }

  // Fallback para preço original
  if (!originalPrice && currentPrice) {
    originalPrice = currentPrice;
    hasDiscount = false;
  }

  // Estratégias para encontrar a imagem principal
  let imageUrl = '';
  const imgSelectors = [
    '.product-image img',
    '.main-image img',
    '.gallery-image img',
    '[itemprop="image"]',
    'img[alt*="product"]',
    'img[alt*="' + (name || '').substring(0, 20) + '"]',
    '.slide img',
    '.product-image-main'
  ];

  for (const selector of imgSelectors) {
    if (!imageUrl) {
      const img = document.querySelector(selector);
      if (img) {
        imageUrl = img.src || 
                  img.getAttribute('data-src') || 
                  img.getAttribute('data-zoom-image') || 
                  img.getAttribute('data-large') ||
                  '';
      }
    }
  }

  // Fallback para meta tags de imagem
  if (!imageUrl) {
    const metaImg = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
    if (metaImg) imageUrl = metaImg.getAttribute('content') || '';
  }

  // Identificação do vendedor
  let vendor = 'Loja Oficial';
  let isOfficialStore = true;

  const vendorSelectors = [
    '.seller-name',
    '.product-seller',
    '.vendor',
    '[itemprop="brand"]',
    '.brand',
    '.retailer-name'
  ];

  for (const selector of vendorSelectors) {
    const vendorEl = document.querySelector(selector);
    if (vendorEl) {
      const vendorText = vendorEl.textContent.trim();
      if (vendorText) {
        vendor = vendorText;
        // Heurística para identificar marketplaces
        if (vendorText.toLowerCase().includes('marketplace') || 
            vendorText.toLowerCase().includes('terceiro') ||
            vendorText.toLowerCase().includes('seller') ||
            vendorText.toLowerCase().includes('vendido por')) {
          isOfficialStore = false;
        }
      }
    }
  }

  return {
    name: name || 'Nome do produto não encontrado',
    currentPrice: currentPrice || 'Preço não disponível',
    originalPrice: originalPrice || currentPrice || '',
    imageUrl,
    vendor,
    isOfficialStore,
    hasDiscount
  };
});
}

// Função para verificar disponibilidade do produto
async function checkProductAvailability(page) {
return await page.evaluate(() => {
  const availabilitySelectors = [
    '.stock',
    '.availability',
    '.qty-in-stock',
    '#stock',
    '.product-availability',
    '.available'
  ];

  let availabilityText = '';
  for (const selector of availabilitySelectors) {
    const el = document.querySelector(selector);
    if (el) {
      availabilityText = el.textContent.trim().toLowerCase();
      break;
    }
  }

  // Análise do texto de disponibilidade
  const availableKeywords = ['em estoque', 'disponível', 'pronta entrega', 'em armazém'];
  const unavailableKeywords = ['esgotado', 'indisponível', 'fora de estoque', 'sem stock'];

  // Verificar botão de compra como fallback
  const buyButton = document.querySelector('#buy-button, .buy-button, .add-to-cart');
  const isButtonAvailable = buyButton && !buyButton.disabled && 
                          !buyButton.textContent.toLowerCase().includes('esgotado');

  if (unavailableKeywords.some(kw => availabilityText.includes(kw))) {
    return false;
  }
  if (availableKeywords.some(kw => availabilityText.includes(kw)) || isButtonAvailable) {
    return true;
  }

  // Default para caso não consiga determinar
  return null;
});
}

// Exportar funções adicionais
module.exports = {
...module.exports,
extractGenericSportData,
checkProductAvailability
};