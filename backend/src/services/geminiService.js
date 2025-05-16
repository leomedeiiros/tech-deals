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
    
    // Construir um prompt mais específico e otimizado para geração de imagens
    let enhancedPrompt = `Generate a photorealistic product image of ${productData.name}. `;
    
    // Adicionar detalhes do prompt original se fornecido
    if (prompt) {
      enhancedPrompt += prompt;
    }
    
    // Adicionar instruções específicas para imagens de alta qualidade
    enhancedPrompt += ` The image should be high-quality, professional product photography, studio lighting, on a light blue-white gradient background, with sharp focus on the product. No text or watermarks. Show the product from a slightly angled view to highlight its features.`;
    
    // URL correta do Gemini 2.0 Flash conforme documentação
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
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
        temperature: 0.4,
        topP: 0.95,
        topK: 32,
        maxOutputTokens: 2048
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };
    
    console.log('Enviando requisição para Gemini 2.0 Flash com prompt:', enhancedPrompt);
    
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
      
      // Imprimir os tipos de partes recebidas para diagnóstico
      console.log('Partes da resposta:', parts.map(part => {
        return Object.keys(part).join(', ');
      }));
      
      // Procurar por parte que contém imagem
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
      } else {
        // Verificar se a resposta contém texto (resposta de erro ou texto em vez de imagem)
        const textPart = parts.find(part => part.text);
        if (textPart && textPart.text) {
          const textResponse = textPart.text;
          console.log('Resposta de texto recebida:', textResponse);
          
          // Se o texto indicar que o modelo não consegue gerar imagens, tente usar outro modelo
          if (textResponse.includes("não posso gerar imagens") || 
              textResponse.includes("não consigo gerar imagens") || 
              textResponse.includes("cannot generate images")) {
            
            console.log('Tentando alternativa com modelo imagegeneration@002...');
            // Tentar usar a API Imagen como fallback
            return await generateImageWithImagenAPI(enhancedPrompt, apiKey, productData);
          }
          
          return {
            success: false,
            error: `O modelo retornou texto em vez de uma imagem: "${textResponse.substring(0, 150)}..."`,
            fullText: textResponse
          };
        }
      }
    }
    
    console.error('Falha ao extrair imagem da resposta do Gemini');
    console.error('Resposta recebida:', JSON.stringify(response.data, null, 2));
    
    // Tentar alternativa com a API Imagen como último recurso
    return await generateImageWithImagenAPI(enhancedPrompt, apiKey, productData);
    
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

// Função de backup usando a API Imagen
async function generateImageWithImagenAPI(prompt, apiKey, productData) {
  try {
    console.log('Tentando gerar imagem com a API Imagen...');
    
    // URL da API Imagen
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@002:generateContent?key=${apiKey}`;
    
    // Preparar payload para a API Imagen
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 32,
        sampleCount: 1
      }
    };
    
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
        
        console.log(`Imagem gerada pela API Imagen e salva como: ${filename}`);
        
        // Retornar URL da imagem gerada
        return {
          success: true,
          imageUrl: `/uploads/${filename}`
        };
      }
    }
    
    console.error('Falha ao extrair imagem da resposta da API Imagen');
    console.error('Resposta recebida:', JSON.stringify(response.data, null, 2));
    
    return {
      success: false,
      error: 'Não foi possível gerar a imagem com nenhum dos modelos disponíveis.'
    };
  } catch (error) {
    console.error('Erro ao gerar imagem com API Imagen:', error);
    
    return {
      success: false,
      error: `Falha ao utilizar API Imagen: ${error.message}`
    };
  }
}