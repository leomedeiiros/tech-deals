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

// Função principal para processar mensagem
const processShopeeMessage = async (message) => {
  console.log('[SHOPEE-MSG] Iniciando processamento...');
  
  try {
    const originalLinks = extractShopeeLinks(message);
    
    if (originalLinks.length === 0) {
      throw new Error('Nenhum link da Shopee encontrado');
    }
    
    let newMessage = message;
    let successCount = 0;
    
    for (const originalLink of originalLinks) {
      try {
        const resolvedUrl = await resolveShortLink(originalLink);
        
        if (resolvedUrl) {
          const newAffiliateLink = await generateAffiliateLink(resolvedUrl);
          newMessage = newMessage.replace(originalLink, newAffiliateLink);
          successCount++;
          console.log(`[SHOPEE-MSG] ✅ Link convertido: ${originalLink} → ${newAffiliateLink}`);
        } else {
          console.log(`[SHOPEE-MSG] ⚠️ Mantendo link original: ${originalLink}`);
        }
      } catch (error) {
        console.log(`[SHOPEE-MSG] ❌ Erro ao processar ${originalLink}:`, error.message);
      }
    }
    
    return {
      name: 'Mensagem da Shopee',
      currentPrice: 'Ver na mensagem',
      originalPrice: null,
      imageUrl: '',
      vendor: 'Loja Verificada na Shopee',
      platform: 'shopee',
      productUrl: newMessage, // A mensagem inteira vai aqui
      originalMessage: message,
      convertedMessage: newMessage,
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