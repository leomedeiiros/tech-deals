// frontend/src/App.js
import React, { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';
import LinkForm from './components/LinkForm';
import MessagePreview from './components/MessagePreview';
import { API_BASE_URL } from './config';

function App() {
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [storeType, setStoreType] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [finalMessage, setFinalMessage] = useState('');
  
  // Estado para a imagem personalizada
  const [customImage, setCustomImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null); // Para armazenar o objeto File da imagem
  
  // Estados para controlar quais seções estão abertas
  const [infoSectionOpen, setInfoSectionOpen] = useState(true);
  const [storeSectionOpen, setStoreSectionOpen] = useState(false);
  const [imageSectionOpen, setImageSectionOpen] = useState(false);
  
  // Referência para rolar a tela até a seção de configurações quando dados forem carregados
  const configSectionRef = useRef(null);
  
  const handleProductDataReceived = (data) => {
    setProductData(data);
    
    // Determinar store type inicial baseado nos dados
    if (data.vendor === 'Amazon') {
      setStoreType('amazon');
    } else if (data.isOfficialStore) {
      setStoreType('loja_oficial');
    } else {
      setStoreType('loja_validada');
    }
  };
  
  const toggleSection = (section) => {
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
  
  // Função para renderizar um campo de texto com botão de limpar
  const renderInputWithClear = (value, setValue, placeholder, type = 'text') => {
    return (
      <div className="input-clear-wrapper">
        <input 
          type={type}
          className="form-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
        />
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

    // Verificar se o navegador suporta Web Share API com arquivos
    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          text: finalMessage,
          files: [imageFile]
        });
        return; // Se compartilhou com sucesso, encerra a função
      } catch (err) {
        console.warn('Compartilhamento com arquivo falhou:', err);
        // Continua para o fallback abaixo
      }
    }
    
    // Fallback para o método tradicional (apenas texto)
    const encodedMessage = encodeURIComponent(finalMessage);
    
    // Verificar se é dispositivo móvel
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Em dispositivos móveis, tentar abrir diretamente o app
      window.location.href = `whatsapp://send?text=${encodedMessage}`;
      
      // Como fallback, se após 1 segundo o usuário ainda estiver na página,
      // redirecionar para o api.whatsapp.com que funciona melhor em iOS
      setTimeout(() => {
        if (document.hasFocus()) {
          window.location.href = `https://api.whatsapp.com/send?text=${encodedMessage}`;
        }
      }, 1000);
    } else {
      // Em desktop, abrir o WhatsApp Web
      window.open(`https://web.whatsapp.com/send?text=${encodedMessage}`, '_blank');
    }
  };
  
  return (
    <div className="container">
      <header className="app-header">
        <h1 className="app-title">GeraPromo</h1>
        <span className="app-version">Versão 2.1</span>
      </header>
      
      <div className="main-card">
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
          <i className={`fas fa-chevron-down chevron-icon ${infoSectionOpen ? 'open' : ''}`}></i>
        </div>
        
        {infoSectionOpen && (
          <div className="section-content">
            <div className="form-group">
              <label className="form-label">Link da promoção</label>
              <LinkForm 
                onProductDataReceived={handleProductDataReceived}
                setLoading={setLoading}
                setError={setError}
                setCouponCode={setCouponCode}
              />
              {error && <div className="error-message">{error}</div>}
            </div>
            
            <div className="form-group">
              <label className="form-label">Cupom de desconto <span className="optional-tag">Opcional</span></label>
              {renderInputWithClear(couponCode, setCouponCode, "Insira um cupom de desconto")}
            </div>
            
            <div className="form-group">
              <label className="form-label">
                <i className="fas fa-percent"></i> Porcentagem de Desconto Manual <span className="optional-tag">Opcional</span>
              </label>
              {renderInputWithClear(discountPercentage, setDiscountPercentage, "Ex: 20 (sem o símbolo %)", "number")}
            </div>
          </div>
        )}
        
        {/* Seção de Tipo de Loja */}
        <div className="section-header" onClick={() => toggleSection('store')}>
          <div className="section-title">
            <i className="fas fa-store"></i>
            Tipo de Loja
          </div>
          <i className={`fas fa-chevron-down chevron-icon ${storeSectionOpen ? 'open' : ''}`}></i>
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
                <i className="fas fa-shield-alt"></i> Loja Validada
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
          <i className={`fas fa-chevron-down chevron-icon ${imageSectionOpen ? 'open' : ''}`}></i>
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
        
        {loading ? (
          <div className="section-content" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
              <div className="loading"></div>
              <span>Carregando informações do produto...</span>
            </div>
          </div>
        ) : productData ? (
          <div className="preview-section">
            <p className="preview-label">Prévia da mensagem:</p>
            
            <MessagePreview 
              productData={productData}
              couponCode={couponCode}
              storeType={storeType}
              vendorName={vendorName}
              discountPercentage={discountPercentage}
              customImage={customImage}
              setFinalMessage={setFinalMessage}
            />
            
            <div className="actions-row">
              <button 
                className="copy-btn"
                onClick={() => navigator.clipboard.writeText(finalMessage)}
              >
                <i className="fas fa-copy"></i>
                Copiar Mensagem
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
    </div>
  );
}

export default App;