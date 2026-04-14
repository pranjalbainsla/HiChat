const mongoose = require('mongoose')
//only allowing google auth rn
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    googleId: {
        type: String,
        required: true
    }
}).index({ name: 1})

module.exports = mongoose.model('User', userSchema)