const express = require('express')
const router = express.Router()
const verifyToken = require('../middleware/middleware.js')
const User = require('../models/user.js')
const Message = require('../models/message.js')
const Room = require('../models/room.js')

router.get('/', verifyToken, (req, res)=>{
    res.json({ user: req.user })
})
//fetch users for the search bar
router.get('/users', verifyToken, async (req, res)=>{
    const search = req.query.search;

    try{
        const users = await User.find({ _id: { $ne: req.user.id }, name: { $regex: search, $options: 'i' }}).select('name _id');
        res.json(users);
    }catch(err){
        console.error(err.message);
        res.status(500).json({ message: "error finding matching users" })
    }
    
})
//send a message
router.post('/sendmessage', verifyToken, async (req, res)=>{
    const { room, text } = req.body
    const sender = req.user.id;

    /*console.log('received', {room, sender, text})*/

    try{
        const newMessage = new Message({ room, sender, text });
        await newMessage.save();
        res.status(201).json({newMessage})
    }catch(err){
        console.error(err.message)
        res.status(500).json({ message: "Couldnt save message"})
    }
})
//get all messages from a room
router.get('/messages/:room', verifyToken, async (req, res)=>{
    const room = req.params.room

    try{
        const messages = await Message.find({ room }).sort({ timestamp: 1 }).populate('sender', 'name _id').lean();
        res.status(200).json( messages )
    }catch(err){
        res.status(500).json({ message: "Error fetching messages" })
    }

})
//get all rooms user is a member of
router.get('/rooms', verifyToken, async (req, res)=>{
    const userId = req.user.id;

    try{
        const rooms = await Room.find({ 'members.userId' : userId }).populate('members.userId', 'name _id').lean();
        const roomIds = rooms.map((room)=>room._id); //array of roomids

        const lastMessages = await Message.aggregate([
            { $match: { room: { $in : roomIds }}},
            { $sort : { createdAt : -1 }}, //sort in descending order (except in this case, descending means newest to oldest)
            { $group: {
                _id : '$room',
                lastMessage : { $first: '$$ROOT' }
            }}
        ]);
        const messageMap = new Map();
        lastMessages.forEach((m)=>messageMap.set(m._id.toString(), m.lastMessage)); /// room id (string) <-> last message as document

        const result = rooms.filter((room) => room.members.length === 2).map((room)=>{
            //console.log("Room members:", room.members);
            
            const otherUser = room.members.find(p => p.userId._id.toString() !== userId.toString());
            const user = room.members.find(p => p.userId._id.toString() === userId.toString());
            return {
                roomId: room._id,
                user,
                otherUser,
                lastMessage: messageMap.get(room._id.toString()) || null
            }
        });
        res.json(result); //basically sends the array of room objects (where this obj contains id, otheruser and the lastmessage)
        console.log("sending room data")
    }catch(err){
        console.error(err.message)
        res.status(500).json({ message: "server error" });
    }

})
//start a new chat or open an existing chat
router.post('/rooms', verifyToken, async (req, res)=>{
    ///make a new room and send that room as a rooms array object ( like you sent in the get method)

    const userId = req.user.id;
    const { otherUserId } = req.body; // send this from the frontend in headers (update: we sent it in the body)

    try{
        const newRoom = new Room({ 
            members: [
                {userId},
                {userId: otherUserId} 
            ] 
        });
        await newRoom.save();
        const otherUser = await User.findById(otherUserId).select('name _id').lean();

        res.status(201).json( { roomId: newRoom._id, otherUser, lastMessage: { text: "", createdAt: "", sender: null}});
        
    }catch(err){
        console.error(err.message);
        res.status(500).json({ message: "cant start a new chat with this user"});
    }
});
module.exports = router