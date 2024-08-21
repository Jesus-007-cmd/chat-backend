const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

const cors = require('cors');


app.use(cors({
  origin: 'https://chat-react-backend-mysql.netlify.app', // La URL de tu aplicación en Netlify
}));

// Configuración de la conexión a MySQL
const connection = mysql.createConnection({
  host: process.env.DB_HOST, // Dirección IP de la instancia MySQL
  user: process.env.DB_USER, // Usuario de la base de datos
  password: process.env.DB_PASSWORD, // Contraseña de la base de datos
  database: process.env.DB_NAME, // Nombre de la base de datos
  connectTimeout: 10000 // 10 segundos de tiempo de espera
});

connection.connect((err) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos MySQL');
});

// Middleware para manejar JSON
app.use(express.json());

// Endpoint para enviar un mensaje
app.post('/chats', (req, res) => {
  const { username, message, color } = req.body;

  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Guarda el mensaje en MySQL (MySQL generará automáticamente el id)
  const query = 'INSERT INTO messages (username, message, timestamp, color) VALUES (?, ?, ?, ?)';
  connection.query(query, [username || 'Anónimo', message, timestamp, color], (err, results) => {
    if (err) {
      console.error('Error guardando el mensaje en la base de datos:', err);
      return res.status(500).json({ error: 'Error guardando el mensaje en la base de datos' });
    }

    // Obtener el id generado automáticamente
    const newMessage = {
      id: results.insertId,  // Usamos el id auto-incremental generado por MySQL
      username: username || 'Anónimo',
      message,
      timestamp,
      color,
    };

    // Emitir el mensaje a través de WebSockets
    io.emit('newMessage', newMessage);
    res.status(201).json(newMessage);
  });
});

// Endpoint para obtener los últimos 100 mensajes
app.get('/chats', (req, res) => {
  const { limit } = req.query;

  let query = 'SELECT * FROM messages ORDER BY id DESC LIMIT 100';
  if (limit === 'all') {
    query = 'SELECT * FROM messages ORDER BY id ASC';
  }

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo los mensajes:', err);
      return res.status(500).json({ error: 'Error obteniendo los mensajes' });
    }

    res.status(200).json(results.reverse()); // Para devolver los mensajes en orden ascendente
  });
});

// Endpoint para obtener nuevos mensajes después de un ID específico
app.get('/chats/new', (req, res) => {
  const { lastReadId } = req.query;

  if (!lastReadId) {
    return res.status(400).json({ error: 'lastReadId is required' });
  }

  // Consulta para obtener mensajes con un id mayor al último leído
  const query = 'SELECT * FROM messages WHERE id > ? ORDER BY id ASC';

  connection.query(query, [lastReadId], (err, results) => {
    if (err) {
      console.error('Error obteniendo los mensajes nuevos:', err);
      return res.status(500).json({ error: 'Error obteniendo los mensajes nuevos' });
    }

    res.status(200).json(results);
  });
});

// Configuración de WebSocket para manejar mensajes en tiempo real
io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado');

  // Puedes manejar eventos adicionales si es necesario
  socket.on('disconnect', () => {
    console.log('Usuario desconectado');
  });
});

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
