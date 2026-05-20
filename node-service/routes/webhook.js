const express = require('express');
const { createPythonServiceClient } = require('../services/pythonClient');

const router = express.Router();
const pythonClient = createPythonServiceClient();

router.get('/', (req, res) => {
  res.json({
    route: 'webhook',
    status: 'ready',
  });
});

router.post('/', async (req, res) => {
  try {
    // 1. Extract message text (support both simple JSON and WhatsApp nested structure)
    let messageText = '';
    
    if (req.body?.text) {
      // Simple format for testing: { "text": "2kg atta" }
      messageText = req.body.text;
    } else if (req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body) {
      // Standard WhatsApp Cloud API structure
      messageText = req.body.entry[0].changes[0].value.messages[0].text.body;
    }

    console.log('--- Incoming Webhook ---');
    console.log('Message Text:', messageText);

    // 2. Call Python AI Service if text exists
    if (messageText) {
      const parsedResult = await pythonClient.parseOrder(messageText);
      console.log('AI Parse Result:', JSON.stringify(parsedResult, null, 2));
      
      // TODO: In Phase 3, we will add database logic here to save orders
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
