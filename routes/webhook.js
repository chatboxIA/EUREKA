const express = require('express');
const router = express.Router();

const { verifySignature } = require('../lib/signature');
const whatsapp = require('../lib/whatsapp');
const ai = require('../lib/ai');
const store = require('../lib/store');

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).type('text/plain').send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/', (req, res) => {
  const signature = req.get('x-hub-signature-256');

  if (!verifySignature(req.rawBody, signature, process.env.APP_SECRET)) {
    console.error('Firma inválida en webhook de WhatsApp');
    res.sendStatus(401);
    return;
  }

  // Responder de inmediato: Meta reintenta el webhook si tardamos.
  res.sendStatus(200);

  processWebhookBody(req.body).catch((err) => {
    console.error('Error procesando webhook:', err);
  });
});

async function processWebhookBody(body) {
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      // Ignora eventos de "statuses" (entregado, leído, etc.)
      if (!value.messages) continue;

      for (const message of value.messages) {
        if (store.isDuplicate(message.id)) continue;
        store.markProcessed(message.id);

        await handleMessage(message).catch((err) => {
          console.error('Error manejando mensaje:', err);
        });
      }
    }
  }
}

async function handleMessage(message) {
  const from = message.from;

  if (message.type !== 'text') {
    await safeSend(
      from,
      'Por el momento solo puedo leer mensajes de texto. ¿Podrías escribirme lo que necesitas, por favor?'
    );
    return;
  }

  const userText = message.text.body;
  const priorHistory = store.get(from);

  let replyText;
  try {
    replyText = await ai.getReply(from, userText, priorHistory);
  } catch (err) {
    console.error('Error llamando a la IA:', err);
    await safeSend(
      from,
      'Disculpa, tuve un problema para responder. ¿Podrías escribir tu mensaje de nuevo?'
    );
    return;
  }

  store.append(from, { role: 'user', content: userText });
  store.append(from, { role: 'assistant', content: replyText });

  await safeSend(from, replyText);
}

async function safeSend(to, text) {
  try {
    await whatsapp.sendMessage(to, text);
  } catch (err) {
    console.error('Error enviando mensaje a WhatsApp:', err);
  }
}

module.exports = router;
