//for testing purposes

const User = require('./models/user.js')

async function getAllUsers(){
    const users = await User.find()
    console.log(users)
}

const Message = require('./models/message.js');
async function getAllMessages(){
    const messages = await Message.find()
    console.log(messages)
}

getAllMessages()