const mongoose = require('mongoose')

const RoomSchema = new mongoose.Schema({
    members: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);