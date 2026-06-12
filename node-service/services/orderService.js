const { createSupabaseClient } = require('./supabase');
const { createPythonServiceClient } = require('./pythonClient');
const { sendWhatsAppMessage, notifyOwner } = require('./whatsapp');

const supabase = createSupabaseClient();
const pythonClient = createPythonServiceClient();

/**
 * Service to orchestrate business logic for processing user messages.
 * Keeps business logic isolated from route handlers.
 */
class OrderService {
  /**
   * Process incoming customer message text.
   * Auto-registers customers, checks inventory, deducts stock, creates orders, and sends notifications.
   * 
   * @param {string} text - The raw text message.
   * @param {string} customerPhone - Sender phone number.
   * @param {string} customerName - Sender profile name.
   * @returns {Promise<Object>} - The processing result.
   */
  async processIncomingMessage(text, customerPhone, customerName) {
    if (!text || !text.trim()) {
      return { success: false, reason: 'Empty message text' };
    }

    const cleanPhone = customerPhone || '919876543210';
    const cleanName = customerName || 'Customer';

    console.log(`\n========================================`);
    console.log(`[OrderService] New Message Pipeline`);
    console.log(`👤 From:   ${cleanName} (${cleanPhone})`);
    console.log(`💬 Text:   "${text}"`);
    console.log(`========================================`);

    // 1. Call AI Parser via Python service client with fail-safe error handling
    let parsedResult;
    try {
      console.log(`[OrderService] Invoking LLaMA 3 AI Parser...`);
      parsedResult = await pythonClient.parseOrder(text);
      console.log(`[OrderService] AI Parsed Result:`, JSON.stringify(parsedResult, null, 2));
    } catch (error) {
      console.error(`[OrderService] AI Parser Crash, using fallback parser:`, error.message);
      // Fallback: Default to non_order to keep service active and safe from crashes
      parsedResult = { intent: 'non_order', items: [] };
    }

    // 2. Handle 'non_order' intent (chit-chat, greetings, questions)
    if (parsedResult.intent === 'non_order' || !parsedResult.items || parsedResult.items.length === 0) {
      console.log(`[OrderService] Non-order intent detected. Sending friendly help menu.`);
      
      const welcomeMessage = `Hello ${cleanName}! I am *ShopBot*, your AI grocery shopping assistant. 🛒\n\nYou can order groceries easily by sending me a text list in English, Hindi, or Hinglish!\n\n*Example:* \n_"2kg atta, 1 litre oil, and bread packet"_\n\nHow can I help you today? 😊`;
      await sendWhatsAppMessage(cleanPhone, welcomeMessage);
      
      return {
        success: true,
        intent: 'non_order',
        replySent: true
      };
    }

    // 3. Handle 'order' intent
    console.log(`[OrderService] Order intent confirmed. Processing customer registration...`);

    if (!supabase) {
      console.error('[OrderService] Supabase client is not initialized!');
      return { success: false, error: 'Database unavailable' };
    }

    try {
      // Step A: Register / Fetch Customer
      let customerRecord = null;
      const { data: existingCustomer, error: customerFetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (customerFetchError) {
        console.error('[OrderService] Customer lookup failed:', customerFetchError.message);
      }

      if (existingCustomer) {
        customerRecord = existingCustomer;
        console.log(`[OrderService] Found existing customer record for ${cleanPhone} (ID: ${customerRecord.id})`);
      } else {
        console.log(`[OrderService] Customer not found. Auto-registering ${cleanPhone}...`);
        const { data: newCustomer, error: customerInsertError } = await supabase
          .from('customers')
          .insert({ phone: cleanPhone, name: cleanName })
          .select()
          .single();

        if (customerInsertError) {
          console.error('[OrderService] Customer auto-registration failed:', customerInsertError.message);
          // Fallback to in-memory record to prevent halting pipeline
          customerRecord = { phone: cleanPhone, name: cleanName };
        } else {
          customerRecord = newCustomer;
          console.log(`[OrderService] Auto-registered successfully! Customer ID: ${customerRecord.id}`);
        }
      }

      // Step B: Inventory Check & Catalog Resolution
      console.log('[OrderService] Commencing catalog resolution and inventory stock check...');
      
      const validItems = [];
      const outOfStockItems = [];
      const notFoundItems = [];
      let totalAmount = 0;

      for (const parsedItem of parsedResult.items) {
        const itemName = parsedItem.item.trim().toLowerCase();
        const itemQty = Number(parsedItem.qty);

        // Fetch products matching the name (case-insensitive substring match)
        const { data: matchedProducts, error: productFetchError } = await supabase
          .from('products')
          .select('*')
          .ilike('name', `%${itemName}%`);

        if (productFetchError) {
          console.error(`[OrderService] Failed to query product "${itemName}":`, productFetchError.message);
        }

        // Product not found in shop catalog
        if (!matchedProducts || matchedProducts.length === 0) {
          console.log(`[OrderService] ❌ Catalog Miss: "${itemName}"`);
          notFoundItems.push({
            name: parsedItem.item,
            qty: itemQty,
            unit: parsedItem.unit || 'piece'
          });
          continue;
        }

        // Use the closest match (first index in search results)
        const product = matchedProducts[0];
        const stockAvailable = Number(product.stock_quantity);

        // Insufficient stock level
        if (stockAvailable < itemQty) {
          console.log(`[OrderService] ⚠️ Out of Stock: "${product.name}" (Requested: ${itemQty}, Available: ${stockAvailable})`);
          outOfStockItems.push({
            name: product.name,
            requestedQty: itemQty,
            availableQty: stockAvailable,
            unit: product.unit
          });
        } else {
          // Valid item! Calculate line totals
          const lineTotal = itemQty * Number(product.price);
          console.log(`[OrderService]  Valid Catalog Match: "${product.name}" - ${itemQty} ${product.unit} @ ₹${product.price} = ₹${lineTotal}`);
          
          validItems.push({
            product: product,
            quantity: itemQty,
            unit_price: Number(product.price),
            line_total: lineTotal
          });
          totalAmount += lineTotal;
        }
      }

      // Step C: Handle Case where NO valid items could be ordered
      if (validItems.length === 0) {
        console.log('[OrderService] Order processing aborted: no items can be supplied.');
        
        let outOfStockAlerts = '';
        if (outOfStockItems.length > 0) {
          outOfStockAlerts += `\n⚠️ *Out of Stock:* \n` + outOfStockItems.map(i => `- ${i.name} (${i.requestedQty} requested, only ${i.availableQty} available)`).join('\n');
        }
        if (notFoundItems.length > 0) {
          outOfStockAlerts += `\n❌ *Not Available:* \n` + notFoundItems.map(i => `- ${i.name} (does not exist in our shop)`).join('\n');
        }

        const failureReply = `🛒 *Order Alert - ShopBot*\n\nSorry, we could not place your order because the items are unavailable:\n${outOfStockAlerts}\n\nPlease try again with different items or quantities! 🙏`;
        await sendWhatsAppMessage(cleanPhone, failureReply);

        return {
          success: false,
          reason: 'items_unavailable',
          outOfStock: outOfStockItems,
          notFound: notFoundItems
        };
      }

      // Step D: Order Database Record Creation
      console.log(`[OrderService] Creating order in database for total ₹${totalAmount.toFixed(2)}...`);
      
      const { data: order, error: orderInsertError } = await supabase
        .from('orders')
        .insert({
          customer_phone: cleanPhone,
          total_amount: totalAmount,
          status: 'pending'
        })
        .select()
        .single();

      if (orderInsertError) {
        console.error('[OrderService] Order record insertion failed:', orderInsertError.message);
        throw new Error(`Order creation failed: ${orderInsertError.message}`);
      }

      console.log(`[OrderService] Order #${order.id} inserted successfully. Inserting line items...`);

      // Step E: Create Order Line Items
      const lineItems = validItems.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      const { error: lineInsertError } = await supabase
        .from('order_items')
        .insert(lineItems);

      if (lineInsertError) {
        console.error('[OrderService] Order items insertion failed:', lineInsertError.message);
        // Rollback created order to prevent orphaned pending orders with zero items
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(`Order line items insertion failed: ${lineInsertError.message}`);
      }

      // Step F: Stock Deduction & Reorder Checks
      console.log('[OrderService] Order registered. Commencing stock deduction...');
      const reorderAlerts = [];

      for (const item of validItems) {
        const remainingStock = Number(item.product.stock_quantity) - item.quantity;
        
        console.log(`[OrderService] Deducting stock for ${item.product.name}: ${item.product.stock_quantity} -> ${remainingStock}`);
        
        const { error: stockUpdateError } = await supabase
          .from('products')
          .update({ stock_quantity: remainingStock })
          .eq('id', item.product.id);

        if (stockUpdateError) {
          console.error(`[OrderService] Stock deduction failed for ${item.product.name}:`, stockUpdateError.message);
        }

        // Check if stock level falls below reorder level
        if (remainingStock <= Number(item.product.reorder_level)) {
          console.log(`[OrderService] 🚨 Reorder Warning: ${item.product.name} stock level (${remainingStock} ${item.product.unit}) is below reorder level (${item.product.reorder_level} ${item.product.unit})`);
          reorderAlerts.push({
            name: item.product.name,
            currentStock: remainingStock,
            reorderLevel: Number(item.product.reorder_level),
            unit: item.product.unit
          });
        }
      }

      // Step G: Dispatch Customer Receipt Confirmation
      console.log('[OrderService] Formatting customer confirmation receipt...');
      
      let itemLinesText = validItems
        .map(i => `- ${i.quantity.toFixed(1)} ${i.product.unit} *${i.product.name}* @ ₹${i.unit_price}/${i.product.unit} = ₹${i.line_total.toFixed(2)}`)
        .join('\n');

      let alertsText = '';
      if (outOfStockItems.length > 0) {
        alertsText += `\n\n⚠️ *Out of Stock Items (Excluded):*\n` + outOfStockItems.map(i => `- ${i.name} (Requested ${i.requestedQty}, only ${i.availableQty} available)`).join('\n');
      }
      if (notFoundItems.length > 0) {
        alertsText += `\n\n❌ *Not Available Items (Excluded):*\n` + notFoundItems.map(i => `- ${i.name}`).join('\n');
      }

      const receiptMessage = `🛒 *Order Placed Successfully!*

Dhanyawad! Aapka order receive ho gaya hai.

*Order ID:* #${order.id}
*Status:* Pending (Tayar kiya ja raha hai)

*Items Ordered:*
${itemLinesText}

*Total Amount:* ₹${totalAmount.toFixed(2)}${alertsText}

Ham aapko notify karenge jab order delivery ke liye nikalega! 🛵`;

      await sendWhatsAppMessage(cleanPhone, receiptMessage);
      console.log(`[OrderService] Confirmation dispatched to customer ${cleanPhone}`);

      // Step H: Dispatch Owner Alert Notification
      console.log('[OrderService] Formatting owner alert notification...');
      
      let ownerItemsText = validItems
        .map(i => `- ${i.quantity.toFixed(1)} ${i.product.unit} x *${i.product.name}*`)
        .join('\n');

      let ownerReorderText = '';
      if (reorderAlerts.length > 0) {
        ownerReorderText += `\n\n🚨 *Reorder Warnings (Stock Low):*\n` + reorderAlerts.map(r => `- *${r.name}*: stock is down to ${r.currentStock} ${r.unit} (reorder level: ${r.reorderLevel} ${r.unit})`).join('\n');
      }

      const ownerAlertMessage = `🛒 *New Order Received!*

*Order ID:* #${order.id}
*Customer:* ${cleanName} (${cleanPhone})
*Total Value:* ₹${totalAmount.toFixed(2)}

*Items to Pack:*
${ownerItemsText}${ownerReorderText}`;

      await notifyOwner(ownerAlertMessage);
      console.log(`[OrderService] Owner alert dispatched successfully.`);

      return {
        success: true,
        orderId: order.id,
        totalAmount,
        validItemsCount: validItems.length,
        reordersTriggered: reorderAlerts.length
      };

    } catch (err) {
      console.error('[OrderService] Transaction flow crashed:', err.message);
      
      // Send a friendly error reply to customer to avoid hanging states
      const systemErrorMsg = `⚠️ *ShopBot System Alert*\n\nSorry, we encountered a technical issue while processing your order. Please try again in a few moments, or contact the store owner.`;
      await sendWhatsAppMessage(cleanPhone, systemErrorMsg);
      
      return { success: false, error: err.message };
    }
  }
}

module.exports = new OrderService();
