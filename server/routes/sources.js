const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Source = require('../models/Source');
const DValue = require('../models/DValue');
const qrcode = require('qrcode');
const bwipjs = require('bwip-js');
const upload = require('../middleware/multer');
const uploadDir = require('../middleware/multer').uploadDir;
const pool = require('../config/db');
const { importSources } = require('../utils/sourceImport');
const { uuid } = require('../utils/uuid');

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) return cb(new Error('Only .xlsx, .xls or .csv files are allowed'));
    cb(null, true);
  },
});

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

router.post('/import', importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const result = await importSources(req.file.buffer, ext, req.user.id);
    res.status(201).json(result);
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
    const [photos] = await pool.query(
      'SELECT id, photo_path, caption, uploaded_by, created_at FROM source_photos WHERE source_id = ? ORDER BY id',
      [source.id]
    );
    source.photos = photos;
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

router.post('/:id/photos', upload.array('photos', 10), async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) {
      (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(404).json({ error: 'Source not found' });
    }
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'No photos provided' });

    const rows = files.map((f) => [uuid(), source.id, f.filename, req.user.id]);
    await pool.query('INSERT INTO source_photos (sync_uuid, source_id, photo_path, uploaded_by) VALUES ?', [rows]);

    const historyValues = files.map((f) => [uuid(), source.id, req.user.id, 'photo', 'photo_path', null, f.filename]);
    await pool.query(
      'INSERT INTO source_history (sync_uuid, source_id, changed_by, change_type, field_changed, previous_value, new_value) VALUES ?',
      [historyValues]
    );

    res.status(201).json({ added: files.length });
  } catch (err) {
    (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM source_photos WHERE id = ? AND source_id = ?',
      [req.params.photoId, req.params.id]
    );
    const photo = rows[0];
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    await pool.query('DELETE FROM source_photos WHERE id = ?', [photo.id]);
    fs.unlink(path.join(uploadDir, photo.photo_path), () => {});

    await pool.query(
      'INSERT INTO source_history (sync_uuid, source_id, changed_by, change_type, field_changed, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid(), req.params.id, req.user.id, 'photo', 'photo_path', photo.photo_path, null]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/qrcode', async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${base}/trace/${source.id}`;
    const dataUrl = await qrcode.toDataURL(url);
    res.type('png');
    res.send(Buffer.from(dataUrl.split(',')[1], 'base64'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/barcode', async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const text = (source.source_barcode || source.source_serial_no || `DSRS-${source.id}`).toString();
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text,
      scale: 3,
      height: 12,
      width: 96,
      includetext: true,
      textxalign: 'center',
      textsize: 12,
      paddingwidth: 6,
      paddingheight: 6,
      backgroundcolor: 'FFFFFF',
    });
    res.type('png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;