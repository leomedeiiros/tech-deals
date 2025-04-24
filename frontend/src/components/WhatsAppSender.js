import React from 'react';

const WhatsAppSender = ({ message, className }) => {
  const handleDirectWhatsApp = () => {
    if (!message) {
      alert("Nenhuma mensagem para compartilhar.");
      return;
    }

    // Preparar a mensagem garantindo que as quebras de linha sejam preservadas
    const messageText = message.replace(/\n/g, '\n'); // Garantir quebras de linha corretas
    
    // Verificar se é dispositivo móvel
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Tentar método direto do WhatsApp
      try {
        // Em dispositivos Android, tentar abrir diretamente com whatsapp://
        const androidIntent = `whatsapp://send?text=${encodeURIComponent(messageText)}`;
        window.location.href = androidIntent;
        
        // Verificar após um tempo curto se ainda estamos na página
        setTimeout(() => {
          if (document.hasFocus()) {
            // Fallback para iOS (usando link universal)
            const universalLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
            window.location.href = universalLink;
          }
        }, 500);
      } catch (e) {
        // Fallback se o método direto falhar
        const universalLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
        window.location.href = universalLink;
      }
    } else {
      // Em desktop, abrir o WhatsApp Web
      window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(messageText)}`, '_blank');
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