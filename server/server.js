const express = require('express')
const mongoose = require('mongoose')
//cors is cross origin resource sharing, here you can decide whivh domains are allowed to call your api endpoints, so like maybe only your frontend domain
const cors = require('cors')
require('dotenv').config()
const http = require('http')
/*A **module** is a single file or small unit of code you import (built-in or custom).
A **library** is a collection of many modules packaged together to provide bigger features.
Example: `http` is a module; Express is a library made of many modules.
so here you're just loading that module http
*/

const { Server } = require('socket.io')
const Message = require('./models/message.js')
const Room = require('./models/room.js')
require('./utils/passportConfig.js')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ['GET', 'POST']
    }
})

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

//attaching a user to our socket (so later, we can just access the user by socket.user)
const User = require('./models/user.js')
const decodeToken = require('./utils/decodeToken.js')
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  try {
    const decoded = decodeToken(token);
    const user = await User.findById(decoded.id)

    if(!user){
        socket.emit("auth-error", "user not found");
        return next(new Error("user not found"));
    }

    socket.user = user; // attach user info to socket
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message, "#2");
    socket.emit("auth-error", "authentication failed");
    next(new Error("Authentication failed"));
  }
});

//map to store active rooms
const activeRooms = new Map();

io.on('connection', (socket)=>{
    console.log("New client:" , socket.user.name);
    socket.join(socket.user._id.toString());
    console.log(`${socket.user.name} has joined room, userId: ${socket.user._id.toString()}`)

    //sending user info to the frontend as soon as we connect (this is the entire user object)
    socket.emit('sendUser', socket.user);

    socket.on("join_room", async (room)=>{
        activeRooms.set(socket.user._id.toString(), room); //mapping the current user with the active room (id)
        console.log(`mapping ${socket.user._id} with room id ${room}`);
        socket.join(room)
        console.log(`${socket.user.name} joined the room: ${room}`)

        //when a user joins a room, set his/her lastReadMessage as the latest message in the room and update the unread count to 0
        const latestMessage = await Message.findOne({ room }).sort({ createdAt: -1 });
        await Room.updateOne(
            { _id: room, "members.userId": socket.user._id},
            { $set: { "members.$.lastReadMessageId": latestMessage?._id, "members.$.unreadCount": 0 } }
        )
        // Emit to ONLY this user that their unreadCount is now 0
        io.to(socket.user._id.toString()).emit("room_updated", {
            roomId: room,
            unreadCount: 0,
            lastMessage: latestMessage || null
        });
        
    })

    socket.on('send_message', async (data)=>{
        const newMessage = new Message({
            room: data.room, // we get the roomid
            sender: data.sender, //saving sender by _id (as per the user model)
            text: data.text
        })
        try{
            const savedMessage = await newMessage.save()

            const rr = await Room.findOne({ _id: data.room});
            if(!rr){
                console.log("room not found");
                return;
            }
            const receiver = rr.members.find(member => member.userId.toString() !== data.sender.toString()); // stores the receiver obj
            if(!receiver){
                console.log("receiver not found");
                return;
            }
            await Room.updateOne(
                { _id: data.room, "members.userId": receiver},
                { $set: { "members.$.lastDeliveredMessageId": savedMessage._id }}
            );

            let updatedUnreadCount = 0;
            //console.log(`receiver ${receiver} and roomid ${data.room}`);

            if(activeRooms.get(receiver.userId.toString()) === data.room){
                console.log("receiver is active")
                await Room.updateOne(
                    { _id: data.room, "members.userId": receiver.userId},
                    { $set : { "members.$.lastReadMessageId": savedMessage._id, "members.$.unreadCount": 0 }}
                );
            }else{
                console.log("receiver offline")
                const result = await Room.findOneAndUpdate(
                    { _id: data.room, "members.userId": receiver.userId },
                    { $inc: { "members.$.unreadCount": 1 }},
                    { new: true}
                );
                if (!result) {
                    console.log("No matching room/member found for unread update");
                    return;
                }
                updatedUnreadCount = result.members.find(
                    m => m.userId.toString() === receiver.userId.toString()
                ).unreadCount;

            }
            io.to(data.room).emit("receive_message", savedMessage); //sends it to everyone in the room


            io.to(receiver.userId.toString()).emit("room_updated", {
                roomId: data.room,
                unreadCount: updatedUnreadCount,
                lastMessage: savedMessage
            });
            console.log(
                "Message from", socket.user.name, 
                "to room", data.room, 
                "Unread for receiver:", updatedUnreadCount
            );
                
            
        }catch(err){
            console.log("error:", err.message)
        }
        /// optionally send to sender as well
	    /*socket.emit("receive_message", savedMessage);*/
    })
    socket.on('user-typing', (room)=>{
        socket.to(room).emit('sender-typing', room);
    })
    socket.on("message_seen", async ({ roomId, userId, lastSeenMessageId }) => {
        // Update DB: set lastReadMessageId for this user in this room
        await Room.updateOne(
            { _id: roomId, "memberss.userId": userId },
            { $set: { "members.$.lastReadMessageId": lastSeenMessageId } }
        );

        // Notify the sender in real time
        io.to(roomId).emit("message_seen_update", {
            roomId,
            userId,
            lastSeenMessageId,
        });
    });


    socket.on('disconnect', ()=>{
        activeRooms.delete(socket.user._id);
        console.log(`client with name: ${socket.user.name} disconnected`)
    })
})


//Connecting to databaseur
mongoose.connect(process.env.MONGO_URI) //
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log(`server listening at ${PORT}`));