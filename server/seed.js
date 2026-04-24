const User = require('./models/user');
const Room = require('./models/room');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

(async () => {
  await mongoose.connect('mongodb://localhost:27018/mydatabase');

  const rooms = [];
  const users = await User.find({ email: /loadtest_user/ }).sort({ _id: 1});

  for(let i=0; i<users.length; i+=2){
    rooms.push(`${users[i]._id.toString()}_${users[i+1]._id.toString()}`);
  }

  const tokens = users.map((user) =>
    jwt.sign(
      { id: user._id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '2h'}
    )
  );

  fs.writeFileSync(
    'seed_output.json',
    JSON.stringify({
      users: users.map(u => u._id.toString()),
      rooms: rooms,
      tokens
    }, null, 2)
  );

  process.exit();
})();