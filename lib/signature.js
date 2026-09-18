const crypto = require('crypto');

function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) return false;

  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedHeader = `sha256=${expected}`;

  const receivedBuf = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expectedHeader);

  if (receivedBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
}

module.exports = { verifySignature };
