const decodeToken = require('../utils/decodeToken.js')

function verifyToken(req, res, next){
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(" ")[1] //Bearer <token>

    try{
        const decoded = decodeToken(token)
        req.user = decoded
        next()
    }catch(err){
        res.status(403).json({ message: "Expired/Invalid token"})
    }
}
module.exports = verifyToken;