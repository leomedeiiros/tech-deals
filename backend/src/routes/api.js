const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');

// Rota para extrair informações do produto
router.post('/scrape', scrapeController.scrapeProduct);

// Rota para enviar mensagem pelo WhatsApp
router.post('/send-whatsapp', scrapeController.sendWhatsApp);

module.exports = router;
