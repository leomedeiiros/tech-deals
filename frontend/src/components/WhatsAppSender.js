import React from 'react';

const WhatsAppSender = ({ message, className }) => {
  const handleDirectWhatsApp = () => {
    if (!message) {
      alert("Nenhuma mensagem para compartilhar.");
      return;
    }

    const encodedMessage = encodeURIComponent(message);

    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

    if (isMobile) {
      // Tenta abrir o app diretamente
      const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
      window.location.href = whatsappUrl;

      // Como fallback, após 2 segundos, tenta abrir o wa.me
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      }, 2000);
    } else {
      // Desktop sempre vai pro wa.me
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
