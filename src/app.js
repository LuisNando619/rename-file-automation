const express = require('express');
const net = require('net');
const path = require('path');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/documents', documentRoutes);
app.use(express.static(path.resolve(__dirname, '../public')));
app.use('/processed', express.static(path.resolve(__dirname, '../processed')));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

function getAvailablePort(startPort = 3000, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    const tryPort = (port, attempt) => {
      const tester = net.createServer();

      tester.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempt < maxAttempts) {
          return tryPort(port + 1, attempt + 1);
        }

        reject(error);
      });

      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });

      tester.listen(port);
    };

    tryPort(startPort, 1);
  });
}

async function startServer() {
  const port = process.env.PORT || 3000;
  const selectedPort = await getAvailablePort(Number(port), 15).catch(() => Number(port));

  const server = app.listen(selectedPort, () => {
    console.log(`API rodando em http://localhost:${selectedPort}`);
  });

  server.on('error', (error) => {
    console.error('Erro ao iniciar servidor:', error.message);
    process.exit(1);
  });
}

startServer();
