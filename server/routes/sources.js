const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Source = require('../models/Source');
const DValue = require('../models/DValue');
const qrcode = require('qrcode');
const upload = require('../middleware/multer');
const uploadDir = require('../middleware/multer').uploadDir;

router.get('/d-values', async (req, res) => {
  try {
    res.json(await DValue.list());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/calculate-category', async (req, res) => {
  try {
    const { radionuclide_id, current_activity } = req.body;
    const dValue = await DValue.findById(radionuclide_id);
    if (!dValue) return res.status(400).json({ error: 'Invalid radionuclide' });
    const category = await DValue.calculateCategory(current_activity, dValue.d_value_tbq);
    res.json({ radionuclide: dValue.radionuclide, d_value_tbq: dValue.d_value_tbq, category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { limit, offset, ...filters } = req.query;
    const result = await Source.search(filters, { limit: Number(limit), offset: Number(offset) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const id = await Source.create(req.body, req.user.id);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    source.history = await Source.history(source.id);
    source.measurements = await Source.measurements(source.id);
    source.leak_tests = await Source.leakTests(source.id);
    res.json(source);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await Source.update(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/measurements', async (req, res) => {
  try {
    const id = await Source.addMeasurement(req.params.id, req.body, req.user.id);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/leak-tests', async (req, res) => {
  try {
    const id = await Source.addLeakTest(req.params.id, req.body, req.user.id);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    res.json(await Source.history(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Source not found' });
    }
    const oldPath = source.photo_path;
    await Source.updatePhoto(req.params.id, req.file.filename, req.user.id);
    if (oldPath) {
      fs.unlink(path.join(uploadDir, oldPath), () => {});
    }
    res.json({ photo_path: req.file.filename });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/qrcode', async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const url = `dsrs://source/${source.id}`;
    const dataUrl = await qrcode.toDataURL(url);
    res.type('png');
    res.send(Buffer.from(dataUrl.split(',')[1], 'base64'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;