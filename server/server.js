const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const http = require('http')
const { Server } = require('socket.io')
const Message = require('./models/message.js')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
})

app.use(cors())
app.use(express.json())

//attaching a user to our socket (so later, we can just access the user by socket.user)
const User = require('./models/user.js')
const decodeToken = require('./utils/decodeToken.js')
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  try {
    const decoded = decodeToken(token);
    const user = await User.findById(decoded.id)

    if(!user) return next(new Error("user not found"));

    socket.user = user; // attach user info to socket
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message, "#2");
    next(new Error("Authentication failed"));
  }
});

io.on('connection', (socket)=>{
    console.log("New client:" , socket.user.name)

    //sending user info to the frontend as soon as we connect (this is the entire user object)
    socket.emit('sendUser', socket.user);

    socket.on("join_room", (room)=>{
        socket.join(room)
        console.log(`${socket.user.name} joined the room: ${room}`)
    })

    socket.on('send_message', async (data)=>{
        const newMessage = new Message({
            room: data.room,
            sender: data.sender, //saving sender by _id (as per the user model)
            text: data.text
        })
        try{
            const savedMessage = await newMessage.save()

            io.to(data.room).emit("receive_message", savedMessage); //sends it to everyone in the room
            console.log("message sent by ", socket.user.name, "saying: ", newMessage.text, "saved to", data.room)
            
        }catch(err){
            console.log("error:", err.message)
        }
        /// optionally send to sender as well
	    /* socket.emit("receive_message", savedMessage);*/
    })

    socket.on('disconnected', ()=>{
        console.log(`client with name: ${socket.user.name} disconnected`)
    })
})


//Connecting to database
mongoose.connect('mongodb://localhost/users')
const db = mongoose.connection 
db.on('error', (err)=>console.error(err))
db.once('open', ()=>console.log("Connected to db succesfully"))

//Routers
const authRouter = require('./routes/auth.js')
app.use('/api/auth', authRouter)

const chatRouter = require('./routes/chat.js')
app.use('/api/chat', chatRouter)



server.listen(3000, ()=> console.log("server listening at 3000"))