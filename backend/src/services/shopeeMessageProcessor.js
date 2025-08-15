// backend/src/services/shopeeMessageProcessor.js
const https = require('https');
const crypto = require('crypto');

// Credenciais da API Shopee
const APP_ID = "18336030644";
const PARTNER_KEY = "OQDQG4ODAACPO5CKDO6XIA6C2YSMKXRG";

// Função para detectar se é mensagem da Shopee
const isShopeeMessage = (text) => {
  return text.includes('s.shopee.com.br') || text.includes('shopee.com.br');
};

// Função para extrair dados da mensagem
const extractMessageData = (message) => {
  console.log('[SHOPEE-MSG] Extraindo dados da mensagem...');
  
  const data = {
    productName: '',
    price: '',
    installments: '',
    hasInstallments: false,
    couponInfo: '',
    links: []
  };
  
  // Extrair nome do produto (primeira linha geralmente)
  const lines = message.split('\n').filter(line => line.trim());
  if (lines.length > 0) {
    // Remover emojis e limpar primeira linha
    data.productName = lines[0]
      .replace(/🚨|💥|⚡|🔥|🎯|➡️|\*/g, '')
      .trim();
  }
  
  // Extrair preço (R$ XXX)
  const priceMatch = message.match(/R\$\s*(\d+(?:[.,]\d+)?)/);
  if (priceMatch) {
    data.price = priceMatch[1];
  }
  
  // Detectar informações de parcelas
  const installmentPatterns = [
    /(\d+x\s*sem\s*juros)/i,
    /(\d+x\s*SEM\s*JUROS)/i,
    /(em\s*\d+x\s*sem\s*juros)/i,
    /(em\s*\d+x\s*SEM\s*JUROS)/i
  ];
  
  for (const pattern of installmentPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.hasInstallments = true;
      data.installments = match[1].toLowerCase().replace('em ', '');
      break;
    }
  }
  
  // Extrair informação de cupom
  const couponPatterns = [
    /cupom\s*([^:]+):/i,
    /cupom\s*([^h]+)h/i,
    /cupom\s*([^\n]+)/i
  ];
  
  for (const pattern of couponPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.couponInfo = match[1].trim();
      break;
    }
  }
  
  // Extrair links
  const shopeeRegex = /https?:\/\/(?:s\.)?shopee\.com\.br\/[A-Za-z0-9]+/g;
  data.links = message.match(shopeeRegex) || [];
  
  console.log('[SHOPEE-MSG] Dados extraídos:', data);
  return data;
};

// Função para extrair links da Shopee de uma mensagem
const extractShopeeLinks = (message) => {
  console.log('[SHOPEE-MSG] Extraindo links da mensagem...');
  
  const shopeeRegex = /https?:\/\/(?:s\.)?shopee\.com\.br\/[A-Za-z0-9]+/g;
  const links = message.match(shopeeRegex) || [];
  
  console.log(`[SHOPEE-MSG] ${links.length} links encontrados:`, links);
  return links;
};

// Função para resolver link encurtado
const resolveShortLink = (shortLink) => {
  return new Promise((resolve) => {
    console.log(`[SHOPEE-MSG] Resolvendo: ${shortLink}`);
    
    const url = new URL(shortLink);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location;
        console.log(`[SHOPEE-MSG] Redirecionado para: ${redirectUrl}`);
        
        if (redirectUrl.includes('shopee.com.br') && !redirectUrl.includes('s.shopee.com.br')) {
          resolve(redirectUrl);
        } else {
          resolveShortLink(redirectUrl).then(resolve).catch(() => resolve(null));
        }
      } else {
        console.log(`[SHOPEE-MSG] Link não redirecionou: ${shortLink}`);
        resolve(null);
      }
    });
    
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
    
    req.end();
  });
};

// Função para gerar link de afiliado
const generateAffiliateLink = (originalUrl) => {
  return new Promise((resolve, reject) => {
    console.log(`[SHOPEE-MSG] Gerando link de afiliado para: ${originalUrl}`);
    
    const TIMESTAMP = Math.floor(Date.now() / 1000);
    
    const bodyObj = {
      query: `mutation{
        generateShortLink(input:{originUrl:"${originalUrl}", subIds:["s1","s2","s3","s4","s5"]}){
          shortLink
        }
      }`
    };
    
    const BODY = JSON.stringify(bodyObj);
    const signatureBase = `${APP_ID}${TIMESTAMP}${BODY}${PARTNER_KEY}`;
    const SIGNATURE = crypto.createHash("sha256").update(signatureBase).digest("hex");
    
    const options = {
      hostname: "open-api.affiliate.shopee.com.br",
      path: "/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `SHA256 Credential=${APP_ID}, Timestamp=${TIMESTAMP}, Signature=${SIGNATURE}`,
        "Content-Length": Buffer.byteLength(BODY)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.data?.generateShortLink?.shortLink) {
            resolve(response.data.generateShortLink.shortLink);
          } else {
            reject(new Error('Falha ao gerar link de afiliado'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on("error", reject);
    req.write(BODY);
    req.end();
  });
};

// Função para reformatar mensagem
const formatShopeeMessage = (messageData, newLinks) => {
  console.log('[SHOPEE-MSG] Formatando mensagem...');
  
  let formattedMessage = `➡️ *${messageData.productName}*\n_Loja Verificada na Shopee_\n\n💵 R$ ${messageData.price}`;
  
  // Adicionar linha de parcelas se detectado
  if (messageData.hasInstallments) {
    formattedMessage += `\n⭐️ ${messageData.installments}`;
  }
  
  // Adicionar cupom (primeiro link)
  if (messageData.couponInfo && newLinks.length > 0) {
    formattedMessage += `\n🎟️ Resgate cupom ${messageData.couponInfo}: ${newLinks[0]}`;
  }
  
  // Adicionar link do produto (segundo link, ou primeiro se só tiver um)
  const productLinkIndex = newLinks.length > 1 ? 1 : 0;
  if (newLinks[productLinkIndex]) {
    formattedMessage += `\n🛒 Link do produto: ${newLinks[productLinkIndex]}`;
  }
  
  formattedMessage += `\n\n☑️ Link do grupo: https://linktr.ee/techdealsbr`;
  
  console.log('[SHOPEE-MSG] Mensagem formatada:', formattedMessage);
  return formattedMessage;
};

// Função principal para processar mensagem
const processShopeeMessage = async (message) => {
  console.log('[SHOPEE-MSG] Iniciando processamento...');
  
  try {
    // Extrair dados da mensagem
    const messageData = extractMessageData(message);
    
    if (!messageData.productName) {
      throw new Error('Nome do produto não encontrado na mensagem');
    }
    
    // Extrair links originais
    const originalLinks = extractShopeeLinks(message);
    
    if (originalLinks.length === 0) {
      throw new Error('Nenhum link da Shopee encontrado');
    }
    
    const newLinks = [];
    let successCount = 0;
    
    // Processar cada link
    for (const originalLink of originalLinks) {
      try {
        const resolvedUrl = await resolveShortLink(originalLink);
        
        if (resolvedUrl) {
          const newAffiliateLink = await generateAffiliateLink(resolvedUrl);
          newLinks.push(newAffiliateLink);
          successCount++;
          console.log(`[SHOPEE-MSG] ✅ Link convertido: ${originalLink} → ${newAffiliateLink}`);
        } else {
          // Se não conseguir resolver, manter original
          newLinks.push(originalLink);
          console.log(`[SHOPEE-MSG] ⚠️ Mantendo link original: ${originalLink}`);
        }
      } catch (error) {
        // Se der erro, manter original
        newLinks.push(originalLink);
        console.log(`[SHOPEE-MSG] ❌ Erro ao processar ${originalLink}:`, error.message);
      }
    }
    
    // Reformatar mensagem
    const formattedMessage = formatShopeeMessage(messageData, newLinks);
    
    return {
      name: messageData.productName,
      currentPrice: `R$ ${messageData.price}`,
      originalPrice: null,
      imageUrl: '',
      vendor: 'Loja Verificada na Shopee',
      platform: 'shopee',
      productUrl: formattedMessage, // A mensagem formatada vai aqui
      originalMessage: message,
      convertedMessage: formattedMessage,
      linksProcessed: originalLinks.length,
      linksConverted: successCount,
      isShopeeMessage: true
    };
    
  } catch (error) {
    console.error('[SHOPEE-MSG] Erro:', error);
    throw error;
  }
};

module.exports = {
  isShopeeMessage,
  processShopeeMessage
};