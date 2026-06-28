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

async function sendWhatsAppDocument(to, documentUrl, filename, caption) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: documentUrl,
      filename: filename || 'invoice.pdf',
      caption: caption || ''
    }
  };

  if (!accessToken || !phoneNumberId) {
    console.log('\n========================================');
    console.log('[WhatsApp MOCK Document Send]');
    console.log(`To:       ${to}`);
    console.log(`Document: ${documentUrl}`);
    console.log(`Filename: ${payload.document.filename}`);
    console.log(`Caption:  ${payload.document.caption}`);
    console.log('========================================\n');
    return { ok: true, mocked: true, recipient: to, documentUrl };
  }

  try {
    console.log(`[WhatsApp] Sending invoice document to ${to}...`);
    const response = await whatsappClient.post('/messages', payload);
    return { ok: true, mocked: false, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    console.error(`[WhatsApp] Failed to send document to ${to}:`, error.response?.data || error.message);
    return { ok: false, error: error.response?.data || error.message };
  }
}

async function sendWhatsAppImage(to, imageUrl, caption) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: {
      link: imageUrl,
      caption: caption || ''
    }
  };

  if (!accessToken || !phoneNumberId) {
    console.log('\n========================================');
    console.log('[WhatsApp MOCK Image Send]');
    console.log(`To:      ${to}`);
    console.log(`Image:   ${imageUrl}`);
    console.log(`Caption: ${payload.image.caption}`);
    console.log('========================================\n');
    return { ok: true, mocked: true, recipient: to, imageUrl };
  }

  try {
    console.log(`[WhatsApp] Sending UPI QR image to ${to}...`);
    const response = await whatsappClient.post('/messages', payload);
    return { ok: true, mocked: false, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    console.error(`[WhatsApp] Failed to send image to ${to}:`, error.response?.data || error.message);
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

/**
 * Sends a local image file as a WhatsApp image message.
 * Uploads the file to WhatsApp's media endpoint first, then sends using the media ID.
 *
 * @param {string} to - Recipient phone number.
 * @param {string} filePath - Absolute path to the image file on disk.
 * @param {string} [caption] - Optional caption for the image.
 * @returns {Promise<Object>} - Response status object.
 */
async function sendWhatsAppImageFromFile(to, filePath, caption) {
  const fs = require('fs');
  const FormData = require('form-data');

  if (!fs.existsSync(filePath)) {
    console.error(`[WhatsApp] Image file not found: ${filePath}`);
    return { ok: false, error: 'Image file not found' };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Mock mode
  if (!accessToken || !phoneNumberId) {
    console.log('\n========================================');
    console.log('[WhatsApp MOCK Image Send from File]');
    console.log(`To:      ${to}`);
    console.log(`File:    ${filePath}`);
    console.log(`Caption: ${caption || ''}`);
    console.log('========================================\n');
    return { ok: true, mocked: true, recipient: to, filePath };
  }

  try {
    // Step 1: Upload image to WhatsApp media endpoint
    console.log(`[WhatsApp] Uploading image to media endpoint: ${filePath}`);
    const fileBuffer = fs.readFileSync(filePath);
    const filename = require('path').basename(filePath);

    const form = new FormData();
    form.append('file', fileBuffer, {
      filename,
      contentType: 'image/jpeg',
    });
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/jpeg');

    const uploadResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/media`,
      form,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...form.getHeaders(),
        },
        timeout: 30000,
      }
    );

    const mediaId = uploadResponse.data?.id;
    if (!mediaId) {
      throw new Error('Media upload did not return an ID');
    }
    console.log(`[WhatsApp] Image uploaded. Media ID: ${mediaId}`);

    // Step 2: Send image using the media ID
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: {
        id: mediaId,
        caption: caption || '',
      },
    };

    const response = await whatsappClient.post('/messages', payload);
    console.log(`[WhatsApp] QR image sent to ${to}. Message ID: ${response.data?.messages?.[0]?.id}`);
    return { ok: true, mocked: false, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    console.error(`[WhatsApp] Failed to send image to ${to}:`, error.response?.data || error.message);
    return { ok: false, error: error.response?.data || error.message };
  }
}

module.exports = {
  createWhatsAppClient,
  sendWhatsAppMessage,
  sendWhatsAppDocument,
  sendWhatsAppImage,
  sendWhatsAppImageFromFile,
  notifyOwner,
  downloadWhatsAppMedia
};
