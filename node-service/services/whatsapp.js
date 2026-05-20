const axios = require('axios');

function createWhatsAppClient() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  return axios.create({
    baseURL: phoneNumberId ? `https://graph.facebook.com/v19.0/${phoneNumberId}` : 'https://graph.facebook.com/v19.0',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'application/json',
    },
  });
}

function sendWhatsAppMessage(payload) {
  return {
    ok: true,
    payload: payload || {},
  };
}

module.exports = {
  createWhatsAppClient,
  sendWhatsAppMessage,
};
