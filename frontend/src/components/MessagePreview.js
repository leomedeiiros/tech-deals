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
  // Função para formatar o preço (preservando milhares)
  const formatPrice = (price) => {
    if (!price) return '';
    
    // Limpar a string para manter apenas números e vírgulas/pontos
    let cleanPrice = price.replace(/[^0-9,\.]/g, '');
    
    // Arredondar para baixo (remover centavos) preservando os milhares
    if (cleanPrice.includes(',')) {
      return cleanPrice.split(',')[0].trim();
    }
    
    // Se o preço contém ponto, assume que é separador decimal
    if (cleanPrice.includes('.')) {
      return cleanPrice.split('.')[0].trim();
    }
    
    return cleanPrice.trim();
  };
  
  // Função para calcular preço com desconto percentual
  const calculatePercentageDiscount = (currentPrice) => {
    if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número, removendo formatação
    let priceNum;
    // Limpar a string de preço removendo tudo exceto números, vírgulas e pontos
    let cleanPrice = currentPrice.replace(/[^0-9,\.]/g, '');
    
    if (cleanPrice.includes(',')) {
      // Se o preço já está no formato brasileiro (ex: "1.599,99" ou "159,99")
      priceNum = parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'));
    } else {
      // Se o preço está com ponto decimal ou é apenas um número
      priceNum = parseFloat(cleanPrice);
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
    
    // Converter o preço para número, removendo formatação
    let priceNum;
    // Limpar a string de preço removendo tudo exceto números, vírgulas e pontos
    let cleanPrice = currentPrice.replace(/[^0-9,\.]/g, '');
    
    if (cleanPrice.includes(',')) {
      // Se o preço já está no formato brasileiro (ex: "1.599,99" ou "159,99")
      priceNum = parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'));
    } else {
      // Se o preço está com ponto decimal ou é apenas um número
      priceNum = parseFloat(cleanPrice);
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
      .replace(/vendido por/i, '')
      .trim();
    
    return cleanName;
  };
  
  // Função para verificar se há um desconto real
  const hasRealDiscount = (originalPrice, currentPrice) => {
    if (!originalPrice || !currentPrice) return false;
    
    // Converter preços para números (após remoção de centavos)
    // Limpar as strings removendo qualquer caractere que não seja número
    const cleanOriginal = formatPrice(originalPrice).replace(/\D/g, '');
    const cleanCurrent = formatPrice(currentPrice).replace(/\D/g, '');
    
    const originalValue = parseInt(cleanOriginal);
    const currentValue = parseInt(cleanCurrent);
    
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