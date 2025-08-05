// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }, // store hashed password
  role: { type: String, enum: ['admin', 'manager'], required: true }
});

module.exports = mongoose.model('User', userSchema);
