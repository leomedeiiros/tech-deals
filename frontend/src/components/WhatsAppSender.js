import React from 'react';

const WhatsAppSender = ({ message, selectedImageFile, className }) => {

  const handleShare = async () => {
    if (!message) {
      alert("Nenhuma mensagem para compartilhar.");
      return;
    }

    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

    if (navigator.share && isMobile) {
      try {
        const shareData = {
          title: 'Confira esta promoção!',
          text: message
        };

        // Se houver uma imagem selecionada (File), adicionar ao compartilhamento
        if (selectedImageFile instanceof File) {
          shareData.files = [selectedImageFile];
        }

        await navigator.share(shareData);
        console.log("Compartilhado com sucesso!");
      } catch (err) {
        console.error("Erro ao compartilhar:", err);
      }
    } else {
      // Fallback para wa.me (só texto, sem imagem)
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
  };

  return (
    <button 
      className={className || "share-btn"}
      onClick={handleShare}
      disabled={!message}
    >
      <i className="fab fa-whatsapp"></i>
      Compartilhar no WhatsApp
    </button>
  );
};

export default WhatsAppSender;
