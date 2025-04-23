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
  
  // Estados para controlar quais seções estão abertas
  const [infoSectionOpen, setInfoSectionOpen] = useState(true);
  const [storeSectionOpen, setStoreSectionOpen] = useState(false);
  
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
      default:
        break;
    }
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