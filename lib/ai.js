const fs = require('fs');
const path = require('path');
const leads = require('./leads');
const store = require('./store');

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1000;
const TIMEOUT_MS = 30000;
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '..', 'prompts', 'system.md'),
  'utf8'
);

const LEAD_TOOL = {
  name: 'save_lead_field',
  description:
    'Guarda un dato del prospecto (nombre, tipo de negocio, u horario preferido) ' +
    'apenas el usuario lo mencione en la conversación. Úsala en cuanto detectes ' +
    'cada dato de forma individual, sin esperar a tener todos los campos.',
  input_schema: {
    type: 'object',
    properties: {
      field: { type: 'string', enum: ['nombre', 'tipo_negocio', 'horario'] },
      value: { type: 'string' }
    },
    required: ['field', 'value']
  }
};

async function callAnthropic(messages, signal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
      tools: [LEAD_TOOL]
    }),
    signal
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API respondió ${res.status}: ${errBody}`);
  }

  return res.json();
}

async function getReply(phone, userText, history) {
  const messages = history
    .map((m) => ({ role: m.role, content: m.content }))
    .concat([{ role: 'user', content: userText }]);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let replyText = '';
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callAnthropic(messages, controller.signal);
      const toolResults = [];

      for (const block of data.content) {
        if (block.type === 'text') {
          replyText += block.text;
        } else if (block.type === 'tool_use' && block.name === 'save_lead_field') {
          const { field, value } = block.input;
          if (!store.hasLeadField(phone, field, value)) {
            store.markLeadField(phone, field, value);
            leads.save(phone, field, value).catch((err) => {
              console.error('Error guardando lead:', err);
            });
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'ok' });
        }
      }

      if (data.stop_reason !== 'tool_use' || toolResults.length === 0) break;

      // El modelo se detuvo a mitad de la respuesta para invocar la herramienta;
      // le devolvemos el resultado para que continúe la conversación.
      messages.push({ role: 'assistant', content: data.content });
      messages.push({ role: 'user', content: toolResults });
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!replyText.trim()) {
    replyText = 'Gracias, ¿en qué más puedo ayudarte?';
  }

  return replyText;
}

module.exports = { getReply };
