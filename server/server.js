const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const http = require('http')
const { createAdapter } = require('@socket.io/redis-adapter')
const Redis = require('ioredis')

const { metricsHandler, activeConnections, messagesTotal, fullLatency, dbLatency } = require('./metrics');

const Message = require('./models/message.js')
const Room = require('./models/room.js')
const decodeToken = require('./utils/decodeToken.js')
const { Server } = require('socket.io')
require('./utils/passportConfig.js')

const app = express()
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
const server = http.createServer(app) // this is you just creating a server instance (only http requests accepted till this point)

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ['GET', 'POST']
    }
}) //now the same server handles http requests via express AND websocket connections via socket.io
const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
app.get('/metrics', metricsHandler);

io.engine.on("connection", (raw) => {
  console.log("engine connected");
});
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

   if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    const decoded = decodeToken(token);
    /* const user = await User.findById(decoded.id) // DB hit on every connection -> can become slow at scale 
    if(!user){
        return next(new Error("User not found"));
    } */
    socket.user = {
        id: decoded.id,
        name: decoded.name
    };
    console.log("user is:", socket.user.name);
    return next();
  } catch (err) {
    console.log('token expired');
    return next(new Error("Authentication failed"));
  }
});



io.on('connection', (socket)=>{
    console.log(`New connection on worker ${process.pid}`);
    activeConnections.inc();

    socket.join(socket.user.id.toString()); // puts the user's connection into a private room named after his id, so if you wanna to send
    //messages to this user, send to this room
    console.log(`${socket.user.name} has joined room, userId: ${socket.user.id.toString()}`)
 
  
    socket.emit('sendUser', socket.user);

    socket.on("join_room", async (room)=>{     
        socket.join(room)
        console.log(`${socket.user.name} joined the room: ${room}`) 
    })

    socket.on('send_message', async (data) => {
        const [user1, user2] = data.room.split("_");
        const tempId = data.id;
        const emitStart = Date.now();
        // generate real _id BEFORE saving
        const newId = new mongoose.Types.ObjectId();

        // emit immediately with the real _id
        const messageToEmit = {
            _id: newId,        // real ID, frontend can use this straight away
            room: data.room,
            sender: data.sender,
            text: data.text,
            createdAt: Date.now(),
            tempId,
        };

        io.to(user1).emit('receive_message', messageToEmit);
        io.to(user2).emit('receive_message', messageToEmit);
        const emitTime = Date.now() - emitStart;

        const dbStart = Date.now();

        Message.create({
            _id: newId,
            room: data.room,
            sender: data.sender._id,
            text: data.text,
        }).then(saved => {
            const dbTime = Date.now() - dbStart; // ✅ write is done, measure here
            
            if (dbTime > 100) {
                console.log(`SLOW db write: ${dbTime}ms`);
            }

            Room.updateOne(
                { roomId: data.room },
                { $set: { lastMessage: saved._id } },
                { upsert: true }
            );
        }).catch(err => {
            const dbTime = Date.now() - dbStart; // how long before it failed
            console.error(`DB write failed after ${dbTime}ms:`, err.message);
            messagesTotal.inc({ status: 'failed' });
        });

        if (emitTime > 100) {
            console.log(`SLOW: emit=${emitTime}ms`);
        }

        messagesTotal.inc({ status: 'success' });
    });
    socket.on("delivered", async ({ msgId, userId })=>{
        await Message.updateOne(
            { _id: msgId },
            { $addToSet: { deliveredTo: userId } }
        )
        // Emit update to notify others in the room
        const message = await Message.findById(msgId);
  
        io.to(message.room).emit("message_delivered", { msgId, userId});
    })
    socket.on("read", async({ userId, lastMessageId, roomId })=>{
        await Message.updateMany(
            { 
                room: roomId,
                sender: { $ne: userId },
                _id : { $lte : lastMessageId }},
            { $addToSet: { readBy: userId }}
        )
        //update the room to contain the lastReadMessageid of user with id: userId as this msg
        await Room.updateOne(
            { roomId: roomId, "members.userId": userId },
            { $set: { "members.$.lastReadMessageId": lastMessageId } }
        );
        // Emit update to notify others in the room
        io.to(roomId).emit("messages_read", { lastMessageId, userId, roomId });
    })
    socket.on('user-typing', (room)=>{
        socket.to(room).emit('sender-typing', room);
    })
    socket.on('error', (err) => {
        console.log(`socket error: ${socket.user?.id} message: ${err.message}`);
    });
    socket.on('disconnect', (reason) => {
        console.log(`disconnect: ${socket.user?.id} reason: ${reason}`);
    });

    

})


//Connecting to database
mongoose.connect(process.env.DATABASE_URL, {
  maxPoolSize: 100,
});
const db = mongoose.connection 
db.on('error', (err)=>console.error(err))
db.once('open', ()=>console.log("Connected to MongoDB Atlas")) //rn its local db only

const passport = require('passport');
app.use(passport.initialize());

/*Routers
Separation of Concerns (SoC):
A design principle where a system is split into **distinct sections**, each responsible for one clear task, so changes in one part don’t break others.

A router in Express is a mini-module that groups related endpoints together (e.g., all `/auth` routes).
It’s basically a small “sub-server” that handles specific paths and is plugged into the main server.

*/
const authRouter = require('./routes/auth.js')
app.use('/api/auth', authRouter)

const chatRouter = require('./routes/chat.js')
app.use('/api/chat', chatRouter)
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

server.listen(process.env.PORT, ()=> console.log(`server listening at ${process.env.PORT}`));