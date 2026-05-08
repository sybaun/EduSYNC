const express = require('express');

const app = express();
app.use(express.json());

// HOME (E2E potrzebuje tego)
app.get('/', (req, res) => {
  res
    .status(200)
    .send('<html><head><title>EduSYNC Home</title></head><body>OK</body></html>');
});

// API
app.post('/user', (req, res) => {
  res.status(201).json({
    id: Date.now(),
    email: req.body.email
  });
});

module.exports = app;
