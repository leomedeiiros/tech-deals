// frontend/src/components/MessagePreview.js
import React, { useEffect } from 'react';

const MessagePreview = ({ 
  productData, 
  couponCode, 
  storeType, 
  vendorName,
  discountPercentage,
  discountValue,
  setFinalMessage
}) => {
  // SOLUÇÃO DE EMERGÊNCIA PARA PREÇOS ACIMA DE R$ 999
  // Essa função é crítica e deve ser a mais simples possível
  const preservePrice = (price) => {
    if (!price) return '';
    
    // Prevenção crítica: Se o preço contém um ponto e uma vírgula, mantém tudo exceto centavos
    if (typeof price === 'string' && price.includes('.') && price.includes(',')) {
      return price.split(',')[0]; // Mantém toda a parte antes da vírgula, incluindo pontos
    }
    
    // Se o preço contém uma vírgula (ex: 2799,90), retorna tudo antes da vírgula
    if (typeof price === 'string' && price.includes(',')) {
      return price.split(',')[0];
    }
    
    // Se o preço contém apenas pontos como decimal
    if (typeof price === 'string' && price.includes('.')) {
      return price.split('.')[0];
    }
    
    return price;
  };
  
  // Função de conversão para cálculos
  const priceToNumber = (priceStr) => {
    if (!priceStr) return 0;
    const str = String(priceStr);
    
    // Formato BR: 1.234,56 -> remove pontos e substitui vírgula por ponto
    if (str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    }
    
    // Formato US ou número simples
    return parseFloat(str);
  };
  
  // Função para calcular preço com desconto percentual
  const calculatePercentageDiscount = (currentPrice) => {
    if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter para número e aplicar desconto
    const priceNum = priceToNumber(currentPrice);
    if (isNaN(priceNum)) return currentPrice;
    
    const discountRate = parseFloat(discountPercentage) / 100;
    const discountedPrice = priceNum * (1 - discountRate);
    
    // Arredondar para baixo e converter para string
    return Math.floor(discountedPrice).toString();
  };
  
  // Função para calcular preço com desconto em valor fixo (R$)
  const calculateValueDiscount = (currentPrice) => {
    if (!discountValue || discountValue <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter para número e aplicar desconto
    const priceNum = priceToNumber(currentPrice);
    if (isNaN(priceNum)) return currentPrice;
    
    const discount = parseFloat(discountValue);
    const discountedPrice = priceNum - discount;
    
    // Garantir mínimo de R$ 1
    if (discountedPrice <= 0) return "1";
    
    // Arredondar para baixo e converter para string
    return Math.floor(discountedPrice).toString();
  };
  
  // Função para tratar o nome do vendedor
  const cleanVendorName = (vendorName) => {
    if (!vendorName) return '';
    
    // Remover textos comuns
    let cleanName = vendorName
      .replace(/^Vendido\s+por/i, '')
      .replace(/^Loja\s+oficial\s+/i, '')
      .replace(/^Loja\s+/i, '')
      .replace(/^oficial\s*/i, '')
      .replace(/\s*oficial$/i, '')
      .replace(/\s*oficial\s*/i, ' ')
      .trim();
    
    return cleanName;
  };
  
  // Função para verificar se há um desconto real
  const hasRealDiscount = (originalPrice, currentPrice) => {
    if (!originalPrice || !currentPrice) return false;
    
    // Converter para números e comparar
    const originalValue = priceToNumber(originalPrice);
    const currentValue = priceToNumber(currentPrice);
    
    return !isNaN(originalValue) && !isNaN(currentValue) && 
           originalValue > currentValue && 
           (originalValue - currentValue) / originalValue > 0.05;
  };
  
  // Função fixa para sempre retornar o mesmo valor para cada tipo de loja
  const getStoreTypeText = () => {
    // Se não tiver dados do produto, retornar vazio
    if (!productData) return '';
    
    // Determinar se é um produto de loja específica
    const isNike = productData.platform === 'nike' || (productData.vendor && productData.vendor.toLowerCase().includes('nike'));
    const isCentauro = productData.platform === 'centauro' || (productData.vendor && productData.vendor.toLowerCase().includes('centauro'));
    const isNetshoes = productData.platform === 'netshoes' || (productData.vendor && productData.vendor.toLowerCase().includes('netshoes'));
    
    // Valores fixos para cada tipo de loja
    if (storeType === 'amazon') {
      return 'Vendido e entregue pela Amazon';
    }
    
    if (storeType === 'loja_oficial') {
      if (isNike) {
        return 'Loja oficial Nike no Mercado Livre';
      }
      if (isCentauro) {
        return 'Loja oficial Centauro no Mercado Livre';
      }
      if (isNetshoes) {
        return 'Loja oficial Netshoes no Mercado Livre';
      }
      
      if (productData.vendor && productData.vendor !== 'Mercado Livre') {
        // Limpar nome do vendedor e garantir bom espaçamento
        const cleanName = cleanVendorName(productData.vendor);
        return `Loja oficial ${cleanName} no Mercado Livre`;
      }
      
      return 'Loja oficial no Mercado Livre';
    }
    
    if (storeType === 'loja_validada') {
      return 'Loja validada no Mercado Livre';
    }
    
    if (storeType === 'catalogo') {
      if (vendorName && vendorName.trim() !== '') {
        return `⚠️ No anúncio, localize o campo 'Outras opções de compra' e selecione o vendedor '${vendorName}' (loja oficial)`;
      } else {
        return `⚠️ No anúncio, localize o campo 'Outras opções de compra' e selecione o vendedor 'Informe o nome do vendedor' (loja oficial)`;
      }
    }
    
    return '';
  };
  
  // Verificar se é Amazon para determinar como mostrar preço
  const isAmazon = storeType === 'amazon' || 
                  (productData && productData.vendor === 'Amazon') ||
                  (productData && productData.platform && 
                   productData.platform.toLowerCase().includes('amazon'));
  
  // Função para gerar a mensagem final - SIMPLIFICADA E FOCO EM PREÇOS
  const generateMessage = () => {
    if (!productData) return '';
    
    const { name, currentPrice, originalPrice, productUrl } = productData;
    
    // Obter texto do tipo de loja
    const storeTypeText = getStoreTypeText();
    
    // *** SOLUÇÃO DE EMERGÊNCIA ***
    // Usar a função mais simples e direta possível para preservar os preços
    const safeCurrentPrice = preservePrice(currentPrice);
    const safeOriginalPrice = preservePrice(originalPrice);
    
    // Garantia extra para o caso específico de 2.799,90 -> 1
    // Impedir que o preço seja apenas "1", "2" ou "3" se o original contém ponto
    let fixedCurrentPrice = safeCurrentPrice;
    if ((safeCurrentPrice === "1" || safeCurrentPrice === "2" || safeCurrentPrice === "3") && 
        typeof currentPrice === 'string' && currentPrice.includes('.')) {
      console.log("EMERGÊNCIA: Corrigindo preço incorreto", safeCurrentPrice, "->", currentPrice.split(',')[0]);
      fixedCurrentPrice = currentPrice.split(',')[0];
    }
    
    // Mesma garantia para preço original
    let fixedOriginalPrice = safeOriginalPrice;
    if ((safeOriginalPrice === "1" || safeOriginalPrice === "2" || safeOriginalPrice === "3") && 
        typeof originalPrice === 'string' && originalPrice.includes('.')) {
      console.log("EMERGÊNCIA: Corrigindo preço original incorreto", safeOriginalPrice, "->", originalPrice.split(',')[0]);
      fixedOriginalPrice = originalPrice.split(',')[0];
    }
    
    // Aplicar descontos (se houver)
    let finalPrice = fixedCurrentPrice;
    if (discountPercentage) {
      const discounted = calculatePercentageDiscount(fixedCurrentPrice);
      // Garantia extra contra valores incorretos
      finalPrice = (discounted === "1" || discounted === "2" || discounted === "3") ? fixedCurrentPrice : discounted;
    } else if (discountValue) {
      const discounted = calculateValueDiscount(fixedCurrentPrice);
      // Garantia extra contra valores incorretos
      finalPrice = (discounted === "1" || discounted === "2" || discounted === "3") ? fixedCurrentPrice : discounted;
    }
    
    // Formato do preço para a mensagem
    let priceText = '';
    if (isAmazon) {
      priceText = `✅  Por *R$ ${finalPrice}*`;
    } else {
      if (fixedOriginalPrice && hasRealDiscount(fixedOriginalPrice, finalPrice)) {
        priceText = `✅  ~De R$ ${fixedOriginalPrice}~ por *R$ ${finalPrice}*`;
      } else {
        priceText = `✅  Por *R$ ${finalPrice}*`;
      }
    }
    
    // Construir a mensagem
    let message = `➡️ *${name}*`;
    if (storeTypeText) {
      message += `\n_${storeTypeText}_`;
    }
    
    message += `\n\n${priceText}`;
    
    if (couponCode) {
      message += `\n🎟️ Use o cupom: *${couponCode}*`;
    }
    
    message += `\n🛒 ${productUrl}`;
    message += `\n\n☑️ Link do grupo: https://linktr.ee/techdealsbr`;
    
    return message;
  };
  
  // Gerar a mensagem sempre que os dados mudarem
  useEffect(() => {
    if (productData) {
      const message = generateMessage();
      setFinalMessage(message);
    }
  }, [productData, couponCode, storeType, vendorName, discountPercentage, discountValue]);
  
  // Retornar a mensagem
  return generateMessage();
};

export default MessagePreview;