// frontend/src/App.js
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import LinkForm from './components/LinkForm';
import MessagePreview from './components/MessagePreview';
import { API_BASE_URL } from './config';

function App() {
  // Carregar dados salvos do localStorage
  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Erro ao carregar ${key} do localStorage:`, error);
      return defaultValue;
    }
  };

  // Função para salvar no localStorage
  const saveToLocalStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Erro ao salvar ${key} no localStorage:`, error);
    }
  };

  // Histórico de links usados
  const [recentLinks, setRecentLinks] = useState(loadFromLocalStorage('recentLinks', []));
  const [recentCoupons, setRecentCoupons] = useState(loadFromLocalStorage('recentCoupons', []));
  const [recentDiscounts, setRecentDiscounts] = useState(loadFromLocalStorage('recentDiscounts', []));
  const [recentDiscountValues, setRecentDiscountValues] = useState(loadFromLocalStorage('recentDiscountValues', []));

  const [url, setUrl] = useState('');
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [storeType, setStoreType] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [discountValue, setDiscountValue] = useState(''); // Novo estado para desconto em R$
  const [finalMessage, setFinalMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Estado para a imagem personalizada
  const [customImage, setCustomImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null); // Para armazenar o objeto File da imagem
  
  // Estados para controlar quais seções estão abertas
  const [infoSectionOpen, setInfoSectionOpen] = useState(true);
  const [storeSectionOpen, setStoreSectionOpen] = useState(true); // Agora inicia expandido
  const [imageSectionOpen, setImageSectionOpen] = useState(false);
  
  // Referência para a prévia da mensagem editável
  const messagePreviewRef = useRef(null);
  const mainCardRef = useRef(null);

  // Salvar histórico quando valores mudam
  useEffect(() => {
    saveToLocalStorage('recentLinks', recentLinks);
  }, [recentLinks]);

  useEffect(() => {
    saveToLocalStorage('recentCoupons', recentCoupons);
  }, [recentCoupons]);

  useEffect(() => {
    saveToLocalStorage('recentDiscounts', recentDiscounts);
  }, [recentDiscounts]);

  useEffect(() => {
    saveToLocalStorage('recentDiscountValues', recentDiscountValues);
  }, [recentDiscountValues]);
  
  // Função para adicionar ao histórico sem duplicar
  const addToHistory = (value, setter, currentArray, maxItems = 10) => {
    if (!value || value.trim() === '') return;
    
    // Remover duplicata se existir
    const newArray = currentArray.filter(item => item !== value);
    
    // Adicionar novo valor no início
    newArray.unshift(value);
    
    // Limitar tamanho
    if (newArray.length > maxItems) {
      newArray.pop();
    }
    
    // Atualizar estado
    setter(newArray);
  };

  const handleProductDataReceived = (data, url) => {
    // Arredondar preços para baixo (remover centavos)
    if (data && data.currentPrice) {
      data.currentPrice = roundPriceDown(data.currentPrice);
    }
    if (data && data.originalPrice) {
      data.originalPrice = roundPriceDown(data.originalPrice);
    }
    
    setProductData(data);
    
    // Adicionar URL ao histórico 
    if (url) {
      addToHistory(url, setRecentLinks, recentLinks);
    }
    
    // Verificar se o link é do Mercado Livre para definir corretamente o tipo de loja
    const isMercadoLivre = 
      (url && (url.includes('mercadolivre') || url.includes('mercadolibre'))) ||
      (data.vendor && data.vendor.toLowerCase().includes('mercado livre')) ||
      (data.platform && typeof data.platform === 'string' && 
      (data.platform.toLowerCase().includes('mercadolivre') || 
       data.platform.toLowerCase().includes('mercadolibre')));
       
    const isAmazon = 
      (url && (url.includes('amazon.com') || url.includes('amazon.com.br'))) ||
      (data.vendor && data.vendor.toLowerCase().includes('amazon')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('amazon'));

    const isCentauro = 
      (url && url.includes('centauro.com.br')) ||
      (data.vendor && data.vendor.toLowerCase().includes('centauro')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('centauro'));

    const isNetshoes = 
      (url && url.includes('netshoes.com.br')) ||
      (data.vendor && data.vendor.toLowerCase().includes('netshoes')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('netshoes'));

    const isNike = 
      (url && (url.includes('nike.com.br') || url.includes('nike.com/br'))) ||
      (data.vendor && data.vendor.toLowerCase().includes('nike')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('nike'));
      
    // DEFINIR TIPO DE LOJA PADRÃO
    if (isAmazon) {
      setStoreType('amazon');
    } else if (isMercadoLivre) {
      // Para o Mercado Livre, definir SEMPRE como "loja_oficial" por padrão
      setStoreType('loja_oficial');
    } else if (isCentauro || isNetshoes || isNike) {
      // Para lojas esportivas, definir como "loja_oficial" por padrão
      setStoreType('loja_oficial');
    } else {
      setStoreType('loja_validada');
    }
    
    // Resetar edição quando novos dados são carregados
    setIsEditing(false);

    // Rolar para a seção de preview após o carregamento
    setTimeout(() => {
      if (mainCardRef.current) {
        const previewSection = mainCardRef.current.querySelector('.preview-section');
        if (previewSection) {
          previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 300);
  };
  
  // Função para arredondar preço para baixo (remover centavos)
  const roundPriceDown = (price) => {
    if (!price) return price;
    
    // Se contém vírgula, pega apenas a parte antes da vírgula
    if (price.includes(',')) {
      return price.split(',')[0];
    }
    
    // Se contém ponto, assume que é separador decimal
    if (price.includes('.')) {
      return price.split('.')[0];
    }
    
    return price;
  };
  
  const toggleSection = (section, e) => {
    // Prevenir propagação do evento para evitar que o clique chegue ao elemento pai
    if (e) {
      e.stopPropagation();
    }
    
    switch(section) {
      case 'info':
        setInfoSectionOpen(!infoSectionOpen);
        break;
      case 'store':
        setStoreSectionOpen(!storeSectionOpen);
        break;
      case 'image':
        setImageSectionOpen(!imageSectionOpen);
        break;
      default:
        break;
    }
  };
  
  // Handler para cupom de desconto
  const handleCouponChange = (value) => {
    setCouponCode(value);
    if (value) {
      addToHistory(value, setRecentCoupons, recentCoupons);
    }
  };
  
  // Handler para porcentagem de desconto
  const handleDiscountChange = (value) => {
    setDiscountPercentage(value);
    // Se preencheu porcentagem, limpa o valor de desconto em R$
    if (value) {
      setDiscountValue('');
      addToHistory(value, setRecentDiscounts, recentDiscounts);
    }
  };
  
  // Handler para valor de desconto em R$
  const handleDiscountValueChange = (value) => {
    setDiscountValue(value);
    // Se preencheu valor em R$, limpa a porcentagem
    if (value) {
      setDiscountPercentage('');
      addToHistory(value, setRecentDiscountValues, recentDiscountValues);
    }
  };
  
  // Função para carregar imagem personalizada
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Verificar tamanho e tipo do arquivo
    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('A imagem não pode ser maior que 5MB');
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Apenas imagens nos formatos JPG, JPEG, PNG e GIF são permitidas');
      return;
    }
    
    // Guardar o objeto File para uso posterior com a Web Share API
    setImageFile(file);
    
    // Upload da imagem para o servidor
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      setUploadingImage(true);
      setError('');
      
      const response = await axios.post(`${API_BASE_URL}/api/upload-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setCustomImage(response.data.imageUrl);
      } else {
        setError('Erro ao fazer upload da imagem');
      }
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      setError(
        error.response?.data?.error ||
        'Falha ao fazer upload da imagem. Tente novamente.'
      );
    } finally {
      setUploadingImage(false);
    }
  };
  
  // Função para remover a imagem personalizada
  const removeCustomImage = () => {
    setCustomImage('');
    setImageFile(null);
  };
  
  // Habilitar modo de edição para a mensagem
  const enableEditing = () => {
    if (!isEditing && messagePreviewRef.current) {
      setIsEditing(true);
      messagePreviewRef.current.setAttribute('contenteditable', 'true');
      messagePreviewRef.current.focus();
    }
  };
  
  // Desabilitar modo de edição para a mensagem
  const disableEditing = () => {
    if (isEditing && messagePreviewRef.current) {
      setIsEditing(false);
      messagePreviewRef.current.setAttribute('contenteditable', 'false');
      // Atualizar a mensagem final com o conteúdo editado
      setFinalMessage(messagePreviewRef.current.innerText);
    }
  };
  
  // Função para renderizar um campo de texto com botão de limpar e datalist
  const renderInputWithClear = (value, setValue, placeholder, type = 'text', listId = null, historyItems = []) => {
    return (
      <div className="input-clear-wrapper">
        <input 
          type={type}
          className="form-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          list={listId}
        />
        {listId && historyItems.length > 0 && (
          <datalist id={listId}>
            {historyItems.map((item, index) => (
              <option key={index} value={item} />
            ))}
          </datalist>
        )}
        {value && (
          <button 
            className="clear-input-btn" 
            onClick={() => setValue('')}
            type="button"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
    );
  };
  
 // Compartilhar mensagem e imagem no WhatsApp usando Web Share API
const shareWhatsApp = async () => {
  if (!finalMessage) {
    setError('Nenhuma mensagem para compartilhar.');
    return;
  }
  
  // Se estamos em modo de edição, desabilite primeiro para garantir que o conteúdo foi salvo
  if (isEditing) {
    disableEditing();
  }

  // Obter a mensagem atual (possivelmente editada)
  const messageToShare = messagePreviewRef.current ? messagePreviewRef.current.innerText : finalMessage;
  
  // Tentar usar Web Share API se estiver disponível (para texto ou para arquivos)
  if (navigator.share) {
    try {
      // Se tiver imagem, tenta compartilhar com ela
      if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          text: messageToShare,
          files: [imageFile]
        });
      } else {
        // Caso contrário, compartilha apenas o texto
        await navigator.share({
          text: messageToShare
        });
      }
      return; // Se compartilhou com sucesso, encerra a função
    } catch (err) {
      console.warn('Compartilhamento falhou:', err);
      // Continua para o fallback abaixo
    }
  }
  
  // Fallback para métodos tradicionais se Web Share API não estiver disponível ou falhar
  // Verificar se é dispositivo móvel
  const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Em dispositivos móveis, tentar abrir diretamente o app
    const encodedMessage = encodeURIComponent(messageToShare);
    window.location.href = `whatsapp://send?text=${encodedMessage}`;
    
    // Como fallback, se após 1 segundo o usuário ainda estiver na página,
    // redirecionar para o wa.me que funciona melhor em iOS
    setTimeout(() => {
      if (document.hasFocus()) {
        window.location.href = `https://api.whatsapp.com/send?text=${encodedMessage}`;
      }
    }, 1000);
  } else {
    // Em desktop, abrir o WhatsApp Web
    window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(messageToShare)}`, '_blank');
  }
};
  
  // Copiar mensagem para o clipboard
  const copyMessage = () => {
    // Se estamos em modo de edição, desabilite primeiro para garantir que o conteúdo foi salvo
    if (isEditing) {
      disableEditing();
    }

    // Obter a mensagem atual (possivelmente editada)
    const messageToShare = messagePreviewRef.current ? messagePreviewRef.current.innerText : finalMessage;
    
    if (!messageToShare) {
      setError('Nenhuma mensagem para copiar.');
      return;
    }
    
    navigator.clipboard.writeText(messageToShare)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => {
          setCopySuccess(false);
        }, 3000);
      })
      .catch((err) => {
        console.error('Erro ao copiar: ', err);
        setError('Falha ao copiar para a área de transferência');
      });
  };

  // Função para extrair dados do produto
  const handleExtract = async () => {
    const inputEl = document.querySelector('input[type="url"]');
    if (!inputEl || !inputEl.value) {
      setError('Por favor, insira um link de afiliado.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // URL correta do backend no Render
      const response = await axios.post(`${API_BASE_URL}/api/scrape`, { 
        url: inputEl.value 
      });
      
      // Passar os dados do produto e a URL usada para processamento
      handleProductDataReceived(response.data, inputEl.value);
    } catch (error) {
      console.error('Erro ao obter dados do produto:', error);
      setError(
        error.response?.data?.error ||
        'Falha ao obter dados do produto. Verifique o link e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container">
      <header className="app-header">
        <h1 className="app-title">GeraPromo</h1>
        <span className="app-version">Versão 2.5</span>
      </header>
      
      <div className="main-card" ref={mainCardRef}>
        <div className="card-header">
          <h2 className="card-title">Gerador de Mensagens Promocionais</h2>
          <p className="card-subtitle">Crie mensagens atrativas para compartilhar promoções no WhatsApp</p>
        </div>
        
        {/* Seção de Informações da Promoção */}
        <div className="section-header" onClick={() => toggleSection('info')}>
          <div className="section-title">
            <i className="fas fa-link"></i>
            Informações da Promoção
          </div>
          <div className="chevron-container" onClick={(e) => toggleSection('info', e)}>
            <i className={`fas fa-chevron-down chevron-icon ${infoSectionOpen ? 'open' : ''}`}></i>
          </div>
        </div>
        
        {infoSectionOpen && (
          <div className="section-content">
            <div className="form-group">
              <label className="form-label">Link da promoção</label>
              <div className="input-clear-wrapper">
                <input
                  type="url"
                  className="form-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Cole o link da Amazon ou Mercado Livre"
                  list="url-history"
                />
                {recentLinks && recentLinks.length > 0 && (
                  <datalist id="url-history">
                    {recentLinks.map((link, index) => (
                      <option key={index} value={link} />
                    ))}
                  </datalist>
                )}
                {url && (
                  <button 
                    className="clear-input-btn" 
                    onClick={() => setUrl('')}
                    type="button"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Cupom de desconto <span className="optional-tag">Opcional</span></label>
              {renderInputWithClear(
                couponCode, 
                handleCouponChange, 
                "Insira um cupom de desconto", 
                "text", 
                "coupon-history", 
                recentCoupons
              )}
            </div>
            
            <div className="discount-fields-grid">
              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-percent"></i> Desconto % <span className="optional-tag">Opcional</span>
                </label>
                {renderInputWithClear(
                  discountPercentage, 
                  handleDiscountChange, 
                  "Ex: 20 (sem o símbolo %)", 
                  "number", 
                  "discount-history", 
                  recentDiscounts
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-dollar-sign"></i> Desconto em R$ <span className="optional-tag">Opcional</span>
                </label>
                {renderInputWithClear(
                  discountValue, 
                  handleDiscountValueChange, 
                  "Ex: 50", 
                  "number", 
                  "discount-value-history", 
                  recentDiscountValues
                )}
              </div>
            </div>
            
            {(discountPercentage && discountValue) && (
              <div className="discount-warning">
                <i className="fas fa-exclamation-triangle"></i> Atenção: Use apenas um tipo de desconto por vez.
              </div>
            )}
          </div>
        )}
        
        {/* Seção de Tipo de Loja */}
        <div className="section-header" onClick={() => toggleSection('store')}>
          <div className="section-title">
            <i className="fas fa-store"></i>
            Tipo de Loja
          </div>
          <div className="chevron-container" onClick={(e) => toggleSection('store', e)}>
            <i className={`fas fa-chevron-down chevron-icon ${storeSectionOpen ? 'open' : ''}`}></i>
          </div>
        </div>
        
        {storeSectionOpen && (
          <div className="section-content">
            <div className="store-type-group">
              <button 
                className={`store-type-btn ${storeType === 'amazon' ? 'active' : ''}`}
                onClick={() => setStoreType('amazon')}
              >
                <i className="fab fa-amazon"></i> Amazon
              </button>
              <button 
                className={`store-type-btn ${storeType === 'loja_oficial' ? 'active' : ''}`}
                onClick={() => setStoreType('loja_oficial')}
              >
                <i className="fas fa-check-circle"></i> Loja Oficial
              </button>
              <button 
                className={`store-type-btn ${storeType === 'catalogo' ? 'active' : ''}`}
                onClick={() => setStoreType('catalogo')}
              >
                <i className="fas fa-list"></i> Catálogo
              </button>
              <button 
                className={`store-type-btn ${storeType === 'loja_validada' ? 'active' : ''}`}
                onClick={() => setStoreType('loja_validada')}
              >
                <i className="fas fa-shield-alt"></i> Loja validada
              </button>
              <button 
                className={`store-type-btn ${storeType === '' ? 'active' : ''}`}
                onClick={() => setStoreType('')}
              >
                <i className="fas fa-times"></i> Nenhum
              </button>
            </div>
            
            {storeType === 'catalogo' && (
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label className="form-label">Nome do Vendedor:</label>
                {renderInputWithClear(vendorName, setVendorName, "Insira o nome do vendedor")}
              </div>
            )}
          </div>
        )}
        
        {/* Nova Seção: Imagem Personalizada */}
        <div className="section-header" onClick={() => toggleSection('image')}>
          <div className="section-title">
            <i className="fas fa-image"></i>
            Imagem Personalizada
            <span className="optional-tag">Opcional</span>
          </div>
          <div className="chevron-container" onClick={(e) => toggleSection('image', e)}>
            <i className={`fas fa-chevron-down chevron-icon ${imageSectionOpen ? 'open' : ''}`}></i>
          </div>
        </div>
        
        {imageSectionOpen && (
          <div className="section-content">
            <div className="form-group">
              <label className="form-label">Upload de imagem</label>
              <p className="form-description">
                Carregue uma imagem personalizada para sua promoção. 
                Se não for fornecida, será usada a imagem do produto.
              </p>
              <div className="web-share-info">
                <p className="web-share-info-text">
                  <i className="fas fa-info-circle"></i> Em dispositivos móveis compatíveis, a imagem será anexada junto com a mensagem.
                </p>
              </div>
              
              <div className="file-upload-container">
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/gif,image/jpg" 
                  onChange={handleImageUpload}
                  id="image-upload"
                  className="file-input"
                  disabled={uploadingImage}
                />
              </div>
              
              {uploadingImage && (
                <div className="upload-status">
                  <div className="loading"></div>
                  <span>Enviando imagem...</span>
                </div>
              )}
              
              {customImage && (
                <div className="custom-image-preview">
                  <img src={customImage} alt="Imagem personalizada" className="uploaded-image" />
                  <button onClick={removeCustomImage} className="btn-sm btn-danger">
                    <i className="fas fa-trash-alt"></i> Remover
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botão Extrair Dados - Com destaque especial para garantir visibilidade */}
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(88, 101, 242, 0.1)'
        }}>
          <button
            className="btn extract-btn"
            onClick={handleExtract}
            disabled={loading}
            style={{
              background: loading ? '#3e4adf' : 'linear-gradient(90deg, #5865f2, #3e4adf)',
              padding: '18px',
              fontSize: '1.15rem',
              fontWeight: 'bold',
              boxShadow: '0 6px 15px rgba(88, 101, 242, 0.5)',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              border: 'none',
              color: 'white',
              borderRadius: '12px',
              cursor: loading ? 'default' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {loading ? (
              <>
                <div className="loading"></div>
                Extraindo dados...
              </>
            ) : (
              <>
                <i className="fas fa-search"></i>
                Extrair Dados
              </>
            )}
          </button>
          {error && <div className="error-message">{error}</div>}
        </div>
        
        {loading ? (
          <div className="section-content" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
              <div className="loading"></div>
              <span>Carregando informações do produto...</span>
            </div>
          </div>
        ) : productData ? (
          <div className="preview-section">
            <p className="preview-label">Prévia da mensagem</p>
            
            {/* Imagem da Prévia */}
            {(customImage || (productData && productData.imageUrl)) && (
              <div className="preview-image-container">
                <img 
                  src={customImage || productData.imageUrl} 
                  alt={productData.name || 'Imagem da promoção'} 
                  className="preview-image"
                />
              </div>
            )}
            
            {/* Mensagem editável */}
            <div 
              ref={messagePreviewRef}
              className={`message-preview ${isEditing ? 'editing' : ''}`}
              onClick={enableEditing}
              onBlur={disableEditing}
              contentEditable={isEditing}
              suppressContentEditableWarning={true}
            >
              <MessagePreview 
                productData={productData}
                couponCode={couponCode}
                storeType={storeType}
                vendorName={vendorName}
                discountPercentage={discountPercentage}
                discountValue={discountValue}
                setFinalMessage={setFinalMessage}
              />
            </div>
            
            {/* Texto de instrução para editar */}
            <div className="edit-instructions">
              <i className="fas fa-edit"></i> Clique na mensagem para editar
            </div>
            
            <div className="actions-row">
              <button 
                id="copyButton"
                className={`copy-btn ${copySuccess ? 'success-animation' : ''}`}
                onClick={copyMessage}
              >
                <i className={`${copySuccess ? 'fas fa-check' : 'fas fa-copy'}`}></i>
                {copySuccess ? 'Copiado!' : 'Copiar Mensagem'}
              </button>
              
              <button 
                className="share-btn"
                onClick={shareWhatsApp}
              >
                <i className="fab fa-whatsapp"></i>
                Compartilhar no WhatsApp
              </button>
            </div>
          </div>
        ) : null}
      </div>
      
      <div className="watermark" style={{ textAlign: 'center', margin: '20px 0', color: 'var(--text-secondary)' }}>
        GeraPromo &copy; 2025 - Todos os direitos reservados
      </div>
    </div>
  );
}

export default App;