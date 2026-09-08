const express = require('express');
const router = express.Router();
const Source = require('../models/Source');

router.get('/', async (req, res) => {
  try {
    res.json(await Source.stats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;