const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { roleRequired } = require('../middleware/auth');

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  is_active: u.is_active,
  created_at: u.created_at,
});

router.use(roleRequired('admin'));

router.get('/', async (req, res) => {
  try {
    const users = await User.list();
    res.json(users.map(publicUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password and full name are required' });
    }
    const existing = await User.findByUsername(username);
    if (existing) return res.status(400).json({ error: `Username "${username}" already exists` });

    const password_hash = await bcrypt.hash(password, 10);
    const id = await User.create({ username, password_hash, full_name, email, role });
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const fields = { ...req.body };
    if (fields.password) {
      fields.password_hash = await bcrypt.hash(fields.password, 10);
      delete fields.password;
    }
    // Admins cannot deactivate themselves
    if (fields.is_active === 0 || fields.is_active === false) {
      if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
      }
    }

    await User.update(req.params.id, fields);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    await User.update(req.params.id, { is_active: 0 });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;