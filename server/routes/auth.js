const express = require('express')
const router = express.Router()
const User = require('../models/user.js')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')


router.post('/signup', async (req, res)=>{
    try {
        const userExists = await User.findOne({ email: req.body.email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });
    } catch (err) {
        return res.status(500).json({ message: 'Error checking user existence' });
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(req.body.password, 10);
    } catch (err) {
        return res.status(500).json({ message: 'Password hashing failed' });
    }

    try {
        const user = new User({ name: req.body.name, email: req.body.email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        res.status(500).json({ message: 'Saving user failed' });
    }
})

router.post('/login', async (req, res)=>{
    const {email, password} = req.body
    try{
        const user =  await User.findOne({ email })
        if(!user) return res.json({ message: "Invalid email, sign-in instead?" })
        
        const match = await bcrypt.compare(password, user.password)
        if(!match) return res.json({ message: "Wrong password" })

        const token = jwt.sign({ id: user._id, name: user.name }, process.env.SecretKey, { 'expiresIn': '30m'})

        res.json({ token })
        
    } catch(err){
        console.error(err)
        res.status(500).json({ message: 'failed to generate token' })
    }
    
})

module.exports = router