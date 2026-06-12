const axios = require('axios');

/**
 * Creates an authorized axios client for the Meta WhatsApp Cloud API.
 */
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

const whatsappClient = createWhatsAppClient();

/**
 * Sends a text message to a WhatsApp number.
 * Supports both clean positional arguments (to, text) and raw payload objects for flexibility.
 * 
 * @param {string|Object} toOrPayload - The recipient's phone number, or a full WhatsApp API payload object.
 * @param {string} [text] - The message text (required if first argument is a phone number string).
 * @returns {Promise<Object>} - Response status object.
 */
async function sendWhatsAppMessage(toOrPayload, text) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  
  let recipient = '';
  let messageText = '';
  let payload = null;

  if (typeof toOrPayload === 'object' && toOrPayload !== null) {
    // If a full payload object is passed
    payload = toOrPayload;
    recipient = payload.to || 'Unknown';
    messageText = payload.text?.body || JSON.stringify(payload);
  } else {
    // Positional arguments format: (to, text)
    recipient = toOrPayload;
    messageText = text || '';
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: false,
        body: messageText
      }
    };
  }

  // Fallback / Mock mode when Meta credentials are not configured in .env
  if (!accessToken || !phoneNumberId) {
    console.log('\n========================================');
    console.log('📱 [WhatsApp MOCK Send]');
    console.log(`👤 To:      ${recipient}`);
    console.log(`💬 Message: \n${messageText}`);
    console.log('========================================\n');
    return { ok: true, mocked: true, recipient, text: messageText };
  }

  try {
    console.log(`[WhatsApp] Sending real message to ${recipient}...`);
    const response = await whatsappClient.post('/messages', payload);
    console.log(`[WhatsApp] Real message sent successfully! Message ID: ${response.data?.messages?.[0]?.id}`);
    return { ok: true, mocked: false, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    console.error(`[WhatsApp] Failed to send message to ${recipient}:`, error.response?.data || error.message);
    // Return a fallback success so the application workflow doesn't break
    return { ok: false, error: error.response?.data || error.message };
  }
}

/**
 * Notifies the store owner of a new order or system event.
 * Owner's phone number is retrieved from OWNER_PHONE in .env.
 * 
 * @param {string} text - The notification message text.
 * @returns {Promise<Object>} - Response status object.
 */
async function notifyOwner(text) {
  const ownerPhone = process.env.OWNER_PHONE || '919999999999'; // Default mock owner phone
  console.log(`[WhatsApp] Dispatching owner notification to ${ownerPhone}...`);
  
  const alertText = `🔔 [OWNER ALERT]\n${text}`;
  return sendWhatsAppMessage(ownerPhone, alertText);
}

/**
 * Downloads media from Meta WhatsApp Cloud API by media ID.
 * Returns a Buffer of the media content, and its mime type.
 * 
 * @param {string} mediaId - The media ID from WhatsApp webhook.
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
async function downloadWhatsAppMedia(mediaId) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  // Fallback / Mock mode when Meta credentials are not configured in .env
  if (!accessToken || mediaId.startsWith('mock_')) {
    console.log(`[WhatsApp] Mock download for media ID: ${mediaId}`);
    return {
      buffer: Buffer.from('mock audio content'),
      mimeType: 'audio/ogg'
    };
  }

  try {
    console.log(`[WhatsApp] Fetching media metadata for ID: ${mediaId}...`);
    // Get media metadata from Graph API
    const metadataResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const mediaUrl = metadataResponse.data?.url;
    const mimeType = metadataResponse.data?.mime_type || 'audio/ogg';

    if (!mediaUrl) {
      throw new Error(`Failed to retrieve media URL for ID: ${mediaId}`);
    }

    console.log(`[WhatsApp] Downloading media content from: ${mediaUrl}...`);
    // Download the binary content
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      responseType: 'arraybuffer'
    });

    return {
      buffer: Buffer.from(mediaResponse.data),
      mimeType
    };
  } catch (error) {
    console.error(`[WhatsApp] Failed to download media ${mediaId}:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  createWhatsAppClient,
  sendWhatsAppMessage,
  notifyOwner,
  downloadWhatsAppMedia
};

