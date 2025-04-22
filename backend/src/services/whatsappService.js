// backend/src/services/whatsappService.js
const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.sendMessage = async (message, chatName) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    // Remover a referência ao executável externo
    ignoreDefaultArgs: ['--disable-extensions']
  });
  
  try {
    const page = await browser.newPage();
    
    // Acessar WhatsApp Web
    await page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle0' });
    
    // Aguardar até que o usuário faça login escaneando o QR code (timeout de 2 minutos)
    await page.waitForSelector('._3uIPm', { timeout: 120000 });
    
    // Esperar mais um pouco para garantir que a interface carregou completamente
    await wait(3000);
    
    // Procurar o chat pelo nome
    const chatSearch = await page.$('._2vDPL');
    await chatSearch.click();
    await page.keyboard.type(chatName);
    await wait(1000);
    
    // Clicar no primeiro resultado da pesquisa
    const firstChat = await page.$('._8nE1Y');
    if (firstChat) {
      await firstChat.click();
      await wait(1000);
      
      // Digitar a mensagem na caixa de texto
      const messageBox = await page.$('.iq0m558w');
      await messageBox.click();
      
      // Para mensagens com formatação, é melhor colar o conteúdo
      await page.evaluate((text) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);
        const event = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true
        });
        document.querySelector('.iq0m558w').dispatchEvent(event);
      }, message);
      
      await wait(1000);
      
      // Enviar a mensagem
      await page.keyboard.press('Enter');
      
      // Aguardar um momento para garantir que a mensagem foi enviada
      await wait(2000);
      
      return true;
    } else {
      throw new Error('Chat não encontrado');
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem pelo WhatsApp:', error);
    throw new Error('Falha ao enviar mensagem pelo WhatsApp');
  } finally {
    // Fechar o navegador imediatamente
    await browser.close();
  }
};