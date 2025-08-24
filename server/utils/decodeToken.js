const jwt = require('jsonwebtoken')

function decodeToken(token){
    if(!token) throw new Error("token missing");

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        return decoded; //contains id and name (you can access them by decoded.id and decoded.name)
    }catch(err){
        throw new Error("invalid token")
    }
}
module.exports = decodeToken;