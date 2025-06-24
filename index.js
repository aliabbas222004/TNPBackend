require('dotenv').config();
const connectToMongo = require('./dbSetUp');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const port = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://campusconnect-tnp.onrender.com',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const room = rooms.get(roomId);
    room.add(socket.id);
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

    if (room.size === 2) {
      const [first, second] = [...room];
      io.to(first).emit('you-are-caller');
      io.to(second).emit('you-are-callee');
    }


    socket.on('disconnect', () => {
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(roomId);
      }
      socket.to(roomId).emit('user-disconnected', socket.id);
      console.log(`User ${socket.id} disconnected from room ${roomId}`);
    });
  });

  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });
});

// Middleware
app.use(cors({ origin: 'https://campusconnect-tnp.onrender.com' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/student", require('./routes/student'));
app.use("/company", require('./routes/company'));
app.use("/admin", require('./routes/admin'));

app.get("/", (req, res) => {
  res.send("Hello");
});

// Start server
connectToMongo();

server.listen(port, () => {
  console.log("App running on port:", port);
});
