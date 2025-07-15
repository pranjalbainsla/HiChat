const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
    room :{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        require: true
    },
    sender :{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text :{
        type: String,
        required: true
    },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema)