// frontend/src/components/MessagePreview.js
import React, { useEffect } from 'react';

const MessagePreview = ({ 
  productData, 
  couponCode, 
  storeType, 
  vendorName,
  discountPercentage,
  customImage,
  setFinalMessage
}) => {
  // Função para formatar o preço
  const formatPrice = (price) => {
    if (!price) return '';
    
    // Verificar se o preço já está no formato correto
    if (price.includes(',')) {
      return price.trim();
    }
    
    // Converter para número se for uma string com ponto
    if (typeof price === 'string' && price.includes('.')) {
      return price.replace('.', ',').trim();
    }
    
    return price.trim();
  };
  
  // Função para calcular preço com desconto
  const calculateDiscountedPrice = (currentPrice) => {
    if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número
    const priceStr = currentPrice.replace(',', '.');
    const priceNum = parseFloat(priceStr);
    
    if (isNaN(priceNum)) {
      return currentPrice;
    }
    
    // Calcular o preço com desconto
    const discountRate = parseFloat(discountPercentage) / 100;
    const discountedPrice = priceNum * (1 - discountRate);
    
    // Formatar de volta para string no formato brasileiro
    return discountedPrice.toFixed(2).replace('.', ',');
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
    
    // Converter preços para números
    const originalValue = parseFloat(originalPrice.replace(',', '.'));
    const currentValue = parseFloat(currentPrice.replace(',', '.'));
    
    // Verificar se o preço original é significativamente maior que o atual
    // (diferença mínima de 5% para considerar como desconto real)
    return !isNaN(originalValue) && !isNaN(currentValue) && 
           originalValue > currentValue && 
           (originalValue - currentValue) / originalValue > 0.05;
  };
  
  // Função para gerar texto de tipo de loja
  const getStoreTypeText = () => {
    switch (storeType) {
      case 'amazon':
        return 'Vendido e entregue pela Amazon';
      case 'loja_oficial': {
        // Se for loja oficial e temos o nome do vendedor nos dados do produto, usar esse formato
        if (productData.vendor && productData.vendor !== 'Mercado Livre') {
          // Limpar o nome do vendedor para remover duplicações
          const cleanName = cleanVendorName(productData.vendor);
          return `Loja oficial ${cleanName} no Mercado Livre`;
        }
        return 'Loja oficial no Mercado Livre';
      }
      case 'catalogo':
        return `⚠️ No anúncio, localize o campo 'Outras opções de compra' e selecione o vendedor '${vendorName || 'Informe o nome do vendedor'}' (loja oficial)`;
      case 'loja_validada':
        return 'Loja Validada no Mercado Livre';
      default:
        return '';
    }
  };
  
  // Função para gerar a mensagem final
  const generateMessage = () => {
    const { name, currentPrice, originalPrice, productUrl } = productData;
    const storeTypeText = getStoreTypeText();
    
    let priceText = '';
    
    // Calcular preço com desconto se fornecido
    const finalPrice = discountPercentage ? calculateDiscountedPrice(currentPrice) : currentPrice;
    
    // Verificar se há um desconto real
    if (originalPrice && hasRealDiscount(originalPrice, finalPrice)) {
      priceText = `✅  ~De R$ ${formatPrice(originalPrice)}~ por *R$ ${formatPrice(finalPrice)}*`;
    } else {
      // Caso não tenha desconto, mostrar apenas o preço atual
      priceText = `✅  Por R$ ${formatPrice(finalPrice)}`;
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
    message += `\n🛒 ${productUrl}\n\n☑️ Link do grupo: https://linktr.ee/gdfit`;
    
    return message;
  };
  
  // Gerar a mensagem sempre que os dados mudarem
  useEffect(() => {
    if (productData) {
      const message = generateMessage();
      setFinalMessage(message);
    }
  }, [productData, couponCode, storeType, vendorName, discountPercentage]);
  
  return (
    <div className="message-preview">
      {productData ? generateMessage() : 'Preencha os dados acima para visualizar a mensagem.'}
    </div>
  );
};

export default MessagePreview;