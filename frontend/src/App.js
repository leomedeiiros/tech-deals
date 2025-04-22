// frontend/src/App.js
import React, { useState, useRef } from 'react';
import LinkForm from './components/LinkForm';
import MessagePreview from './components/MessagePreview';
import axios from 'axios';
import './App.css';

function App() {
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customImage, setCustomImage] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [storeType, setStoreType] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [finalMessage, setFinalMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  
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
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Apenas imagens JPG, PNG ou GIF são permitidas.');
      return;
    }
    
    // Validar tamanho do arquivo (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB.');
      return;
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      setUploadingImage(true);
      setError('');
      
      const response = await axios.post('http://localhost:3001/api/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setCustomImage(response.data.imageUrl);
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      setError('Falha ao fazer upload da imagem. Tente novamente.');
    } finally {
      setUploadingImage(false);
    }
  };
  
  return (
    <div className="container">
      <header className="app-header">
        <h1 className="app-title">GeraPromo</h1>
        <span className="app-version">Versão 2.0</span>
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
              {/* Apenas um campo de entrada para o link */}
              <LinkForm 
                onProductDataReceived={handleProductDataReceived}
                setLoading={setLoading}
                setError={setError}
                setCouponCode={setCouponCode}
                setCustomImage={setCustomImage}
              />
              {error && <div className="error-message">{error}</div>}
            </div>
            
            <div className="form-group">
              <label className="form-label">Cupom de desconto <span className="optional-tag">Opcional</span></label>
              <input 
                type="text"
                className="form-input"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Insira um cupom de desconto"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">
                <i className="fas fa-percent"></i> Porcentagem de Desconto Manual <span className="optional-tag">Opcional</span>
              </label>
              <input 
                type="number"
                className="form-input"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                placeholder="Ex: 20 (sem o símbolo %)"
              />
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
                <input 
                  type="text"
                  className="form-input"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Insira o nome do vendedor"
                />
              </div>
            )}
          </div>
        )}
        
        {/* Seção de Imagem do Produto */}
        <div className="section-header" onClick={() => toggleSection('image')}>
          <div className="section-title">
            <i className="fas fa-image"></i>
            Imagem do Produto
            <span className="optional-tag">Opcional</span>
          </div>
          <i className={`fas fa-chevron-down chevron-icon ${imageSectionOpen ? 'open' : ''}`}></i>
        </div>
        
        {imageSectionOpen && (
          <div className="section-content">
            <div className="form-group">
              <div className="file-input-container">
                <input 
                  type="file"
                  accept="image/*"
                  className="file-input"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
                {uploadingImage && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                    <div className="loading"></div>
                    <span>Enviando imagem...</span>
                  </div>
                )}
              </div>
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
            {(customImage || productData.imageUrl) && (
              <img 
                src={customImage || productData.imageUrl} 
                alt={productData.name} 
                className="product-image"
              />
            )}
            
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
                onClick={() => {
                  const encodedMessage = encodeURIComponent(finalMessage);
                  window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
                }}
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