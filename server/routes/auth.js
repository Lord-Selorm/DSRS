const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findByUsername(username);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role,
        must_change_password: !!user.must_change_password,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/password', authRequired, async (req, res) => {
  try {
    const { current_password, new_password, new_username } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (String(new_password).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const user = await User.findByUsername(req.user.username);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const updates = { password_hash: await bcrypt.hash(new_password, 10), must_change_password: 0 };

    if (new_username !== undefined && String(new_username).trim() !== '' && String(new_username).trim() !== user.username) {
      const uname = String(new_username).trim();
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(uname)) {
        return res.status(400).json({ error: 'Username must be 3–32 characters: letters, numbers, or . _ -' });
      }
      const dup = await User.findByUsername(uname);
      if (dup) return res.status(400).json({ error: `The username "${uname}" is already taken` });
      updates.username = uname;
    }

    await User.update(user.id, updates);

    const fresh = await User.findById(user.id);
    const token = jwt.sign(
      { id: fresh.id, username: fresh.username, role: fresh.role, full_name: fresh.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: fresh.id, username: fresh.username, full_name: fresh.full_name, email: fresh.email, role: fresh.role,
        must_change_password: false,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;