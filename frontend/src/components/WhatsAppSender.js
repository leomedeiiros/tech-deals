// frontend/src/components/WhatsAppSender.js
import React from 'react';

const WhatsAppSender = ({ message, className }) => {
  const handleDirectWhatsApp = () => {
    // Encoda mensagem para URL
    const encodedMessage = encodeURIComponent(message);
    
    // Abre o WhatsApp web ou app com a mensagem preenchida
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };
  
  return (
    <button 
      className={className || "share-btn"}
      onClick={handleDirectWhatsApp}
      disabled={!message}
    >
      <i className="fab fa-whatsapp"></i>
      Compartilhar no WhatsApp
    </button>
  );
};

export default WhatsAppSender;