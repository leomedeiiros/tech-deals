// frontend/src/api.js
import axios from 'axios';

// URL do backend no Render
const API_URL = 'https://gerador-promocoes-backend.onrender.com/api';

export const scrapeProduct = async (url) => {
  try {
    const response = await axios.post(`${API_URL}/scrape`, { url });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const uploadImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  try {
    const response = await axios.post(`${API_URL}/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const sendWhatsAppMessage = async (message, chatName) => {
  try {
    const response = await axios.post(`${API_URL}/send-whatsapp`, { message, chatName });
    return response.data;
  } catch (error) {
    throw error;
  }
};