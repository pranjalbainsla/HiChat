const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const http = require('http')
const User = require('./models/user.js')
const decodeToken = require('./utils/decodeToken.js')

const { Server } = require('socket.io')
const Message = require('./models/message.js')
const Room = require('./models/room.js')
require('./utils/passportConfig.js')

const app = express()
const server = http.createServer(app) // this is you just creating a server instance (only http requests accepted till this point)

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ['GET', 'POST']
    }
}) //now the same server handles http requests via express AND websocket connections via socket.io

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());


io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

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
    return next();
  } catch (err) {
    return next(new Error("Authentication failed"));
  }
});



io.on('connection', (socket)=>{
    console.log("New client:" , socket.user.name);
    socket.join(socket.user.id.toString()); // puts the user's connection into a private room named after his id, so if you wanna to send
    //messages to this user, send to this room
    console.log(`${socket.user.name} has joined room, userId: ${socket.user.id.toString()}`)
 
  
    socket.emit('sendUser', socket.user);

    socket.on("join_room", async (room)=>{     
        socket.join(room)
        console.log(`${socket.user.name} joined the room: ${room}`) 
    })

    socket.on('send_message', async (data)=>{
        const roomId = data.room;
        console.log(roomId);
        const tempId = data.id;
        
        try{
            const savedMessage = await Message.create({
                room: roomId, // we get the roomid
                sender: data.sender._id, //saving sender by _id (as per the user model)
                text: data.text
            })
            //update room's lastMessage field to the id of this message
            await Room.updateOne(
                { roomId: roomId },
                { $set: { lastMessage: savedMessage._id}}
            );
            const populated = await savedMessage.populate('sender', '_id name');
            const room = await Room.findOne({ roomId }).populate("members", "userId").lean();

            room.members.forEach(m => {
                if(m.userId.toString() !== socket.user.id.toString()){
                    io.to(m.userId.toString()).emit("receive_message", {
                        ...populated.toObject(),
                        tempId
                    });
                }
            })
            io.to(socket.user.id.toString()).emit("receive_message", {
                ...populated.toObject(),
                tempId
            });
            
        }catch(err){
            console.log("error:", err.message)
        }
    })
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

    socket.on('disconnect', ()=>{
        console.log(`client with name: ${socket.user.name} disconnected`)
    })

})


//Connecting to database
mongoose.connect(process.env.LOCAL_MONGO_DB) //
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
const { SocketAddress } = require('net')
app.use('/api/chat', chatRouter)

const PORT = 3000;
server.listen(PORT, ()=> console.log(`server listening at ${PORT}`));