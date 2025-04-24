import React from 'react';

const WhatsAppSender = ({ message, className, imageFile }) => {
  const handleDirectWhatsApp = async () => {
    if (!message) {
      alert("Nenhuma mensagem para compartilhar.");
      return;
    }

    // Verificar se é dispositivo móvel
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    // Tentar usar Web Share API com arquivos primeiro, se houver arquivo
    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          text: message,
          files: [imageFile]
        });
        return; // Se compartilhou com sucesso, encerra a função
      } catch (err) {
        console.warn('Compartilhamento com arquivo falhou:', err);
        // Continua para o fallback abaixo
      }
    }
    
    // Para dispositivos móveis sem anexos
    if (isMobile) {
      // Em dispositivos iOS, use URL específica
      if (isIOS) {
        // No iOS tente abrir direto no app com URL específica
        window.location.href = `whatsapp://send?text=${encodeURIComponent(message)}`;
        
        // Fallback se a página ainda estiver ativa após um curto período
        setTimeout(() => {
          if (document.hasFocus()) {
            window.location = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
          }
        }, 300);
      } else {
        // Para Android, use primeiro a URL do aplicativo
        window.location.href = `whatsapp://send?text=${encodeURIComponent(message)}`;
        
        // Fallback para o link web
        setTimeout(() => {
          if (document.hasFocus()) {
            window.location = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
          }
        }, 300);
      }
    } else {
      // Em desktop, abrir o WhatsApp Web
      window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
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