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
    console.log("search value =", search);

    try{
        const users = await User.find({ _id: { $ne: req.user.id }, name: { $regex: `^${search}`, $options: 'i' }}).select('name _id').limit(10).lean();
        res.json(
            users.map(u => ({
                id: u._id,
                name: u.name
            }))
        );
    }catch(err){
        console.error(err.message);
        res.status(500).json({ message: "error finding matching users" })
    }
    
})
//send a message
router.post('/sendmessage', verifyToken, async (req, res)=>{
    const { room, text } = req.body
    const sender = req.user.id;

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
        const messages = await Message.find({ room }).sort({ createdAt: 1 }).populate('sender', 'name _id').populate('deliveredTo', '_id').populate('readBy', '_id').lean();
        res.status(200).json( messages )
    }catch(err){
        res.status(500).json({ message: "Error fetching messages" })
    }

})
//get all rooms user is a member of
router.get('/rooms', verifyToken, async (req, res)=>{
    const userId = req.user.id;

    try{
        
        const rooms = await Room.find({ 'members.userId' : userId }).populate('lastMessage', '_id text sender createdAt').lean();
    
        const otherUserIds = rooms.map((room)=> {
            return room.members.find(p => p.userId.toString() !== userId.toString()).userId;
        })
        const users = await User.find({ _id: { $in: otherUserIds } }).lean();
        const userMap = {}
        users.forEach((u)=>userMap[u._id.toString()] = u)

        const result = await Promise.all(
            rooms.map(async (room) => {
          
                const otherUserId = room.members.find(
                    p => p.userId.toString() !== userId.toString()
                ).userId.toString();
                console.log("otheruserId: ", otherUserId);
                const myData = room.members.find(
                    p => p.userId.toString() === userId.toString()
                );
                const count = await Message.countDocuments({
                                room: room.roomId,
                                _id: { $gt: myData.lastReadMessageId }
                                });

                return {
                    roomId: room.roomId,
                    myUnreadCount: count,
                    otherUser: {
                        id: otherUserId,
                        name: userMap[otherUserId].name
                    },
                    lastMessage: room.lastMessage
                };
        }));
        res.json(result); //basically sends the array of room objects (where this obj contains id, otheruser and the lastmessage)
        console.log("sending room data")
    }catch(err){
        console.error("Error message (hehe):", err.message)
        res.status(500).json({ message: "server error" });
    }

})
//start a new chat or open an existing chat
router.post('/rooms', verifyToken, async (req, res)=>{
    ///make a new room and send that room as a rooms array object ( like you sent in the get method)

    const userId = req.user.id;
    const { otherUserId } = req.body; // send this from the frontend in headers (update: we sent it in the body)
    if (userId.toString() === otherUserId.toString()) {
        return res.status(400).json({ message: "Cannot chat with yourself" });
    }
    try{
        const roomId = [userId.toString(), otherUserId.toString()].sort().join("_");
        const newRoom = await Room.findOneAndUpdate(
            { roomId },
            {
                $setOnInsert: {
                roomId,
                members: [{ userId }, { userId: otherUserId }]
                }
            },
            { upsert: true, new: true }
        );
 

        /*const [userDoc, otherUserDoc] = await Promise.all([
            User.findById(userId).select('_id name').lean(),
            User.findById(otherUserId).select('_id name').lean()
        ]);

        const user = {
        userId: userDoc,
        lastDeliveredMessageId: null,
        lastReadMessageId: null,
        unreadCount: 0
        };

        const otherUser = {
        userId: otherUserDoc,
        lastDeliveredMessageId: null,
        lastReadMessageId: null,
        unreadCount: 0
        };*/
        const otherUser = await User.findById(otherUserId).lean();
        if (!otherUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(201).json({
            roomId: newRoom.roomId,
            myUnreadCound: 0,
            otherUser: {
                id: otherUser._id,
                name: otherUser.name
            },
            lastMessage: newRoom.lastMessage
        });

        
    }catch(err){
        console.error(err.message);
        res.status(500).json({ message: "cant start a new chat with this user"});
    }
});
module.exports = router