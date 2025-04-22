import React from 'react';

const WhatsAppSender = ({ message, className }) => {
  const handleDirectWhatsApp = () => {
    if (!message) return;

    const encodedMessage = encodeURIComponent(message);

    // Detectar se é mobile
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

    const whatsappUrl = isMobile 
      ? `whatsapp://send?text=${encodedMessage}`   // Força abrir no app do celular
      : `https://web.whatsapp.com/send?text=${encodedMessage}`;  // Desktop

    window.open(whatsappUrl, '_blank');
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
