// One place for website-order status changes, shared by the Admin panel and the
// Store System, so stock reservations and the sales ledger always stay in sync.
const { saleUnitCost } = require('./inventory');
const { exchangeRate } = require('./pricing');

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

function updateOrderStatus(db, order, status, staffName) {
  if (!ORDER_STATUSES.includes(status)) throw new Error('Invalid status.');
  if (order.status === status) return;
  const orderId = order.id;
  db.transaction(() => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId);

    // Re-activate a cancelled order by reserving its stock again.
    if (order.status === 'cancelled' && status !== 'cancelled' && !order.stock_reserved) {
      for (const item of items) {
        if (!item.product_id || !Number(item.stock_deduction)) continue;
        const p = db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
        if (!p || !p.track_stock) continue;
        if (Number(item.stock_deduction) > Number(p.stock_qty || 0)) throw new Error(`Not enough stock to reactivate ${item.product_name}.`);
      }
      for (const item of items) {
        if (!item.product_id || !Number(item.stock_deduction)) continue;
        const p = db.prepare('SELECT track_stock FROM products WHERE id=?').get(item.product_id);
        if (!p?.track_stock) continue;
        db.prepare('UPDATE products SET stock_qty=stock_qty-?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.stock_deduction, item.product_id);
        db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
          VALUES (?,'sale',?,'online_order',?,'Order reactivated',?)`).run(item.product_id, -Number(item.stock_deduction), orderId, staffName);
      }
      db.prepare('UPDATE orders SET stock_reserved=1 WHERE id=?').run(orderId);
    }

    // Cancelling a reserved order returns exactly what was reserved.
    if (status === 'cancelled' && order.status !== 'cancelled' && order.stock_reserved) {
      for (const item of items) {
        if (!item.product_id || !Number(item.stock_deduction)) continue;
        const p = db.prepare('SELECT track_stock FROM products WHERE id=?').get(item.product_id);
        if (!p?.track_stock) continue;
        db.prepare('UPDATE products SET stock_qty=stock_qty+?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.stock_deduction, item.product_id);
        db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,note,staff_name)
          VALUES (?,'return',?,'online_order',?,'Online order cancelled',?)`).run(item.product_id, Number(item.stock_deduction), orderId, staffName);
      }
      db.prepare('UPDATE orders SET stock_reserved=0 WHERE id=?').run(orderId);
    }

    let salesId = order.sales_id;
    if (status === 'delivered') {
      if (!salesId) {
        // The sales ledger is in LBP; convert USD website orders at the current rate.
        const rate = exchangeRate(Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])));
        const k = order.currency === 'USD' ? rate : 1;
        const saleInfo = db.prepare(`
          INSERT INTO sales(sale_number,customer_name,customer_phone,subtotal,discount,total,payment_method,
            exchange_rate,tendered_lbp,tendered_usd,change_lbp,change_usd,shift_id,cashier_name,notes,status,source)
          VALUES (?,?,?,?,0,?,?,?,0,0,0,0,NULL,'Online Store',?,'completed','online')
        `).run('WEB-' + order.order_number, order.customer_name, order.customer_phone,
          Math.round(order.subtotal * k), Math.round(order.total * k), order.payment_method, rate,
          `Website order ${order.order_number}`);
        salesId = saleInfo.lastInsertRowid;
        const insertSaleItem = db.prepare(`
          INSERT INTO sale_items(sale_id,product_id,product_name,quantity,size_ml,stock_deduction,unit_price,unit_cost,line_total,note)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `);
        for (const item of items) {
          const p = item.product_id ? db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id) : null;
          const cost = p ? saleUnitCost(p, item.size_ml) : 0;
          const unit = Math.round(item.price * k);
          insertSaleItem.run(salesId, item.product_id, item.product_name, item.quantity, item.size_ml, item.stock_deduction, unit, cost, unit * item.quantity, 'Online order');
        }
        db.prepare('UPDATE orders SET sales_id=? WHERE id=?').run(salesId, orderId);
      } else {
        db.prepare("UPDATE sales SET status='completed', refunded_at=NULL WHERE id=?").run(salesId);
      }
    } else if (salesId && order.status === 'delivered') {
      db.prepare("UPDATE sales SET status=?, refunded_at=CASE WHEN ?='refunded' THEN CURRENT_TIMESTAMP ELSE refunded_at END WHERE id=?")
        .run(status === 'cancelled' ? 'refunded' : 'voided', status === 'cancelled' ? 'refunded' : 'voided', salesId);
    } else if (salesId && status === 'cancelled') {
      db.prepare("UPDATE sales SET status='refunded', refunded_at=CURRENT_TIMESTAMP WHERE id=?").run(salesId);
    }

    db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, orderId);
  })();
}

module.exports = { ORDER_STATUSES, updateOrderStatus };
