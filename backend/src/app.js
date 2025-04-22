// backend/src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração do CORS para permitir requisições do Vercel e localhost
app.use(cors({
  origin: ['https://guerra-dealsfit.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Configurar caminho para arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rotas API
app.use('/api', apiRoutes);

// Rota raiz para verificar se o servidor está funcionando
app.get('/', (req, res) => {
  res.send('API GeraPromo está funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});