const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 20;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// phone -> { messages: [{ role, content, timestamp }], updatedAt }
const conversations = new Map();

// messageId -> timestamp de procesamiento, para deduplicar reintentos de Meta
const processedMessageIds = new Map();

function getOrCreateConversation(phone) {
  let conv = conversations.get(phone);
  if (!conv) {
    conv = { messages: [], leadFields: new Set(), updatedAt: Date.now() };
    conversations.set(phone, conv);
  }
  return conv;
}

function get(phone) {
  const conv = conversations.get(phone);
  return conv ? conv.messages : [];
}

function append(phone, message) {
  const conv = getOrCreateConversation(phone);
  conv.messages.push({ ...message, timestamp: Date.now() });
  if (conv.messages.length > MAX_MESSAGES) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES);
  }
  conv.updatedAt = Date.now();
}

function hasLeadField(phone, field, value) {
  const conv = conversations.get(phone);
  return !!conv && conv.leadFields.has(`${field}:${value}`);
}

function markLeadField(phone, field, value) {
  const conv = getOrCreateConversation(phone);
  conv.leadFields.add(`${field}:${value}`);
  conv.updatedAt = Date.now();
}

function clear(phone) {
  conversations.delete(phone);
}

function isDuplicate(messageId) {
  return processedMessageIds.has(messageId);
}

function markProcessed(messageId) {
  processedMessageIds.set(messageId, Date.now());
}

function cleanup() {
  const now = Date.now();
  for (const [phone, conv] of conversations) {
    if (now - conv.updatedAt > TTL_MS) conversations.delete(phone);
  }
  for (const [id, ts] of processedMessageIds) {
    if (now - ts > TTL_MS) processedMessageIds.delete(id);
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();

module.exports = {
  get,
  append,
  clear,
  isDuplicate,
  markProcessed,
  hasLeadField,
  markLeadField
};
