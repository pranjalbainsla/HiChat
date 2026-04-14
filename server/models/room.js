const mongoose = require('mongoose')

const RoomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    members: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            lastDeliveredMessageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Message',
                default: null
            },
            lastReadMessageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Message',
                default: null
            }
        }
    ],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }
}, { timestamps: true }).index({ "members.userId": 1 });

module.exports = mongoose.model('Room', RoomSchema);