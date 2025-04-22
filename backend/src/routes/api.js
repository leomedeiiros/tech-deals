// backend/src/routes/api.js
const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Certifique-se de que a pasta uploads existe
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração para upload de imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Usar timestamp e extensão original do arquivo
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: function (req, file, cb) {
    // Verificar tipo de arquivo
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens nos formatos JPG, PNG ou GIF são permitidas!'));
  }
});

// Rota para extrair informações do produto
router.post('/scrape', scrapeController.scrapeProduct);

// Rota para enviar mensagem pelo WhatsApp
router.post('/send-whatsapp', scrapeController.sendWhatsApp);

// Rota para upload de imagem
router.post('/upload-image', upload.single('image'), scrapeController.uploadImage);

module.exports = router;