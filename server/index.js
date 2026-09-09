const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { authRequired } = require('./middleware/auth');
const { uploadDir } = require('./middleware/multer');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

const clientDist = path.join(__dirname, '..', 'client', 'dist');

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/sources', authRequired, require('./routes/sources'));
app.use('/api/institutions', authRequired, require('./routes/institutions'));
app.use('/api/users', authRequired, require('./routes/users'));
app.use('/api/dashboard', authRequired, require('./routes/dashboard'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve the built React client (production mode)
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, req, res, next) => {
  console.error(err);
  const isMulter = err.code && typeof err.code === 'string' && err.code.startsWith('LIMIT');
  const isUploadFilter = err.message && /image|file|Only/.test(err.message);
  const status = isMulter || isUploadFilter ? 400 : 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`DSRS API running on port ${PORT}`));
}

module.exports = app;