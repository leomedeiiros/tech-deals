// backend/src/services/aliexpressMessageProcessor.js
const crypto = require('crypto');
const https = require('https');

// Credenciais da API AliExpress
const APP_KEY = "518188";
const APP_SECRET = "bYXZzKMmHrT7haKZmcl7h1VIs5sDXOAb";
const TRACKING_ID = "techdeals";

// Função para detectar se é mensagem da AliExpress
const isAliExpressMessage = (text) => {
  const hasAliLink = text.includes('s.click.aliexpress.com') || text.includes('aliexpress.com');
  const hasStructuredText = text.includes('💵') || text.includes('🚨') || text.includes('🎟') || text.includes('R$');
  
  return hasAliLink && hasStructuredText;
};

// Função para extrair dados da mensagem (CORRIGIDA)
const extractMessageData = (message) => {
  console.log('[ALIEXPRESS-MSG] Extraindo dados da mensagem...');
  
  const data = {
    productName: '',
    price: '',
    couponInfo: '',
    link: '',
    extraInfo: '',
    extraMoedas: ''
  };
  
  // PRIMEIRO: Extrair o link da AliExpress
  const linkMatch = message.match(/https?:\/\/s\.click\.aliexpress\.com\/e\/[A-Za-z0-9_]+/);
  if (linkMatch) {
    data.link = linkMatch[0];
    console.log('[ALIEXPRESS-MSG] Link encontrado:', data.link);
  }
  
  // SEGUNDO: Extrair nome do produto (tudo ANTES do preço R$ e SEM o link)
  let cleanMessage = message.replace(data.link, ''); // Remove o link
  const beforePrice = cleanMessage.split(/R\$/)[0];
  if (beforePrice) {
    data.productName = beforePrice
      .replace(/🚨|💥|⚡|🔥|🎯|➡️|✔️|🎟|💵|\*/g, '') // Remover emojis
      .replace(/LINK/gi, '') // Remover palavra "LINK"
      .replace(/\s+/g, ' ') // Normalizar espaços
      .trim();
  }
  
  // TERCEIRO: Extrair preço (R$ XXX)
  const priceMatch = message.match(/R\$\s*(\d+(?:[.,]\d+)?)/);
  if (priceMatch) {
    data.price = priceMatch[1];
  }
  
  // QUARTO: Extrair moedas (XXX moedas)
  const moedaMatch = message.match(/(\d+)\s*moedas/i);
  if (moedaMatch) {
    data.extraMoedas = moedaMatch[1];
  }
  
  // QUINTO: Extrair cupons (tudo que parece cupom)
  const cupomPatterns = [
    /cupom[:\s]*([A-Z0-9]+)/gi,
    /([A-Z]{3,}[0-9]{2,})/g, // Padrão ASGARD4104, IFPASOE
  ];
  
  const cuponsFound = [];
  for (const pattern of cupomPatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const cupom = match[1];
      if (cupom && cupom.length >= 4 && cupom.length <= 15) {
        cuponsFound.push(cupom);
      }
    }
  }
  
  if (cuponsFound.length > 0) {
    data.couponInfo = cuponsFound.join(' + ');
  }
  
  // SEXTO: Informações extras (após APP ou antes do link)
  const appIndex = message.toLowerCase().indexOf('app');
  const linkIndex = message.indexOf(data.link);
  
  if (appIndex !== -1 && linkIndex !== -1 && appIndex < linkIndex) {
    const afterApp = message.substring(appIndex + 3, linkIndex).trim();
    if (afterApp && afterApp.length > 0) {
      data.extraInfo = afterApp.replace(/LINK/gi, '').trim();
    }
  }
  
  console.log('[ALIEXPRESS-MSG] Dados extraídos:', data);
  return data;
};

// Função para assinatura HMAC-SHA256
function buildSign(params, secret) {
  const sorted = Object.keys(params).sort();
  const baseStr = sorted.map(k => k + params[k]).join("");
  return crypto.createHmac("sha256", secret).update(baseStr, "utf8").digest("hex").toUpperCase();
}

// Função para extrair links da resposta da API
function extractLinks(data) {
  const resp = data?.aliexpress_affiliate_link_generate_response?.resp_result?.result;
  if (!resp) return [];
  
  const pl = resp.promotion_links;
  const out = [];
  
  // Formato 1: { promotion_links: { promotion_link: [ { promotion_link: "..." } ] } }
  if (pl?.promotion_link) {
    const arr = Array.isArray(pl.promotion_link) ? pl.promotion_link : [pl.promotion_link];
    for (const item of arr) {
      if (typeof item === "string") out.push(item);
      else if (item?.promotion_link) out.push(item.promotion_link);
    }
  }
  
  // Formato 2: { promotion_links: [ { promotion_link: "..." } ] }
  if (Array.isArray(pl)) {
    for (const item of pl) {
      if (typeof item === "string") out.push(item);
      else if (item?.promotion_link) out.push(item.promotion_link);
    }
  }
  
  // Fallback
  if (resp?.promotion_link && typeof resp.promotion_link === "string") {
    out.push(resp.promotion_link);
  }
  
  return [...new Set(out)]; // dedup
}

// Função para gerar link de afiliado AliExpress
const generateAliExpressAffiliateLink = (originalUrl) => {
  return new Promise((resolve, reject) => {
    console.log(`[ALIEXPRESS-MSG] Gerando link de afiliado para: ${originalUrl}`);
    
    const timestamp = Date.now().toString();
    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.link.generate",
      sign_method: "sha256",
      timestamp,
      ship_to_country: "BR",
      promotion_link_type: "0",
      tracking_id: TRACKING_ID,
      source_values: originalUrl,
    };
    
    const sign = buildSign(params, APP_SECRET);
    params.sign = sign;
    
    const formBody = new URLSearchParams(params).toString();
    
    const options = {
      hostname: 'api-sg.aliexpress.com',
      path: '/sync',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const links = extractLinks(response);
          
          if (links.length > 0) {
            const newLink = links[0];
            console.log(`[ALIEXPRESS-MSG] ✅ Link gerado: ${newLink}`);
            resolve(newLink);
          } else {
            console.log(`[ALIEXPRESS-MSG] ❌ Erro na API:`, response);
            reject(new Error('Falha ao gerar link de afiliado AliExpress'));
          }
        } catch (error) {
          console.log(`[ALIEXPRESS-MSG] ❌ Erro ao processar resposta:`, error);
          reject(error);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`[ALIEXPRESS-MSG] ❌ Erro na requisição:`, e);
      reject(e);
    });
    
    req.setTimeout(30000, () => {
      console.log('[ALIEXPRESS-MSG] ⏰ Timeout na requisição');
      req.destroy();
      reject(new Error('Timeout na API'));
    });
    
    req.write(formBody);
    req.end();
  });
};

// Função para reformatar mensagem
const formatAliExpressMessage = (messageData, newLink) => {
  console.log('[ALIEXPRESS-MSG] Formatando mensagem...');
  
  let formattedMessage = `➡️ *${messageData.productName}*\n_Vendido na AliExpress_\n\n💵 R$ ${messageData.price}`;
  
  // Adicionar moedas se existir
  if (messageData.extraMoedas) {
    formattedMessage += ` + ${messageData.extraMoedas} moedas`;
  }
  
  // Adicionar cupom se existir
  if (messageData.couponInfo) {
    formattedMessage += `\n🎟️ Cupom: ${messageData.couponInfo}`;
  }
  
  // Adicionar link do produto
  formattedMessage += `\n🛒 Link do produto: ${newLink}`;
  
  // Adicionar informação extra se existir
  if (messageData.extraInfo) {
    formattedMessage += `\n\n⚠️ ${messageData.extraInfo}`;
  }
  
  formattedMessage += `\n\n☑️ Link do grupo: https://linktr.ee/techdealsbr`;
  
  console.log('[ALIEXPRESS-MSG] Mensagem formatada:', formattedMessage);
  return formattedMessage;
};

// Função principal para processar mensagem
const processAliExpressMessage = async (message) => {
  console.log('[ALIEXPRESS-MSG] Iniciando processamento...');
  
  try {
    // Extrair dados da mensagem
    const messageData = extractMessageData(message);
    
    if (!messageData.productName) {
      throw new Error('Nome do produto não encontrado na mensagem');
    }
    
    if (!messageData.link) {
      throw new Error('Link da AliExpress não encontrado na mensagem');
    }
    
    let newLink = messageData.link; // Fallback para link original
    
    try {
      // Gerar novo link de afiliado com suas credenciais
      const newAffiliateLink = await generateAliExpressAffiliateLink(messageData.link);
      newLink = newAffiliateLink;
      console.log(`[ALIEXPRESS-MSG] ✅ Link convertido: ${messageData.link} → ${newLink}`);
    } catch (error) {
      console.log(`[ALIEXPRESS-MSG] ❌ Erro ao processar link, mantendo original:`, error.message);
    }
    
    // Reformatar mensagem
    const formattedMessage = formatAliExpressMessage(messageData, newLink);
    
    return {
      name: messageData.productName,
      currentPrice: `R$ ${messageData.price}`,
      originalPrice: null,
      imageUrl: '',
      vendor: 'Vendido na AliExpress',
      platform: 'aliexpress',
      productUrl: formattedMessage, // A mensagem formatada vai aqui
      originalMessage: message,
      convertedMessage: formattedMessage,
      isAliExpressMessage: true
    };
    
  } catch (error) {
    console.error('[ALIEXPRESS-MSG] Erro:', error);
    throw error;
  }
};

module.exports = {
  isAliExpressMessage,
  processAliExpressMessage
};