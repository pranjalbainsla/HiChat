const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
    room :{
        type: String,
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
    deliveredTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true }).index({ "room": 1 });

module.exports = mongoose.model('Message', messageSchema)