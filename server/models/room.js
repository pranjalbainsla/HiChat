const mongoose = require('mongoose')

const RoomSchema = new mongoose.Schema({
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
            },
            unreadCount: { type: Number, default: 0 }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);