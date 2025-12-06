const express = require('express')
const router = express.Router()
const User = require('../models/user.js')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const passport = require('passport')

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
//passport.authenticate('google') sends the user to google's login page
//scope is what info we need from google

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

// Google sends the user back to this callback URL after login.
// Passport processes Google's response and attaches the user to req.user.
// session:false → we are using JWT, not passport sessions.
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  (req, res) => {
    console.log('✅ Google callback hit:', req.user);
    //signing a token, expiry time is 30 mins
    const token = jwt.sign({ id: req.user._id, name: req.user.name}, process.env.JWT_SECRET, { expiresIn: '30m' });
    //redirects back to the frontend with token so react can save it
    res.redirect(`${process.env.CLIENT_URL}/auth/google/redirect?token=${token}`);
  }
);

module.exports = router