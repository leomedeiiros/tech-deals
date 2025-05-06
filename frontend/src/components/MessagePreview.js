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
  // Função para formatar o preço (com solução específica para preços acima de 999)
  const formatPrice = (price) => {
    if (!price) return '';
    
    // Remover apenas caracteres não numéricos, mas manter pontos e vírgulas
    let cleanPrice = price.replace(/[^\d,\.]/g, '');
    
    // Verificar formato com vírgula (formato brasileiro)
    if (cleanPrice.includes(',')) {
      // Retorna toda a parte antes da vírgula (ex: em "1.299,90" retorna "1.299")
      return cleanPrice.split(',')[0];
    }
    
    // Verificar formato com ponto (formato americano)
    if (cleanPrice.includes('.')) {
      // Verificar se tem vírgula de milhar antes do ponto
      if (cleanPrice.indexOf(',') < cleanPrice.indexOf('.') && cleanPrice.indexOf(',') !== -1) {
        // Formato americano (1,299.90) - manter a vírgula de milhar
        return cleanPrice.split('.')[0];
      }
      
      // Formato com ponto como separador decimal sem vírgula de milhar
      // Vamos verificar quantos pontos existem (se houver mais de um, provavelmente é separador de milhar)
      const pontos = cleanPrice.match(/\./g);
      if (pontos && pontos.length > 1) {
        // Temos pontos de milhar - retornar tudo (ex: em "1.299.90" retorna "1.299")
        const lastDotIndex = cleanPrice.lastIndexOf('.');
        return cleanPrice.substring(0, lastDotIndex);
      } else {
        // Apenas um ponto como decimal - retornar tudo antes do ponto
        return cleanPrice.split('.')[0];
      }
    }
    
    // Se não tem vírgula nem ponto, retornar como está
    return cleanPrice;
  };
  
  // Função para converter string de preço para número, independentemente do formato
  const priceStringToNumber = (priceStr) => {
    if (!priceStr) return 0;
    
    // Limpar a string para manter apenas números, vírgulas e pontos
    let cleanPrice = priceStr.replace(/[^\d,\.]/g, '');
    
    // Formato brasileiro: 1.299,90 (ponto como separador de milhar, vírgula como decimal)
    if (cleanPrice.includes(',')) {
      return parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'));
    }
    
    // Formato americano: 1,299.90 (vírgula como separador de milhar, ponto como decimal)
    if (cleanPrice.includes('.')) {
      return parseFloat(cleanPrice.replace(/,/g, ''));
    }
    
    // Apenas números
    return parseFloat(cleanPrice);
  };
  
  // Função para calcular preço com desconto percentual
  const calculatePercentageDiscount = (currentPrice) => {
    if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número, removendo formatação
    let priceNum = priceStringToNumber(currentPrice);
    
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
    
    // Converter o preço para número, removendo formatação
    let priceNum = priceStringToNumber(currentPrice);
    
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
    // (diferença mínima de 5% para considerar como desconto real)
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
    
    // Processar preço atual para remover centavos
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
    
    // SOLUÇÃO ESPECÍFICA para o problema de preços acima de 999
    // Se o preço final é apenas "1" e o preço original contém "1." 
    // (caso específico para 1.299,90 -> 1)
    if (finalPrice === "1" && currentPrice && currentPrice.includes("1.")) {
      console.log("Correção aplicada para preço 1.XXX");
      finalPrice = currentPrice.split(",")[0]; // Manter tudo antes da vírgula
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