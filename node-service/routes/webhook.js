const express = require('express');
const orderService = require('../services/orderService');

const router = express.Router();

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
    let messageText = '';
    let customerPhone = '';
    let customerName = '';
    let audioId = '';
    
    // Support both simple JSON testing format and nested Meta WhatsApp structure
    if (req.body?.text) {
      // Simple format: { "text": "2kg atta", "phone": "919876543210", "name": "Yuvraj" }
      messageText = req.body.text;
      customerPhone = req.body.phone || '919876543210';
      customerName = req.body.name || 'Yuvraj';
    } else if (req.body?.audio_id) {
      // Simple format for testing audio: { "audio_id": "mock_123", "phone": "...", "name": "..." }
      audioId = req.body.audio_id;
      customerPhone = req.body.phone || '919876543210';
      customerName = req.body.name || 'Yuvraj';
    } else if (req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      // Standard Meta WhatsApp Cloud API webhook structure
      const valueObj = req.body.entry[0].changes[0].value;
      const messageObj = valueObj.messages[0];
      
      customerPhone = messageObj.from || '919876543210';
      
      // Extract contact profile name if available
      const contactObj = valueObj.contacts?.[0];
      customerName = contactObj?.profile?.name || 'Customer';

      if (messageObj.type === 'audio' || messageObj.audio) {
        audioId = messageObj.audio?.id;
      } else {
        messageText = messageObj.text?.body || '';
      }
    }

    console.log('\n--- Incoming Webhook POST ---');
    console.log('Sender Name: ', customerName);
    console.log('Sender Phone:', customerPhone);

    // If it's a voice note, download and transcribe it
    if (audioId) {
      console.log(`[Webhook] Audio Message Detected. Media ID: ${audioId}`);
      try {
        const { downloadWhatsAppMedia } = require('../services/whatsapp');
        const { createPythonServiceClient } = require('../services/pythonClient');
        const pythonClient = createPythonServiceClient();

        // 1. Download media from Meta
        console.log(`[Webhook] Downloading media for ID: ${audioId}...`);
        const media = await downloadWhatsAppMedia(audioId);

        // Determine filename
        const ext = media.mimeType.includes('ogg') ? '.ogg' : (media.mimeType.includes('mpeg') ? '.mp3' : '.ogg');
        const filename = `${audioId}${ext}`;

        // 2. Send to Python for transcription
        console.log(`[Webhook] Requesting transcription from Python service...`);
        const transcribeResult = await pythonClient.transcribeAudio(media.buffer, filename);

        if (transcribeResult && transcribeResult.ok && transcribeResult.transcript && transcribeResult.transcript.trim()) {
          messageText = transcribeResult.transcript;
          console.log(`[Webhook] Transcription result: "${messageText}"`);
        } else {
          const errMsg = transcribeResult?.error || 'Transcription response empty';
          console.warn(`[Webhook] Transcription failed: ${errMsg}`);
          throw new Error(errMsg);
        }
      } catch (audioError) {
        console.error('[Webhook] Failed to process audio message:', audioError.message);
        const { sendWhatsAppMessage } = require('../services/whatsapp');
        await sendWhatsAppMessage(customerPhone, '⚠️ Sorry, we had trouble processing your voice note. Please try again or send a text message.');
        return res.json({
          received: true,
          status: 'error',
          reason: `Audio processing error: ${audioError.message}`
        });
      }
    }

    console.log('Message Text:', messageText);

    // Delegate to OrderService to keep routes thin and keep business logic isolated
    if (messageText) {
      const result = await orderService.processIncomingMessage(messageText, customerPhone, customerName);
      return res.json({
        received: true,
        status: 'processed',
        data: result
      });
    }

    res.json({
      received: true,
      status: 'ignored',
      reason: 'No message text or transcript found'
    });
  } catch (error) {
    console.error('Webhook Route Error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
