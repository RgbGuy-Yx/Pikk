const express = require('express');
const { createPythonServiceClient } = require('../services/pythonClient');
const { downloadWhatsAppMedia } = require('../services/whatsapp');
const intentRouter = require('../services/intentRouter');

const router = express.Router();
const pythonClient = createPythonServiceClient();

// In-memory store to prevent duplicate webhook processing
const processedMessageIds = new Set();

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      console.warn('Webhook verification failed: token mismatch');
      return res.status(403).send('Forbidden');
    }
  }

  res.json({
    route: 'webhook',
    status: 'ready',
  });
});

router.post('/', async (req, res) => {
  try {
    // 1. Extract message data
    let messageText = '';
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = req.body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
    
    const messageId = message?.id || req.body?.messageId;

    if (messageId) {
      if (processedMessageIds.has(messageId)) {
        console.log(`[Webhook] Duplicate message detected: ${messageId}. Skipping.`);
        return res.status(200).json({ received: true, status: 'duplicate_skipped' });
      }
      processedMessageIds.add(messageId);
      // Clean up after 10 minutes to prevent memory leaks
      setTimeout(() => processedMessageIds.delete(messageId), 10 * 60 * 1000);
    }

    const customerPhone = message?.from || req.body?.phone || req.body?.customerPhone || '919876543210';
    const customerName = contact?.profile?.name || req.body?.name || req.body?.customerName || 'Customer';

    console.log('--- Incoming Webhook ---');

    if (message?.audio?.id || req.body?.audio_id || req.body?.audioId) {
      // Handle Audio Message
      const mediaId = message?.audio?.id || req.body?.audio_id || req.body?.audioId;
      console.log(`[Webhook] Audio message received with ID: ${mediaId}`);
      
      try {
        const { buffer } = await downloadWhatsAppMedia(mediaId);
        const transRes = await pythonClient.transcribeAudio(buffer, 'audio.ogg');
        
        if (transRes && transRes.ok && transRes.transcript) {
          messageText = transRes.transcript;
          console.log(`[Webhook] Transcription success: "${messageText}"`);
        } else {
          console.error('[Webhook] Transcription failed:', transRes?.error);
          return res.status(200).json({ received: true, error: 'Transcription failed' });
        }
      } catch (err) {
        console.error('[Webhook] Media download or transcribe error:', err.message);
        return res.status(200).json({ received: true, error: err.message });
      }
    } else if (message?.text?.body) {
      messageText = message.text.body;
    } else if (req.body?.text) {
      // Simple format for testing
      messageText = req.body.text;
    }

    console.log('Message Text:', messageText);

    // 2. Process Order
    if (messageText) {
      await intentRouter.processIncomingMessage(messageText, customerPhone, customerName);
    }

    // 3. Respond to the webhook source
    res.json({
      received: true,
      status: 'processed',
    });
  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
