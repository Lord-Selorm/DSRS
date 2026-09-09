const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const qrcode = require('qrcode');
const bwipjs = require('bwip-js');

// Public, read-only trace endpoint used by QR-code scans so that scanning a
// source's QR shows its complete record (no login required).
router.get('/sources/:id', async (req, res) => {
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

router.get('/sources/:id/qrcode', async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const dataUrl = await qrcode.toDataURL(`${base}/trace/${source.id}`);
    res.type('png');
    res.send(Buffer.from(dataUrl.split(',')[1], 'base64'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sources/:id/barcode', async (req, res) => {
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
    });
    res.type('png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;