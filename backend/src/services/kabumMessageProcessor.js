// backend/src/services/kabumMessageProcessor.js
const https = require('https');

// Credenciais da API AWIN para Kabum
const PUBLISHER_ID = "1926295";
const API_TOKEN = "947b4045-699c-455a-970c-0fa81af62aa6";
const ADVERTISER_ID = "17729"; // Kabum

// Função para detectar se é mensagem do Kabum
const isKabumMessage = (text) => {
  // Detectar se tem tidd.ly + estrutura de mensagem (não os links específicos Centauro/Nike)
  const hasTiddLy = text.includes('tidd.ly');
  const hasStructuredText = text.includes('💵') || text.includes('🚨') || text.includes('🎟');
  const isNotCentauro = !text.includes('tidd.ly/3Ey3rLE');
  const isNotNike = !text.includes('tidd.ly/4cvXuvd');
  
  return hasTiddLy && hasStructuredText && isNotCentauro && isNotNike;
};

// Função para extrair dados da mensagem
const extractMessageData = (message) => {
  console.log('[KABUM-MSG] Extraindo dados da mensagem...');
  
  const data = {
    productName: '',
    price: '',
    couponInfo: '',
    link: ''
  };
  
  // Extrair nome do produto (tudo antes do preço R$)
  const beforePrice = message.split(/💵|R\$/)[0];
  if (beforePrice) {
    data.productName = beforePrice
      .replace(/🚨|💥|⚡|🔥|🎯|➡️|✔️|🎟|💵|\*/g, '') // Remover emojis
      .replace(/https?:\/\/[^\s]+/g, '') // Remover links
      .replace(/\s+/g, ' ') // Normalizar espaços
      .trim();
  }
  
  // Extrair preço (R$ XXX)
  const priceMatch = message.match(/R\$\s*(\d+(?:[.,]\d+)?)/);
  if (priceMatch) {
    data.price = priceMatch[1];
  }
  
  // Extrair informação de cupom
  const couponPatterns = [
    /cupom[:\s]*([^\n\r]+)/i,
    /🎟[:\s]*([^\n\r]+)/i
  ];
  
  for (const pattern of couponPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.couponInfo = match[1].trim().replace(/https?:\/\/[^\s]+/g, '').trim();
      break;
    }
  }
  
  // Extrair link tidd.ly
  const linkMatch = message.match(/https?:\/\/tidd\.ly\/[A-Za-z0-9]+/);
  if (linkMatch) {
    data.link = linkMatch[0];
  }
  
  console.log('[KABUM-MSG] Dados extraídos:', data);
  return data;
};

// Função melhorada para resolver múltiplos redirecionamentos
const resolveTiddLink = (shortLink, maxRedirects = 5) => {
  return new Promise((resolve) => {
    console.log(`[KABUM-MSG] Resolvendo: ${shortLink}`);
    
    let redirectCount = 0;
    
    const followRedirect = (currentUrl) => {
      if (redirectCount >= maxRedirects) {
        console.log('[KABUM-MSG] Máximo de redirecionamentos atingido');
        resolve(null);
        return;
      }
      
      // Se já é URL do Kabum, retornar
      if (currentUrl.includes('kabum.com.br')) {
        console.log(`[KABUM-MSG] ✅ URL do Kabum encontrada: ${currentUrl}`);
        resolve(currentUrl);
        return;
      }
      
      // Se é URL da AWIN, extrair o link interno
      if (currentUrl.includes('awin1.com/cread.php')) {
        const urlParams = new URL(currentUrl);
        const internalLink = urlParams.searchParams.get('ued');
        if (internalLink) {
          console.log(`[KABUM-MSG] Link interno encontrado na AWIN: ${internalLink}`);
          redirectCount++;
          followRedirect(internalLink);
          return;
        }
      }
      
      // Fazer requisição HEAD para seguir redirecionamento
      const url = new URL(currentUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location;
          console.log(`[KABUM-MSG] Redirecionado para: ${redirectUrl}`);
          redirectCount++;
          followRedirect(redirectUrl);
        } else {
          console.log(`[KABUM-MSG] Fim dos redirecionamentos em: ${currentUrl}`);
          resolve(null);
        }
      });
      
      req.on('error', () => {
        console.log(`[KABUM-MSG] Erro ao resolver ${currentUrl}`);
        resolve(null);
      });
      
      req.setTimeout(10000, () => {
        console.log(`[KABUM-MSG] Timeout ao resolver ${currentUrl}`);
        req.destroy();
        resolve(null);
      });
      
      req.end();
    };
    
    followRedirect(shortLink);
  });
};

// Estratégia alternativa: fazer GET na URL AWIN para extrair o link final
const extractKabumUrlFromAwin = (awinUrl) => {
  return new Promise((resolve) => {
    console.log(`[KABUM-MSG] Extraindo URL do Kabum de: ${awinUrl}`);
    
    const url = new URL(awinUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        // Procurar por URLs do Kabum no HTML/JavaScript
        const kabumMatches = data.match(/https?:\/\/[^"'\s]*kabum\.com\.br[^"'\s]*/g);
        if (kabumMatches && kabumMatches.length > 0) {
          const kabumUrl = kabumMatches[0];
          console.log(`[KABUM-MSG] ✅ URL do Kabum extraída: ${kabumUrl}`);
          resolve(kabumUrl);
        } else {
          console.log('[KABUM-MSG] Nenhuma URL do Kabum encontrada no HTML');
          resolve(null);
        }
      });
    });
    
    req.on('error', () => {
      console.log(`[KABUM-MSG] Erro ao fazer GET em ${awinUrl}`);
      resolve(null);
    });
    
    req.setTimeout(15000, () => {
      console.log(`[KABUM-MSG] Timeout ao fazer GET em ${awinUrl}`);
      req.destroy();
      resolve(null);
    });
    
    req.end();
  });
};

// Função para gerar link de afiliado AWIN
const generateAwinAffiliateLink = (originalUrl) => {
  return new Promise((resolve, reject) => {
    console.log(`[KABUM-MSG] Gerando link AWIN para: ${originalUrl}`);
    
    const postData = JSON.stringify({
      advertiserId: parseInt(ADVERTISER_ID),
      destinationUrl: originalUrl,
      shorten: true
    });
    
    const options = {
      hostname: 'api.awin.com',
      path: `/publishers/${PUBLISHER_ID}/linkbuilder/generate`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.shortUrl) {
            console.log(`[KABUM-MSG] ✅ Link encurtado gerado: ${response.shortUrl}`);
            resolve(response.shortUrl);
          } else if (response.url) {
            console.log(`[KABUM-MSG] ✅ Link gerado: ${response.url}`);
            resolve(response.url);
          } else {
            console.log(`[KABUM-MSG] ❌ Erro na API AWIN:`, response);
            reject(new Error('Falha ao gerar link de afiliado AWIN'));
          }
        } catch (error) {
          console.log(`[KABUM-MSG] ❌ Erro ao processar resposta:`, error);
          reject(error);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`[KABUM-MSG] ❌ Erro na requisição:`, e);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
};

// Função para reformatar mensagem
const formatKabumMessage = (messageData, newLink) => {
  console.log('[KABUM-MSG] Formatando mensagem...');
  
  let formattedMessage = `➡️ *${messageData.productName}*\n_Vendido e entregue por Kabum_\n\n💵 R$ ${messageData.price}`;
  
  // Adicionar cupom se existir
  if (messageData.couponInfo) {
    formattedMessage += `\n🎟️ Cupom: ${messageData.couponInfo}`;
  }
  
  // Adicionar link do produto
  formattedMessage += `\n🛒 Link do produto: ${newLink}`;
  
  formattedMessage += `\n\n☑️ Link do grupo: https://linktr.ee/techdealsbr`;
  
  console.log('[KABUM-MSG] Mensagem formatada:', formattedMessage);
  return formattedMessage;
};

// Função principal para processar mensagem
const processKabumMessage = async (message) => {
  console.log('[KABUM-MSG] Iniciando processamento...');
  
  try {
    // Extrair dados da mensagem
    const messageData = extractMessageData(message);
    
    if (!messageData.productName) {
      throw new Error('Nome do produto não encontrado na mensagem');
    }
    
    if (!messageData.link) {
      throw new Error('Link tidd.ly não encontrado na mensagem');
    }
    
    let newLink = messageData.link; // Fallback para link original
    
    try {
      console.log('[KABUM-MSG] Resolvendo link...');
      
      // Primeiro, tentar resolver seguindo redirecionamentos
      let resolvedUrl = await resolveTiddLink(messageData.link);
      
      // Se não funcionou, tentar extrair da página AWIN
      if (!resolvedUrl) {
        console.log('[KABUM-MSG] Tentando extrair URL da página AWIN...');
        
        // Primeiro, obter a URL da AWIN
        const awinUrl = await new Promise((resolve) => {
          const url = new URL(messageData.link);
          const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          };
          
          const req = https.request(options, (res) => {
            if (res.headers.location && res.headers.location.includes('awin1.com')) {
              resolve(res.headers.location);
            } else {
              resolve(null);
            }
          });
          
          req.on('error', () => resolve(null));
          req.setTimeout(10000, () => { req.destroy(); resolve(null); });
          req.end();
        });
        
        if (awinUrl) {
          resolvedUrl = await extractKabumUrlFromAwin(awinUrl);
        }
      }
      
      if (resolvedUrl) {
        // Gerar novo link de afiliado com suas credenciais
        const newAffiliateLink = await generateAwinAffiliateLink(resolvedUrl);
        newLink = newAffiliateLink;
        console.log(`[KABUM-MSG] ✅ Link convertido: ${messageData.link} → ${newLink}`);
      } else {
        console.log(`[KABUM-MSG] ⚠️ Mantendo link original: ${messageData.link}`);
      }
    } catch (error) {
      console.log(`[KABUM-MSG] ❌ Erro ao processar link, mantendo original:`, error.message);
    }
    
    // Reformatar mensagem
    const formattedMessage = formatKabumMessage(messageData, newLink);
    
    return {
      name: messageData.productName,
      currentPrice: `R$ ${messageData.price}`,
      originalPrice: null,
      imageUrl: '',
      vendor: 'Vendido e entregue por Kabum',
      platform: 'kabum',
      productUrl: formattedMessage, // A mensagem formatada vai aqui
      originalMessage: message,
      convertedMessage: formattedMessage,
      isKabumMessage: true
    };
    
  } catch (error) {
    console.error('[KABUM-MSG] Erro:', error);
    throw error;
  }
};

module.exports = {
  isKabumMessage,
  processKabumMessage
};