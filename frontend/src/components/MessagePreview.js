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
  // Função para formatar o preço (agora arredonda para baixo)
  const formatPrice = (price) => {
    if (!price) return '';
    
    // Arredondar para baixo (remover centavos)
    if (price.includes(',')) {
      return price.split(',')[0].trim();
    }
    
    // Se o preço contém ponto, assume que é separador decimal
    if (price.includes('.')) {
      return price.split('.')[0].trim();
    }
    
    return price.trim();
  };
  
  // Função para calcular preço com desconto percentual
  const calculatePercentageDiscount = (currentPrice) => {
    if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número
    let priceNum;
    if (currentPrice.includes(',')) {
      // Se o preço já está no formato brasileiro (ex: "159,99")
      priceNum = parseFloat(currentPrice.replace('.', '').replace(',', '.'));
    } else {
      // Se o preço está com ponto decimal
      priceNum = parseFloat(currentPrice);
    }
    
    if (isNaN(priceNum)) {
      return currentPrice;
    }
    
    // Calcular o preço com desconto
    const discountRate = parseFloat(discountPercentage) / 100;
    const discountedPrice = priceNum * (1 - discountRate);
    
    // Arredondar para baixo (remover centavos)
    return Math.floor(discountedPrice).toString();
  };
  
  // Função para calcular preço com desconto em valor fixo (R$)
  const calculateValueDiscount = (currentPrice) => {
    if (!discountValue || discountValue <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número
    let priceNum;
    if (currentPrice.includes(',')) {
      // Se o preço já está no formato brasileiro (ex: "159,99")
      priceNum = parseFloat(currentPrice.replace('.', '').replace(',', '.'));
    } else {
      // Se o preço está com ponto decimal
      priceNum = parseFloat(currentPrice);
    }
    
    if (isNaN(priceNum)) {
      return currentPrice;
    }
    
    // Calcular o preço com desconto em valor fixo
    const discount = parseFloat(discountValue);
    const discountedPrice = priceNum - discount;
    
    // Garantir que o preço não fique negativo
    if (discountedPrice <= 0) {
      return "1"; // Preço mínimo de R$ 1
    }
    
    // Arredondar para baixo (remover centavos)
    return Math.floor(discountedPrice).toString();
  };
  
  // Função para tratar o nome do vendedor
  const cleanVendorName = (vendorName) => {
    if (!vendorName) return '';
    
    // Caso específico: Se o nome contém "oficialadidas", extrair apenas "adidas"
    if (vendorName.includes('oficialadidas')) {
      return 'adidas';
    }
    
    // Remover prefixos e sufixos comuns que podem aparecer nos nomes das lojas
    let cleanName = vendorName
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
    
    // Converter preços para números (após remoção de centavos)
    const originalValue = parseInt(formatPrice(originalPrice).replace(/\./g, ''));
    const currentValue = parseInt(formatPrice(currentPrice).replace(/\./g, ''));
    
    // Verificar se o preço original é significativamente maior que o atual
    // (diferença mínima de 5% para considerar como desconto real)
    return !isNaN(originalValue) && !isNaN(currentValue) && 
           originalValue > currentValue && 
           (originalValue - currentValue) / originalValue > 0.05;
  };
  
  // Nova função simplificada para retornar apenas o texto plano do tipo de loja
  const getStoreTypeText = () => {
    // Se não tiver dados do produto, retornar vazio
    if (!productData) return '';
    
    // Determinar se é um produto de loja específica
    const isNike = productData.platform === 'nike' || (productData.vendor && productData.vendor.toLowerCase().includes('nike'));
    const isCentauro = productData.platform === 'centauro' || (productData.vendor && productData.vendor.toLowerCase().includes('centauro'));
    const isNetshoes = productData.platform === 'netshoes' || (productData.vendor && productData.vendor.toLowerCase().includes('netshoes'));
    
    // Formato específico para cada tipo de loja
    switch (storeType) {
      case 'amazon':
        return 'Vendido e entregue pela Amazon';
        
      case 'loja_oficial':
        // Caso seja loja esportiva específica
        if (isNike) return 'Loja oficial Nike';
        if (isCentauro) return 'Loja oficial Centauro';
        if (isNetshoes) return 'Loja oficial Netshoes';
        
        // Caso contrário, para Mercado Livre
        if (productData.vendor && productData.vendor !== 'Mercado Livre') {
          const cleanName = cleanVendorName(productData.vendor);
          return `Loja oficial ${cleanName} no Mercado Livre`;
        }
        return 'Loja oficial no Mercado Livre';
        
      case 'loja_validada':
        return 'Loja validada no Mercado Livre';
        
      case 'catalogo':
        if (vendorName && vendorName.trim() !== '') {
          return `⚠️ Vendedor: ${vendorName}`;
        } else {
          return `⚠️ No anúncio, localize o campo 'Outras opções de compra' e selecione o vendedor 'Informe o nome do vendedor' (loja oficial)`;
        }
        
      default:
        return '';
    }
  };
  
  // Verificar se é Amazon para determinar como mostrar preço
  const isAmazon = storeType === 'amazon' || 
                  (productData && productData.vendor === 'Amazon') ||
                  (productData && productData.platform && 
                   productData.platform.toLowerCase().includes('amazon'));
  
  // Função para gerar a mensagem final
  const generateMessage = () => {
    if (!productData) return '';
    
    const { name, currentPrice, originalPrice, productUrl } = productData;
    const storeTypeText = getStoreTypeText();
    
    let priceText = '';
    
    // Processar preço atual para remover centavos
    const processedCurrentPrice = formatPrice(currentPrice);
    
    // Determinar preço final (com possíveis descontos)
    let finalPrice = processedCurrentPrice;
    if (discountPercentage) {
      finalPrice = calculatePercentageDiscount(processedCurrentPrice);
    } else if (discountValue) {
      finalPrice = calculateValueDiscount(processedCurrentPrice);
    }
    
    // Processar preço original para remover centavos
    const processedOriginalPrice = formatPrice(originalPrice);
    
    // Para Amazon, mostrar apenas o preço atual (sem o original)
    if (isAmazon) {
      priceText = `✅  Por *R$ ${finalPrice}*`;
    } else {
      // Para todas as outras lojas (Mercado Livre, Nike, Centauro, etc),
      // SEMPRE mostrar o formato De/Por quando há um preço original
      if (processedOriginalPrice && hasRealDiscount(processedOriginalPrice, finalPrice)) {
        priceText = `✅  ~De R$ ${processedOriginalPrice}~ por *R$ ${finalPrice}*`;
      } else {
        // Caso não tenha desconto, mostrar apenas o preço atual
        priceText = `✅  Por *R$ ${finalPrice}*`;
      }
    }
    
    let message = `➡️ *${name}*`;
    if (storeTypeText) {
      message += `\n_${storeTypeText}_`;
    }
    
    message += `\n\n${priceText}`;
    
    // Adicionar cupom se fornecido
    if (couponCode) {
      message += `\n🎟️ Use o cupom: *${couponCode}*`;
    }
    
    // Adicionar link do produto
    message += `\n🛒 ${productUrl}`;
    
    message += `\n\n☑️ Link do grupo: https://linktr.ee/gdfit`;
    
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