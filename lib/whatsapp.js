const TIMEOUT_MS = 30000;

async function sendMessage(to, text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text }
        }),
        signal: controller.signal
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp API respondió ${res.status}: ${errBody}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { sendMessage };
