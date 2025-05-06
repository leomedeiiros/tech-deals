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
  // SOLUÇÃO DEFINITIVA: função para formatar o preço mantendo separadores de milhar
  const formatPrice = (price) => {
    if (!price) return '';
    
    // Se o preço já contém separador de milhar (ponto) e decimal (vírgula) - formato brasileiro
    // Exemplo: "3.799,90" -> "3.799"
    if (typeof price === 'string' && price.includes('.') && price.includes(',')) {
      return price.split(',')[0]; // Retorna tudo antes da vírgula (mantendo pontos de milhar)
    }
    
    // Se o preço contém apenas vírgula (sem pontos) - formato simplificado brasileiro
    // Exemplo: "3799,90" -> "3799"
    if (typeof price === 'string' && price.includes(',') && !price.includes('.')) {
      return price.split(',')[0];
    }
    
    // Se o preço contém pontos mas não vírgulas, pode ser formato americano ou pontos decimais
    // Vamos verificar quantos pontos existem
    if (typeof price === 'string' && price.includes('.') && !price.includes(',')) {
      const pontos = price.match(/\./g);
      if (pontos && pontos.length > 1) {
        // Múltiplos pontos = formato com separadores de milhar
        // Exemplo: "3.799.00" -> "3.799"
        const lastDotIndex = price.lastIndexOf('.');
        return price.substring(0, lastDotIndex);
      } else {
        // Apenas um ponto = decimal
        // Exemplo: "3799.90" -> "3799"
        return price.split('.')[0];
      }
    }
    
    // Se o preço tem vírgulas como separador de milhar e ponto como decimal (formato americano)
    // Exemplo: "3,799.90" -> "3,799"
    if (typeof price === 'string' && price.includes(',') && price.includes('.')) {
      if (price.indexOf(',') < price.indexOf('.')) {
        return price.split('.')[0];
      }
    }
    
    // Caso seja apenas um número sem formatação
    return price;
  };
  
  // Função para converter string de preço para número
  const priceStringToNumber = (priceStr) => {
    if (!priceStr) return 0;
    
    // Converter para string se não for
    const priceString = String(priceStr);
    
    // Formato brasileiro: 3.799,90 (ponto como separador de milhar, vírgula como decimal)
    if (priceString.includes(',')) {
      return parseFloat(priceString.replace(/\./g, '').replace(',', '.'));
    }
    
    // Formato americano: 3,799.90 (vírgula como separador de milhar, ponto como decimal)
    if (priceString.includes('.')) {
      return parseFloat(priceString.replace(/,/g, ''));
    }
    
    // Apenas números
    return parseFloat(priceString);
  };
  
  // Função para calcular preço com desconto percentual
  const calculatePercentageDiscount = (currentPrice) => {
    if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número
    const priceNum = priceStringToNumber(currentPrice);
    
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
    const priceNum = priceStringToNumber(currentPrice);
    
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
      .replace(/vendido por/i, '')
      .trim();
    
    return cleanName;
  };
  
  // Função para verificar se há um desconto real
  const hasRealDiscount = (originalPrice, currentPrice) => {
    if (!originalPrice || !currentPrice) return false;
    
    // Converter preços para números
    const originalValue = priceStringToNumber(originalPrice);
    const currentValue = priceStringToNumber(currentPrice);
    
    // Verificar se o preço original é significativamente maior que o atual
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
  
  // Função para gerar a mensagem final
  const generateMessage = () => {
    if (!productData) return '';
    
    const { name, currentPrice, originalPrice, productUrl } = productData;
    
    // IMPORTANTE: Sempre obter o texto do tipo de loja da função getStoreTypeText
    // Não gerar o texto aqui para garantir consistência
    const storeTypeText = getStoreTypeText();
    
    let priceText = '';
    
    // Processar preço atual para remover centavos, mantendo separadores de milhar
    const processedCurrentPrice = formatPrice(currentPrice);
    
    // Determinar preço final (com possíveis descontos)
    let finalPrice = processedCurrentPrice;
    if (discountPercentage) {
      finalPrice = calculatePercentageDiscount(processedCurrentPrice);
    } else if (discountValue) {
      finalPrice = calculateValueDiscount(processedCurrentPrice);
    }
    
    // Log para debug
    console.log("DEBUG - Preço:", {
      original: currentPrice,
      processado: processedCurrentPrice,
      final: finalPrice 
    });
    
    // IMPORTANTE: Verifica se o preço final é apenas "1" (sinal de problema)
    // e recupera o preço original formatado sem os centavos
    if (finalPrice === "1" && currentPrice) {
      console.log("CORREÇÃO APLICADA: Detectado problema de preço");
      // Para garantir, usamos o preço original e removemos apenas a parte decimal
      if (typeof currentPrice === 'string' && currentPrice.includes(',')) {
        finalPrice = currentPrice.split(',')[0];
      } else if (typeof currentPrice === 'string' && currentPrice.includes('.')) {
        // Se tem múltiplos pontos, é separador de milhar, senão é decimal
        const pontos = currentPrice.match(/\./g);
        if (pontos && pontos.length > 1) {
          const lastDotIndex = currentPrice.lastIndexOf('.');
          finalPrice = currentPrice.substring(0, lastDotIndex);
        } else {
          finalPrice = currentPrice.split('.')[0];
        }
      }
    }
    
    // Processar preço original para remover centavos, mantendo separadores de milhar
    const processedOriginalPrice = formatPrice(originalPrice);
    
    // CORREÇÃO ESPECÍFICA para o preço original também
    let fixedOriginalPrice = processedOriginalPrice;
    if (processedOriginalPrice === "1" || processedOriginalPrice === "2" || processedOriginalPrice === "3") {
      if (typeof originalPrice === 'string' && originalPrice.includes(',')) {
        fixedOriginalPrice = originalPrice.split(',')[0];
      }
    }
    
    // Para Amazon, mostrar apenas o preço atual (sem o original)
    if (isAmazon) {
      priceText = `✅  Por *R$ ${finalPrice}*`;
    } else {
      // Para todas as outras lojas (Mercado Livre, Nike, Centauro, etc),
      // SEMPRE mostrar o formato De/Por quando há um preço original
      if (fixedOriginalPrice && hasRealDiscount(fixedOriginalPrice, finalPrice)) {
        priceText = `✅  ~De R$ ${fixedOriginalPrice}~ por *R$ ${finalPrice}*`;
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