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
    console.log(`👤 From:   ${cleanName} (${cleanPhone})`);
    console.log(`💬 Text:   "${text}"`);
    console.log(`========================================`);

    // 1. Get Intent from Python AI
    console.log(`[IntentRouter] Invoking Intent Classifier...`);
    const parseResult = await pythonClient.parseIntent(text);
    console.log(`[IntentRouter] AI Parsed Result:`, JSON.stringify(parseResult, null, 2));

    const intent = parseResult.intent || 'greeting';
    const data = parseResult.data || {};

    // 2. Route based on intent
    switch (intent) {
      case 'greeting':
        return this.handleGreeting(cleanPhone, cleanName);
      case 'faq':
        return this.handleFaq(cleanPhone, data.query);
      case 'product_query':
        return this.handleProductQuery(cleanPhone, data.query);
      case 'order_status':
        return this.handleOrderStatus(cleanPhone);
      case 'place_order':
        return orderService.processIncomingOrder(data.items, cleanPhone, cleanName);
      default:
        return this.handleGreeting(cleanPhone, cleanName);
    }
  }

  async handleGreeting(phone, name) {
    const msg = `Hello ${name}! 👋 Welcome to ShopBot.\nI can help you with:\n🛒 Placing grocery orders\n📦 Checking order status\n🔍 Searching products\n⏰ Store FAQs\n\nHow can I help you today?`;
    await sendWhatsAppMessage(phone, msg);
    return { success: true, intent: 'greeting' };
  }

  async handleFaq(phone, query) {
    // Simplistic FAQ logic
    const msg = `🏪 *Store Information*\n\n*Timings:* 8:00 AM to 10:00 PM (Everyday)\n*Location:* 123 Main Street, Grocery Market\n*Delivery:* Free home delivery on orders above ₹500.\n\nLet me know if you want to place an order!`;
    await sendWhatsAppMessage(phone, msg);
    return { success: true, intent: 'faq' };
  }

  async handleProductQuery(phone, query) {
    if (!query) {
      await sendWhatsAppMessage(phone, "Please specify which product you are looking for. 🔍");
      return { success: true, intent: 'product_query' };
    }

    const { data: matchedProducts } = await supabase
      .from('products')
      .select('*')
      .ilike('name', `%${query.trim().toLowerCase()}%`)
      .limit(3);

    if (!matchedProducts || matchedProducts.length === 0) {
      await sendWhatsAppMessage(phone, `Sorry, we don't have "${query}" in stock right now. 😔`);
    } else {
      let reply = `🔍 *Search Results for "${query}":*\n\n`;
      matchedProducts.forEach(p => {
        const stockStatus = p.stock_quantity > 0 ? `✅ In Stock (${p.stock_quantity} ${p.unit})` : `❌ Out of Stock`;
        reply += `- *${p.name}*: ₹${p.price}/${p.unit}\n  ${stockStatus}\n\n`;
      });
      reply += `Reply with items and quantities to place an order! 🛒`;
      await sendWhatsAppMessage(phone, reply);
    }
    return { success: true, intent: 'product_query' };
  }

  async handleOrderStatus(phone) {
    const { data: customer } = await supabase.from('customers').select('id').eq('phone', phone).maybeSingle();
    if (!customer) {
      await sendWhatsAppMessage(phone, "We couldn't find any recent orders for your number. 🤷‍♂️");
      return { success: true, intent: 'order_status' };
    }

    const { data: latestOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestOrder) {
      await sendWhatsAppMessage(phone, "You haven't placed any orders yet. Send me a grocery list to get started! 🛒");
    } else {
      const statusIcon = latestOrder.status === 'pending' ? '⏳' : '✅';
      const msg = `📦 *Your Latest Order*\n\n*Order ID:* #${latestOrder.id}\n*Status:* ${latestOrder.status.toUpperCase()} ${statusIcon}\n*Amount:* ₹${latestOrder.total_amount}\n*Placed on:* ${new Date(latestOrder.created_at).toLocaleString()}\n\nWe will update you once it's out for delivery!`;
      await sendWhatsAppMessage(phone, msg);
    }
    return { success: true, intent: 'order_status' };
  }
}

module.exports = new IntentRouterService();
