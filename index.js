require('dotenv').config();

const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.use('/webhook', webhookRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`NODAL bot escuchando en el puerto ${PORT}`);
});
