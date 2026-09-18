const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { uuid } = require('../utils/uuid');

// Everyone sees the general channel; managers (admins) additionally get a
// management channel so they can coordinate without the operators' noise.
function visibleChannels(user) {
  return user && user.role === 'admin' ? ['general', 'management'] : ['general'];
}

router.get('/messages', async (req, res) => {
  try {
    const after = Math.max(0, Number(req.query.after) || 0);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    let rows = [];
    for (const ch of visibleChannels(req.user)) {
      const [part] = await pool.query(
        'SELECT * FROM messages WHERE channel = ? AND id > ? ORDER BY id LIMIT ?',
        [ch, after, limit]
      );
      rows = rows.concat(part);
    }
    rows.sort((a, b) => Number(a.id) - Number(b.id));
    res.json(rows.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/messages', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    const channel = String(req.body.channel || 'general').trim();
    if (!text) return res.status(400).json({ error: 'Message text is required' });
    if (!visibleChannels(req.user).includes(channel)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (text.length > 4000) return res.status(400).json({ error: 'Message is too long (4000 characters max)' });

    const [result] = await pool.query('INSERT INTO messages SET ?', {
      sync_uuid: uuid(),
      channel,
      sender: req.user.username,
      sender_name: req.user.full_name,
      text,
    });
    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/unread', async (req, res) => {
  try {
    const channels = visibleChannels(req.user);
    const counts = {};
    for (const ch of channels) {
      const [read] = await pool.query('SELECT last_read_id FROM chat_reads WHERE username = ? AND channel = ?', [req.user.username, ch]);
      const lastRead = read[0] ? Number(read[0].last_read_id) : 0;
      const [row] = await pool.query(
        'SELECT COUNT(*) AS c FROM messages WHERE channel = ? AND sender != ? AND id > ?',
        [ch, req.user.username, lastRead]
      );
      counts[ch] = Number(row[0].c);
    }
    res.json({ channels, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/read', async (req, res) => {
  try {
    const channel = String(req.body.channel || 'general').trim();
    const lastRead = Math.max(0, Number(req.body.last_read_id) || 0);
    if (!visibleChannels(req.user).includes(channel)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (pool.engine === 'sqlite') {
      await pool.query(
        'INSERT INTO chat_reads (username, channel, last_read_id) VALUES (?, ?, ?) ON CONFLICT(username, channel) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)',
        [req.user.username, channel, lastRead]
      );
    } else {
      await pool.query(
        'INSERT INTO chat_reads (username, channel, last_read_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))',
        [req.user.username, channel, lastRead]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;