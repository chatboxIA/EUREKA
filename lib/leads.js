const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, '..', 'leads.jsonl');

async function save(phone, field, value) {
  const entry = {
    phone,
    timestamp: new Date().toISOString(),
    field,
    value
  };
  await fs.promises.appendFile(LEADS_FILE, JSON.stringify(entry) + '\n');
}

module.exports = { save };
