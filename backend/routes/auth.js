// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Sign Up ───
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.json({ success: false, message: 'Email taken' });

    const newUser = new User({ username, email, password }); // Direct save!
    await newUser.save();

    res.json({ success: true, message: 'Signed up!' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ─── Login ───
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // Changed 'email' to 'identifier'
    
    if (!identifier || !password) {
      return res.json({ success: false, message: 'Please provide credentials' });
    }

    // Search for a match on either username OR email
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user || user.password !== password) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    
    // Return parameters back to browser session
    res.json({ 
      success: true, 
      token, 
      username: user.username,
      email: user.email 
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;