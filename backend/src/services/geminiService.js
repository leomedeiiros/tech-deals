// backend/src/services/geminiService.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Função para gerar nome de arquivo único
const generateUniqueFilename = () => {
  return crypto.randomBytes(16).toString('hex') + '.jpg';
};

// Função principal para gerar imagem através do Gemini
exports.generateImage = async (prompt, apiKey, productData) => {
  try {
    console.log('Gerando imagem com IA para o produto:', productData.name);
    
    // Construir um prompt enriquecido usando as informações do produto
    let enhancedPrompt = prompt;
    
    // Se o prompt não menciona especificamente o produto, adicione o nome do produto
    if (!prompt.toLowerCase().includes(productData.name.toLowerCase())) {
      enhancedPrompt = `${prompt} | Produto: ${productData.name}`;
    }
    
    // URL da API Gemini para geração de imagens
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
    
    // Preparar payload para a API
    const payload = {
      contents: [
        {
          parts: [
            { text: enhancedPrompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192
      }
    };
    
    console.log('Enviando requisição para Gemini...');
    
    // Fazer requisição para a API
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Verificar se a resposta contém dados de imagem
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts) {
      
      const parts = response.data.candidates[0].content.parts;
      
      // Procurar parte que contém imagem
      const imagePart = parts.find(part => part.inlineData && part.inlineData.data);
      
      if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
        // Extrair dados da imagem (base64)
        const imageData = imagePart.inlineData.data;
        
        // Decodificar base64 para buffer de imagem
        const imageBuffer = Buffer.from(imageData, 'base64');
        
        // Definir caminho para salvar a imagem
        const uploadDir = path.join(__dirname, '../../uploads');
        
        // Verificar se diretório existe, se não, criar
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Gerar nome de arquivo único
        const filename = generateUniqueFilename();
        const imagePath = path.join(uploadDir, filename);
        
        // Salvar imagem no servidor
        fs.writeFileSync(imagePath, imageBuffer);
        
        console.log(`Imagem gerada e salva como: ${filename}`);
        
        // Retornar URL da imagem gerada
        return {
          success: true,
          imageUrl: `/uploads/${filename}`
        };
      }
    }
    
    // Falha ao encontrar dados de imagem na resposta
    console.error('Falha ao extrair imagem da resposta do Gemini');
    return {
      success: false,
      error: 'Não foi possível gerar a imagem. O modelo não retornou uma imagem válida.'
    };
  } catch (error) {
    console.error('Erro ao gerar imagem com IA:', error);
    
    // Formatar mensagem de erro para ser mais útil
    let errorMessage = 'Falha ao gerar imagem com IA.';
    
    if (error.response) {
      // O servidor respondeu com um código de status fora do intervalo 2xx
      console.error('Erro na resposta:', error.response.data);
      
      // Verificar se há mensagem de erro específica da API Gemini
      if (error.response.data && error.response.data.error) {
        errorMessage = `Erro da API Gemini: ${error.response.data.error.message || 'Erro desconhecido'}`;
      }
    } else if (error.request) {
      // A requisição foi feita mas não recebeu resposta
      errorMessage = 'Sem resposta do servidor Gemini. Verifique sua conexão.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};