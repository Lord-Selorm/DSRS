const router = require('express').Router();

router.get('/status', (req, res) => {
  res.json(req.syncController.status());
});

router.post('/run', async (req, res) => {
  const result = await req.syncController.runSync();
  res.json(result);
});

module.exports = router;