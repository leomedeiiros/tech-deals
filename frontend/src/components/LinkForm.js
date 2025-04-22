// frontend/src/components/LinkForm.js
import React, { useState } from 'react';
import axios from 'axios';

const LinkForm = ({ onProductDataReceived, setLoading, setError }) => {
  const [url, setUrl] = useState('');
  
  const handleExtract = async () => {
    if (!url) {
      setError('Por favor, insira um link de afiliado.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.post('http://localhost:3001/api/scrape', { url });
      onProductDataReceived(response.data);
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
    <>
      <input 
        type="url"
        className="form-input"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Cole o link da Amazon ou Mercado Livre"
      />
      <button 
        className="btn extract-btn"
        onClick={handleExtract}
      >
        <i className="fas fa-search"></i>
        Extrair Dados
      </button>
    </>
  );
};

export default LinkForm;