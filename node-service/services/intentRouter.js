const { createSupabaseClient } = require('./supabase');
const { createPythonServiceClient } = require('./pythonClient');
const { sendWhatsAppMessage } = require('./whatsapp');
const orderService = require('./orderService');

const supabase = createSupabaseClient();
const pythonClient = createPythonServiceClient();

class IntentRouterService {
  async processIncomingMessage(text, customerPhone, customerName) {
    if (!text || !text.trim()) {
      return { success: false, reason: 'Empty message text' };
    }

    const cleanPhone = customerPhone || '919876543210';
    const cleanName = customerName || 'Customer';

    console.log(`\n========================================`);
    console.log(`[IntentRouter] Processing Message`);
    console.log(`  From:   ${cleanName} (${cleanPhone})`);
    console.log(`  Text:   "${text}"`);
    console.log(`========================================`);

    // 1. Call Python: Sarvam translate + Groq chat (with tool calling)
    const result = await pythonClient.parseIntent(text, cleanPhone);
    console.log(`[IntentRouter] Result:`, JSON.stringify(result, null, 2));

    const intent = result.intent || 'greeting';
    const reply = result.reply || 'Sorry, I had trouble understanding that. Please try again.';
    const items = result.items || [];

    // 2. Send Groq's natural reply to customer
    if (reply) {
      await sendWhatsAppMessage(cleanPhone, reply);
    }

    // 3. Handle actions that need Node.js processing
    if (intent === 'place_order' && items.length > 0) {
      console.log(`[IntentRouter] place_order with ${items.length} items. Forwarding to OrderService.`);
      return orderService.processIncomingOrder(items, cleanPhone, cleanName);
    }

    if (intent === 'order_status') {
      return this.handleOrderStatus(cleanPhone);
    }

    // For greeting, faq, product_query — Groq already sent the reply
    return { success: true, intent };
  }

  async handleOrderStatus(phone) {
    const { data: customer } = await supabase.from('customers').select('id').eq('phone', phone).maybeSingle();
    if (!customer) {
      return { success: true, intent: 'order_status' };
    }

    const { data: latestOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestOrder) {
      const statusIcon = latestOrder.status === 'pending' ? '...' : 'Done';
      const msg = `*Your Latest Order*\n\n*Order ID:* #${latestOrder.id}\n*Status:* ${latestOrder.status.toUpperCase()} ${statusIcon}\n*Amount:* Rs.${latestOrder.total_amount}\n*Placed on:* ${new Date(latestOrder.created_at).toLocaleString()}`;
      await sendWhatsAppMessage(phone, msg);
    }

    return { success: true, intent: 'order_status' };
  }
}

module.exports = new IntentRouterService();
