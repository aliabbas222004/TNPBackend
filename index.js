require('dotenv').config()
const connectToMongo=require('./dbSetUp');
const express=require('express');
const http = require('http');
const app=express()
const cors =require('cors');
const port=process.env.PORT;
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
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

    socket.to(roomId).emit('user-connected', socket.id);

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
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use("/student",require('./routes/student'));
app.use("/company",require('./routes/company'));
app.use("/admin",require('./routes/admin'));

app.get("/",(req,res)=>{
    res.send("Hello")
})

app.listen(port,()=>{
    console.log("App running on port : ",port)
})

connectToMongo();