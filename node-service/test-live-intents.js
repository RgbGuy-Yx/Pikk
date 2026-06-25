const axios = require('axios');

async function testIntent(text) {
  try {
    console.log(`\n========================================`);
    console.log(`🧪 Testing Text: "${text}"`);
    console.log(`========================================`);
    
    // Simulate incoming Webhook
    const response = await axios.post('http://localhost:3001/webhook', {
      text: text,
      customerPhone: '919876543210',
      customerName: 'TestUser'
    });
    
    console.log(`Webhook HTTP Response:`, response.data);
  } catch (err) {
    console.error(`Error connecting to webhook:`, err.message);
  }
}

async function runAll() {
  console.log("NOTE: Ensure both the Node.js server (port 3001) and Python server (port 8000) are running.");
  
  // 1. Greeting
  await testIntent("Hello there!"); 
  
  // 2. FAQ
  await testIntent("What are your store timings?"); 
  
  // 3. Product Query
  await testIntent("What is the price of milk?"); 
  
  // 4. Order Status
  await testIntent("Where is my order?"); 
  
  // 5. Place Order
  await testIntent("2kg atta and 1 litre oil please"); 
}

runAll();
