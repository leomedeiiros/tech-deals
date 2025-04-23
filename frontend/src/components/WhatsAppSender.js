import React from 'react';

const WhatsAppSender = ({ message, className }) => {
  const handleDirectWhatsApp = () => {
    if (!message) {
      alert("Nenhuma mensagem para compartilhar.");
      return;
    }

    const encodedMessage = encodeURIComponent(message);
    
    // Verificar se é dispositivo móvel
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Em dispositivos móveis, tentar abrir diretamente o app
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
      window.open(`https://web.whatsapp.com/send?text=${encodedMessage}`, '_blank');
    }
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