(() => {
  const ctx = window.SYSTEM_CONTEXT || { user:{role:'cashier'}, exchangeRate:89500 };
  let exchangeRate = Number(ctx.exchangeRate || 89500);
  let cart = [];
  let inventoryMap = new Map();
  let purchaseCart = [];
  let currentProducts = [];

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => Math.round(Number(n || 0)).toLocaleString() + ' LBP';
  const usd = n => '$' + Number(n || 0).toFixed(2);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off*60000).toISOString().slice(0,10);
  };
  function toast(message, error=false) {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.className = 'sys-toast show' + (error ? ' error' : '');
    clearTimeout(el._t); el._t = setTimeout(() => el.className='sys-toast', 2600);
  }
  async function api(url, options={}) {
    const opts = {...options};
    opts.headers = {...(opts.headers||{})};
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type']='application/json';
      opts.body=JSON.stringify(opts.body);
    }
    const res = await fetch(url, opts);
    let data={};
    try { data=await res.json(); } catch(_) {}
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function setTab(name) {
    $$('.sys-tab').forEach(x=>x.classList.remove('active'));
    $$('#nav [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
    const tab=$('#tab-'+name); if(tab) tab.classList.add('active');
    $('#sidebar')?.classList.remove('open'); $('#overlay')?.classList.remove('open');
    if(name==='dashboard') loadDashboard();
    if(name==='pos') { searchPos(); loadShift(); }
    if(name==='inventory') loadInventory();
    if(name==='sales') loadSales();
    if(name==='customers') loadCustomers();
    if(name==='purchases') loadPurchases();
    if(name==='expenses') loadExpenses();
    if(name==='reports') loadReports();
    if(name==='team') loadUsers();
  }
  $$('#nav [data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.go)));
  $('#menuBtn')?.addEventListener('click',()=>{ $('#sidebar').classList.add('open'); $('#overlay').classList.add('open'); });
  $('#overlay')?.addEventListener('click',()=>{ $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('open'); });
  $$('.sys-modal-close').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close)?.classList.remove('open')));

  async function loadDashboard() {
    try {
      const d=await api('/system/api/dashboard');
      const t=d.today;
      const metrics = ctx.user.role === 'cashier'
        ? [
            ['Sales Today',fmt(t.sales_total),''],
            ['Transactions',Number(t.sales_count).toLocaleString(),''],
            ['Low Stock',Number(d.lowStock).toLocaleString(),d.lowStock>0?'bad':'good'],
            ['Catalog Items',Number(d.products).toLocaleString(),'']
          ]
        : [
            ['Sales Today',fmt(t.sales_total),''],
            ['Transactions',Number(t.sales_count).toLocaleString(),''],
            ['Gross Profit',fmt(t.gross_profit),t.gross_profit>=0?'good':'bad'],
            ['Expenses',fmt(t.expenses),t.expenses>0?'bad':''],
            ['Net Profit',fmt(t.net_profit),t.net_profit>=0?'good':'bad']
          ];
      $('#dashboardMetrics').innerHTML = metrics.map(x=>`<div class="sys-metric ${x[2]}"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
      $('#recentSales').innerHTML = d.recent.length ? `<div class="sys-table-wrap"><table class="sys-table"><thead><tr><th>Sale</th><th>Customer</th><th>Cashier</th><th>Payment</th><th>Total</th></tr></thead><tbody>${d.recent.map(s=>`<tr><td>${esc(s.sale_number)}</td><td>${esc(s.customer_name||'Walk-in')}</td><td>${esc(s.cashier_name)}</td><td>${esc(s.payment_method)}</td><td><b>${fmt(s.total)}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="sys-empty">No sales yet.</div>';
      renderShift(d.shift);
      $('#posShiftBadge').innerHTML = d.shift ? '<span class="sys-pill green">Shift open</span>' : '<span class="sys-pill red">No open shift</span>';
    } catch(e){ toast(e.message,true); }
  }
  $('#refreshDashboard')?.addEventListener('click',loadDashboard);

  function renderShift(shift) {
    const box=$('#shiftBox'), btn=$('#shiftActionBtn'); if(!box||!btn) return;
    if(!shift) {
      box.innerHTML='<p class="muted">No open shift. Open one before starting the register.</p>';
      btn.textContent='Open Shift'; btn.onclick=()=>openShiftModal(false);
    } else {
      box.innerHTML=`<div class="sys-kv"><b>Opened</b><span>${new Date(shift.opened_at+'Z').toLocaleString()}</span><b>Opening LBP</b><span>${fmt(shift.opening_lbp)}</span><b>Opening USD</b><span>${usd(shift.opening_usd)}</span></div>`;
      btn.textContent='Close Shift'; btn.onclick=()=>openShiftModal(true);
    }
  }
  async function loadShift(){ try{const d=await api('/system/api/shift');renderShift(d.shift);$('#posShiftBadge').innerHTML=d.shift?'<span class="sys-pill green">Shift open</span>':'<span class="sys-pill red">No open shift</span>';}catch(_){} }
  function openShiftModal(closing) {
    const m=$('#shiftModal'), c=$('#shiftModalContent'); if(!m||!c)return;
    c.innerHTML = closing ? `<h2>Close Shift</h2><form id="shiftForm" class="sys-form"><label>Counted cash LBP<input name="closing_lbp" type="number" min="0" required></label><label>Counted cash USD<input name="closing_usd" type="number" min="0" step="0.01" required></label><label>Notes<textarea name="notes"></textarea></label><button class="sys-btn sys-btn--primary">Close & Reconcile</button></form>` : `<h2>Open Shift</h2><form id="shiftForm" class="sys-form"><label>Opening cash LBP<input name="opening_lbp" type="number" min="0" value="0"></label><label>Opening cash USD<input name="opening_usd" type="number" min="0" step="0.01" value="0"></label><button class="sys-btn sys-btn--primary">Open Register</button></form>`;
    m.classList.add('open');
    $('#shiftForm').onsubmit=async ev=>{
      ev.preventDefault(); const fd=Object.fromEntries(new FormData(ev.target));
      try {
        const r=await api('/system/api/shift/'+(closing?'close':'open'),{method:'POST',body:fd});
        if(closing) toast('Shift closed. Difference: '+fmt(r.difference_lbp)+' / '+usd(r.difference_usd));
        else toast('Shift opened.');
        m.classList.remove('open'); loadDashboard();
      }catch(e){toast(e.message,true)}
    };
  }

  $('#exchangeForm')?.addEventListener('submit',async e=>{
    e.preventDefault(); const rate=Number(new FormData(e.target).get('exchange_rate'));
    try { await api('/system/api/settings/exchange-rate',{method:'POST',body:{exchange_rate:rate}}); exchangeRate=rate; toast('Exchange rate saved.'); renderCart(); } catch(err){toast(err.message,true)}
  });

  async function searchPos() {
    const q=$('#posSearch')?.value||'';
    try {
      const d=await api('/system/api/products?q='+encodeURIComponent(q)+'&limit=120');
      currentProducts=d.products;
      $('#posProducts').innerHTML=d.products.length?d.products.map(p=>{
        const stock=p.track_stock?`<div class="sys-product-stock">${p.stock_qty} in stock</div>`:'';
        const img=p.image_path?`<img src="${esc(p.image_path)}" alt="">`:'';
        return `<button class="sys-product" data-add="${p.id}">${img}<strong>${esc(p.name_en)}</strong><small>${esc(p.brand||'')}</small><div class="sys-product-price">${fmt(p.price)}</div>${stock}</button>`;
      }).join(''):'<div class="sys-empty">No products found.</div>';
      $$('[data-add]').forEach(b=>b.onclick=()=>addToCart(Number(b.dataset.add)));
    } catch(e){toast(e.message,true)}
  }
  $('#posSearchBtn')?.addEventListener('click',searchPos);
  $('#posSearch')?.addEventListener('keydown',async e=>{
    if(e.key==='Enter'){e.preventDefault();await searchPos();const q=e.target.value.trim();const exact=currentProducts.find(p=>p.barcode===q||p.sku===q);if(exact)addToCart(exact.id);}
  });
  let posTimer;
  $('#posSearch')?.addEventListener('input',()=>{clearTimeout(posTimer);posTimer=setTimeout(searchPos,250)});

  function addToCart(id) {
    const p=currentProducts.find(x=>x.id===id); if(!p)return;
    if(p.track_stock && Number(p.stock_qty)<=0){toast('This item is out of stock.',true);return;}
    const row=cart.find(x=>x.product_id===id);
    if(row){ if(p.track_stock && row.quantity+1>Number(p.stock_qty)){toast('Not enough stock.',true);return;} row.quantity+=1; }
    else cart.push({product_id:p.id,name:p.name_en,price:Number(p.price||0),quantity:1,stock:Number(p.stock_qty||0),tracked:!!p.track_stock});
    renderCart();
  }
  function renderCart() {
    const host=$('#cartItems'), totals=$('#cartTotals'); if(!host||!totals)return;
    host.innerHTML=cart.length?cart.map((x,i)=>`<div class="sys-cart-row"><div><strong>${esc(x.name)}</strong><small>${fmt(x.price)} × ${x.quantity}</small></div><div class="sys-cart-controls"><button data-dec="${i}">−</button><b>${x.quantity}</b><button data-inc="${i}">+</button><button data-remove="${i}">×</button></div></div>`).join(''):'<div class="sys-empty">Cart is empty.</div>';
    const subtotal=cart.reduce((s,x)=>s+x.price*x.quantity,0);
    const discount=Math.min(Number($('#saleDiscount')?.value||0),subtotal);
    const total=subtotal-discount;
    totals.innerHTML=`<div class="sys-total-line"><span>Subtotal</span><b>${fmt(subtotal)}</b></div><div class="sys-total-line"><span>Discount</span><b>− ${fmt(discount)}</b></div><div class="sys-total-line total"><span>Total</span><span>${fmt(total)}</span></div><div class="sys-total-line"><span>USD approx.</span><span>${usd(total/exchangeRate)}</span></div>`;
    $$('[data-dec]').forEach(b=>b.onclick=()=>{const i=+b.dataset.dec;cart[i].quantity-=1;if(cart[i].quantity<=0)cart.splice(i,1);renderCart()});
    $$('[data-inc]').forEach(b=>b.onclick=()=>{const i=+b.dataset.inc;if(cart[i].tracked&&cart[i].quantity+1>cart[i].stock)return toast('Not enough stock.',true);cart[i].quantity+=1;renderCart()});
    $$('[data-remove]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.remove,1);renderCart()});
  }
  $('#saleDiscount')?.addEventListener('input',renderCart);
  $('#clearCart')?.addEventListener('click',()=>{cart=[];renderCart()});
  $('#completeSale')?.addEventListener('click',async()=>{
    if(!cart.length)return toast('Cart is empty.',true);
    const subtotal=cart.reduce((s,x)=>s+x.price*x.quantity,0);
    const discount=Math.min(Number($('#saleDiscount').value||0),subtotal);
    const total=subtotal-discount;
    const method=$('#paymentMethod').value;
    let tl=Number($('#tenderedLbp').value||0), tu=Number($('#tenderedUsd').value||0);
    if(method==='cash_lbp'&&tl<=0)tl=total;
    if(method==='cash_usd'&&tu<=0)tu=total/exchangeRate;
    try{
      const r=await api('/system/api/sales',{method:'POST',body:{
        items:cart.map(x=>({product_id:x.product_id,quantity:x.quantity,unit_price:x.price})),
        customer_name:$('#customerName').value,customer_phone:$('#customerPhone').value,
        discount,payment_method:method,exchange_rate:exchangeRate,tendered_lbp:tl,tendered_usd:tu,notes:$('#saleNotes').value
      }});
      toast('Sale '+r.number+' completed.');
      cart=[]; $('#customerName').value='';$('#customerPhone').value='';$('#saleDiscount').value='0';$('#tenderedLbp').value='0';$('#tenderedUsd').value='0';$('#saleNotes').value='';renderCart();searchPos();loadDashboard();
      showSale(r.saleId,true);
    }catch(e){toast(e.message,true)}
  });

  async function loadInventory(){
    const q=$('#inventorySearch')?.value||''; const low=$('#lowStockOnly')?.checked?'&low=1':'';
    try{
      const d=await api('/system/api/products?q='+encodeURIComponent(q)+'&limit=200'+low);
      inventoryMap=new Map(d.products.map(p=>[p.id,p]));
      $('#inventoryRows').innerHTML=d.products.length?d.products.map(p=>`<tr><td><b>${esc(p.name_en)}</b><br><small>${esc(p.category)} · ${esc(p.type)}</small></td><td>${esc(p.brand)}</td><td>${fmt(p.price)}</td><td>${fmt(p.cost_price)}</td><td class="${p.track_stock&&p.stock_qty<=p.low_stock_threshold?'danger':''}">${p.track_stock?esc(p.stock_qty):'<span class="muted">Not tracked</span>'}</td><td>${esc(p.sku||'—')}<br><small>${esc(p.barcode||'')}</small></td><td><button class="sys-btn sys-btn--small" data-edit-inv="${p.id}">Edit</button></td></tr>`).join(''):'<tr><td colspan="7" class="sys-empty">No products found.</td></tr>';
      $$('[data-edit-inv]').forEach(b=>b.onclick=()=>openInventory(Number(b.dataset.editInv)));
    }catch(e){toast(e.message,true)}
  }
  $('#inventorySearchBtn')?.addEventListener('click',loadInventory);
  $('#lowStockOnly')?.addEventListener('change',loadInventory);
  $('#inventorySearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadInventory()}});
  function openInventory(id){
    const p=inventoryMap.get(id);if(!p)return;
    const f=$('#inventoryForm'); f.id.value=p.id; $('#inventoryProductName').textContent=p.name_en;
    f.price.value=p.price??0;f.cost_price.value=p.cost_price??0;f.stock_qty.value=p.stock_qty??0;f.low_stock_threshold.value=p.low_stock_threshold??5;f.sku.value=p.sku||'';f.barcode.value=p.barcode||'';f.track_stock.checked=!!p.track_stock;f.in_stock.checked=!!p.in_stock;
    $('#adjustForm').id.value=p.id; $('#adjustForm').quantity.value=''; $('#adjustForm').note.value='';
    $('#inventoryModal').classList.add('open');
  }
  $('#inventoryForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target;
    try{await api('/system/api/products/'+f.id.value+'/inventory',{method:'POST',body:{price:f.price.value,cost_price:f.cost_price.value,stock_qty:f.stock_qty.value,low_stock_threshold:f.low_stock_threshold.value,sku:f.sku.value,barcode:f.barcode.value,track_stock:f.track_stock.checked,in_stock:f.in_stock.checked}});toast('Inventory saved.');$('#inventoryModal').classList.remove('open');loadInventory();}catch(err){toast(err.message,true)}
  });
  $('#adjustForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target;
    try{await api('/system/api/products/'+f.id.value+'/adjust',{method:'POST',body:{quantity:f.quantity.value,note:f.note.value}});toast('Stock adjusted.');$('#inventoryModal').classList.remove('open');loadInventory();}catch(err){toast(err.message,true)}
  });

  function initDates(){
    ['salesFrom','salesTo','reportFrom','reportTo'].forEach(id=>{const el=$('#'+id);if(el&&!el.value)el.value=today()});
  }
  async function loadSales(){
    initDates(); if(!$('#salesRows'))return;
    const from=$('#salesFrom').value,to=$('#salesTo').value;
    try{const d=await api('/system/api/sales?from='+from+'&to='+to);$('#salesRows').innerHTML=d.sales.length?d.sales.map(s=>`<tr><td><b>${esc(s.sale_number)}</b></td><td>${new Date(s.created_at+'Z').toLocaleString()}</td><td>${esc(s.customer_name||'Walk-in')}</td><td>${esc(s.cashier_name)}</td><td>${esc(s.payment_method)}</td><td><b>${fmt(s.total)}</b></td><td><span class="sys-pill ${s.status==='completed'?'green':'red'}">${esc(s.status)}</span></td><td><button class="sys-btn sys-btn--small" data-sale="${s.id}">View</button></td></tr>`).join(''):'<tr><td colspan="8" class="sys-empty">No sales in this period.</td></tr>';$$('[data-sale]').forEach(b=>b.onclick=()=>showSale(Number(b.dataset.sale),false));}catch(e){toast(e.message,true)}
  }
  $('#salesFilterBtn')?.addEventListener('click',loadSales);
  async function showSale(id,printAfter){
    try{
      const d=await api('/system/api/sales/'+id),s=d.sale;
      const canRefund=['owner','manager'].includes(ctx.user.role)&&s.status==='completed';
      $('#saleDetail').innerHTML=`<h2>${esc(s.sale_number)}</h2><div class="sys-kv"><b>Date</b><span>${new Date(s.created_at+'Z').toLocaleString()}</span><b>Customer</b><span>${esc(s.customer_name||'Walk-in')} ${esc(s.customer_phone||'')}</span><b>Cashier</b><span>${esc(s.cashier_name)}</span><b>Payment</b><span>${esc(s.payment_method)}</span><b>Status</b><span>${esc(s.status)}</span></div><h3 class="sys-section-title">Items</h3><table class="sys-sale-items"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${d.items.map(i=>`<tr><td>${esc(i.product_name)}</td><td>${i.quantity}</td><td>${fmt(i.unit_price)}</td><td>${fmt(i.line_total)}</td></tr>`).join('')}</tbody></table><div class="sys-kv"><b>Subtotal</b><span>${fmt(s.subtotal)}</span><b>Discount</b><span>${fmt(s.discount)}</span><b>Total</b><strong>${fmt(s.total)}</strong></div><div style="display:flex;gap:8px;margin-top:18px"><button class="sys-btn" onclick="window.print()">Print Receipt</button>${canRefund?`<button class="sys-btn" id="refundSale">Refund Sale</button>`:''}</div>`;
      $('#saleModal').classList.add('open');
      if(canRefund)$('#refundSale').onclick=async()=>{if(!confirm('Refund this full sale and return tracked stock?'))return;try{await api('/system/api/sales/'+id+'/refund',{method:'POST',body:{}});toast('Sale refunded.');$('#saleModal').classList.remove('open');loadSales();loadDashboard()}catch(e){toast(e.message,true)}};
      if(printAfter) setTimeout(()=>window.print(),180);
    }catch(e){toast(e.message,true)}
  }

  async function loadCustomers(){
    if(!$('#customerRows'))return;const q=$('#customerSearch')?.value||'';
    try{const d=await api('/system/api/customers?q='+encodeURIComponent(q));$('#customerRows').innerHTML=d.customers.length?d.customers.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.phone||'—')}</td><td>${c.visits}</td><td>${fmt(c.total_spent)}</td></tr>`).join(''):'<tr><td colspan="4" class="sys-empty">No customers.</td></tr>';}catch(e){toast(e.message,true)}
  }
  $('#customerSearchBtn')?.addEventListener('click',loadCustomers);
  $('#customerForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));try{await api('/system/api/customers',{method:'POST',body});e.target.reset();toast('Customer added.');loadCustomers()}catch(err){toast(err.message,true)}});

  async function loadSuppliers(){
    if(!$('#purchaseSupplier'))return [];
    const d=await api('/system/api/suppliers');
    $('#purchaseSupplier').innerHTML='<option value="">No supplier</option>'+d.suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    $('#supplierList').innerHTML=d.suppliers.map(s=>`<div class="sys-list-row"><b>${esc(s.name)}</b><span>${esc(s.phone||'')}</span></div>`).join('')||'<div class="sys-empty">No suppliers yet.</div>';
    return d.suppliers;
  }
  async function loadPurchases(){
    if(!$('#purchaseHistory'))return;
    try{await loadSuppliers();const d=await api('/system/api/purchases');$('#purchaseHistory').innerHTML=d.purchases.length?`<div class="sys-table-wrap"><table class="sys-table"><thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Total Cost</th><th>By</th></tr></thead><tbody>${d.purchases.map(p=>`<tr><td>${new Date(p.created_at+'Z').toLocaleString()}</td><td>${esc(p.supplier_name||'—')}</td><td>${esc(p.invoice_number||'—')}</td><td>${fmt(p.total_cost_lbp)}</td><td>${esc(p.staff_name||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="sys-empty">No purchases yet.</div>';renderPurchaseCart();}catch(e){toast(e.message,true)}
  }
  $('#supplierForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));try{await api('/system/api/suppliers',{method:'POST',body});e.target.reset();toast('Supplier added.');loadSuppliers()}catch(err){toast(err.message,true)}});
  async function searchPurchaseProducts(){
    try{const d=await api('/system/api/products?q='+encodeURIComponent($('#purchaseProductSearch').value)+'&limit=30');$('#purchaseProductResults').innerHTML=d.products.map(p=>`<div class="sys-mini-result" data-purchase-add="${p.id}"><span><b>${esc(p.name_en)}</b><br><small>${esc(p.brand)}</small></span><span>${fmt(p.cost_price)}</span></div>`).join('')||'<div class="sys-empty">No products.</div>';currentProducts=d.products;$$('[data-purchase-add]').forEach(b=>b.onclick=()=>addPurchaseItem(Number(b.dataset.purchaseAdd)));}catch(e){toast(e.message,true)}
  }
  $('#purchaseProductBtn')?.addEventListener('click',searchPurchaseProducts);
  $('#purchaseProductSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchPurchaseProducts()}});
  function addPurchaseItem(id){const p=currentProducts.find(x=>x.id===id);if(!p)return;const found=purchaseCart.find(x=>x.product_id===id);if(found)found.quantity+=1;else purchaseCart.push({product_id:id,name:p.name_en,quantity:1,unit_cost:Number(p.cost_price||0)});renderPurchaseCart()}
  function renderPurchaseCart(){const h=$('#purchaseItems');if(!h)return;h.innerHTML=purchaseCart.length?purchaseCart.map((x,i)=>`<div class="sys-purchase-row"><b>${esc(x.name)}</b><input type="number" min=".01" step=".01" value="${x.quantity}" data-pq="${i}"><input type="number" min="0" value="${x.unit_cost}" data-pc="${i}"><button class="sys-link-btn danger" data-pr="${i}">×</button></div>`).join('')+'<div class="sys-total-line total"><span>Total cost</span><span>'+fmt(purchaseCart.reduce((s,x)=>s+x.quantity*x.unit_cost,0))+'</span></div>':'<div class="sys-empty">Add products to receive stock.</div>';$$('[data-pq]').forEach(el=>el.oninput=()=>{purchaseCart[+el.dataset.pq].quantity=Number(el.value||0);renderPurchaseCart()});$$('[data-pc]').forEach(el=>el.onchange=()=>{purchaseCart[+el.dataset.pc].unit_cost=Number(el.value||0);renderPurchaseCart()});$$('[data-pr]').forEach(el=>el.onclick=()=>{purchaseCart.splice(+el.dataset.pr,1);renderPurchaseCart()})}
  $('#savePurchase')?.addEventListener('click',async()=>{if(!purchaseCart.length)return toast('Add at least one product.',true);try{await api('/system/api/purchases',{method:'POST',body:{supplier_id:$('#purchaseSupplier').value||null,invoice_number:$('#purchaseInvoice').value,items:purchaseCart}});purchaseCart=[];$('#purchaseInvoice').value='';toast('Purchase saved and stock updated.');loadPurchases()}catch(e){toast(e.message,true)}});

  async function loadExpenses(){
    if(!$('#expenseList'))return;
    try{const d=await api('/system/api/expenses');$('#expenseList').innerHTML=d.expenses.length?`<div class="sys-table-wrap"><table class="sys-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>${d.expenses.map(x=>`<tr><td>${new Date(x.created_at+'Z').toLocaleString()}</td><td>${esc(x.category)}</td><td>${esc(x.description)}</td><td>${fmt(Number(x.amount_lbp)+Number(x.amount_usd)*Number(x.exchange_rate))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="sys-empty">No expenses today.</div>';}catch(e){toast(e.message,true)}
  }
  $('#expenseForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.exchange_rate=exchangeRate;try{await api('/system/api/expenses',{method:'POST',body});e.target.reset();toast('Expense saved.');loadExpenses();loadDashboard()}catch(err){toast(err.message,true)}});

  async function loadReports(){
    initDates();if(!$('#reportMetrics'))return;
    const from=$('#reportFrom').value,to=$('#reportTo').value;
    try{const d=await api('/system/api/reports?from='+from+'&to='+to);$('#reportMetrics').innerHTML=[['Revenue',d.sales.revenue,''],['COGS',d.cogs,'bad'],['Gross Profit',d.gross_profit,d.gross_profit>=0?'good':'bad'],['Expenses',d.expenses,'bad'],['Net Profit',d.net_profit,d.net_profit>=0?'good':'bad']].map(x=>`<div class="sys-metric ${x[2]}"><b>${fmt(x[1])}</b><span>${x[0]}</span></div>`).join('');$('#topProducts').innerHTML=d.top.map((x,i)=>`<div class="sys-list-row"><span>${i+1}. <b>${esc(x.product_name)}</b> <small>×${x.qty}</small></span><span>${fmt(x.revenue)}</span></div>`).join('')||'<div class="sys-empty">No sales.</div>';$('#paymentReport').innerHTML=d.payments.map(x=>`<div class="sys-list-row"><span><b>${esc(x.payment_method)}</b> · ${x.count} sales</span><span>${fmt(x.total)}</span></div>`).join('')||'<div class="sys-empty">No payments.</div>';}catch(e){toast(e.message,true)}
  }
  $('#reportBtn')?.addEventListener('click',loadReports);

  async function loadUsers(){
    if(!$('#userList'))return;
    try{const d=await api('/system/api/users');$('#userList').innerHTML=d.users.map(u=>`<div class="sys-list-row"><span><b>${esc(u.full_name)}</b><br><small>${esc(u.username)} · ${esc(u.role)}</small></span><button class="sys-btn sys-btn--small" data-toggle-user="${u.id}">${u.active?'Disable':'Enable'}</button></div>`).join('')||'<div class="sys-empty">No staff users.</div>';$$('[data-toggle-user]').forEach(b=>b.onclick=async()=>{try{await api('/system/api/users/'+b.dataset.toggleUser+'/toggle',{method:'POST',body:{}});loadUsers()}catch(e){toast(e.message,true)}});}catch(e){toast(e.message,true)}
  }
  $('#userForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));try{await api('/system/api/users',{method:'POST',body});e.target.reset();toast('User created.');loadUsers()}catch(err){toast(err.message,true)}});

  initDates();
  renderCart();
  loadDashboard();
})();
