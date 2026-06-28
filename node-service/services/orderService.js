const { createSupabaseClient } = require('./supabase');
const { sendWhatsAppMessage, sendWhatsAppImageFromFile } = require('./whatsapp');
const { addNotification } = require('./notificationStore');
const path = require('path');

const supabase = createSupabaseClient();

/**
 * Service to orchestrate business logic for processing user orders.
 */
class OrderService {
  /**
   * Process incoming customer order items.
   * Auto-registers customers, checks inventory, deducts stock, creates orders, and sends notifications.
   * 
   * @param {Array} items - List of parsed items from the intent.
   * @param {string} customerPhone - Sender phone number.
   * @param {string} customerName - Sender profile name.
   * @returns {Promise<Object>} - The processing result.
   */
  async processIncomingOrder(items, customerPhone, customerName) {
    if (!items || items.length === 0) {
      await sendWhatsAppMessage(customerPhone, "Please specify what you want to order. For example: '2kg atta'.");
      return { success: false, reason: 'Empty items' };
    }

    const cleanPhone = customerPhone || '919876543210';
    const cleanName = customerName || 'Customer';

    console.log(`\n========================================`);
    console.log(`[OrderService] Order Pipeline`);
    console.log(`👤 From:   ${cleanName} (${cleanPhone})`);
    console.log(`========================================`);

    if (!supabase) {
      console.error('[OrderService] Supabase client is not initialized!');
      return { success: false, error: 'Database unavailable' };
    }

    try {
      // Step A: Register / Fetch Customer
      let customerRecord = null;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerRecord = existingCustomer;
      } else {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({ phone: cleanPhone, name: cleanName })
          .select()
          .single();
        customerRecord = newCustomer || { phone: cleanPhone, name: cleanName };
      }

      // Step B: Inventory Check & Catalog Resolution
      console.log('[OrderService] Commencing catalog resolution and inventory stock check...');
      
      const validItems = [];
      const outOfStockItems = [];
      const notFoundItems = [];
      let totalAmount = 0;

      for (const parsedItem of items) {
        const itemName = parsedItem.item.trim().toLowerCase();
        const itemQty = Number(parsedItem.qty);

        // Fetch products matching the name (case-insensitive substring match)
        const { data: matchedProducts } = await supabase
          .from('products')
          .select('*')
          .ilike('name', `%${itemName}%`);

        if (!matchedProducts || matchedProducts.length === 0) {
          console.log(`[OrderService] ❌ Catalog Miss: "${itemName}"`);
          notFoundItems.push({
            name: parsedItem.item,
            qty: itemQty,
            unit: parsedItem.unit || 'piece'
          });
          continue;
        }

        const product = matchedProducts[0];
        const stockAvailable = Number(product.stock_quantity);

        if (stockAvailable < itemQty) {
          console.log(`[OrderService] ⚠️ Out of Stock: "${product.name}"`);
          outOfStockItems.push({
            name: product.name,
            requestedQty: itemQty,
            availableQty: stockAvailable,
            unit: product.unit
          });
        } else {
          const lineTotal = itemQty * Number(product.price);
          validItems.push({
            product: product,
            quantity: itemQty,
            unit_price: Number(product.price),
            line_total: lineTotal
          });
          totalAmount += lineTotal;
        }
      }

      if (validItems.length === 0) {
        console.log('[OrderService] Order processing aborted: no items can be supplied.');
        
        let outOfStockAlerts = '';
        if (outOfStockItems.length > 0) {
          outOfStockAlerts += `\n⚠️ *Out of Stock:* \n` + outOfStockItems.map(i => `- ${i.name} (${i.requestedQty} requested, only ${i.availableQty} available)`).join('\n');
        }
        if (notFoundItems.length > 0) {
          outOfStockAlerts += `\n❌ *Not Available:* \n` + notFoundItems.map(i => `- ${i.name} (does not exist in our shop)`).join('\n');
        }

        const failureReply = `🛒 *Order Alert - pikk*\n\nSorry, we could not place your order because the items are unavailable:\n${outOfStockAlerts}\n\nPlease try again with different items or quantities! 🙏`;
        await sendWhatsAppMessage(cleanPhone, failureReply);

        return {
          success: false,
          reason: 'items_unavailable'
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
        throw new Error(`Order creation failed: ${orderInsertError.message}`);
      }

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
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(`Order line items insertion failed: ${lineInsertError.message}`);
      }

      // Step F: Stock Deduction & Reorder Checks
      console.log('[OrderService] Order registered. Commencing stock deduction...');

      for (const item of validItems) {
        const remainingStock = Number(item.product.stock_quantity) - item.quantity;
        
        await supabase
          .from('products')
          .update({ stock_quantity: remainingStock })
          .eq('id', item.product.id);

        if (remainingStock === 0) {
          console.log(`[OrderService] OUT OF STOCK alert for "${item.product.name}"`);
          addNotification(
            'out_of_stock',
            `${item.product.name} is now out of stock`,
            { id: item.product.id, name: item.product.name, stock: 0, unit: item.product.unit }
          );
        } else if (remainingStock <= Number(item.product.reorder_level)) {
          console.log(`[OrderService] LOW STOCK alert for "${item.product.name}" (${remainingStock} ${item.product.unit})`);
          addNotification(
            'low_stock',
            `${item.product.name} is low on stock: ${remainingStock} ${item.product.unit} remaining (reorder at ${item.product.reorder_level})`,
            { id: item.product.id, name: item.product.name, stock: remainingStock, reorderLevel: Number(item.product.reorder_level), unit: item.product.unit }
          );
        }
      }

      if (outOfStockItems.length > 0) {
        const names = outOfStockItems.map(i => i.name).join(', ');
        addNotification(
          'order_alert',
          `Order #${order.id}: ${names} excluded — requested quantity exceeds available stock`,
          null
        );
      }

      if (notFoundItems.length > 0) {
        const names = notFoundItems.map(i => i.name).join(', ');
        addNotification(
          'order_alert',
          `Order #${order.id}: ${names} not found in catalog`,
          null
        );
      }

      // Step G: Dispatch Customer Receipt Confirmation
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

      // Step H: Send QR code for payment
      const qrPath = path.join(__dirname, '..', '..', 'python-service', 'assets', 'qr_image.png.jpeg');
      const qrCaption = `Scan to pay ₹${totalAmount.toFixed(2)} for Order #${order.id}`;
      await sendWhatsAppImageFromFile(cleanPhone, qrPath, qrCaption);

      return {
        success: true,
        orderId: order.id,
        totalAmount,
        validItemsCount: validItems.length
      };

    } catch (err) {
      console.error('[OrderService] Transaction flow crashed:', err.message);
      const systemErrorMsg = `⚠️ *pikk System Alert*\n\nSorry, we encountered a technical issue while processing your order. Please try again.`;
      await sendWhatsAppMessage(cleanPhone, systemErrorMsg);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new OrderService();
