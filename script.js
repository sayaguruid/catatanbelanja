// --- KONFIGURASI URL WEB APP ---
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyo65StO07OygmbXGwFzoE-FVCGB9u-VfC9S9IL1uv78XxeeZpRMrLhdMlOLJqXiY2H/exec'; 

// --- KONFIGURASI SESI & KODE RAHASIA ---
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 Jam
const SECRET_CODE = "buka";        // Ketik ini di keyboard untuk membuka aplikasi asli
const SECRET_TAP_COUNT = 7;        // Jumlah tap pada header untuk membuka (Mobile)

// --- STATE GLOBAL APLIKASI ASLI ---
let user = null;
let authToken = null;
let configData = [];
let allTransactions = [];
let isEditing = false;
let editId = null;
let targetsData = {}; 

// --- STATE GLOBAL FAKE KASIR & RAHASIA ---
let posCart = [];
let appRevealed = false;
let secretBuffer = "";
let secretTimer = null;
let tapCount = 0;
let tapTimer = null;

// --- DATABASE PRODUK KASIR (FAKE) ---
const POS_PRODUCTS = [
    { id: 1, name: "Beras Premium 5kg", price: 72000, icon: "🍚" },
    { id: 2, name: "Minyak Goreng 2L", price: 38000, icon: "🛢️" },
    { id: 3, name: "Gula Pasir 1kg", price: 17000, icon: "🍬" },
    { id: 4, name: "Telur Ayam 1kg", price: 29000, icon: "🥚" },
    { id: 5, name: "Tepung Terigu 1kg", price: 13000, icon: "🌾" },
    { id: 6, name: "Kopi Sachet 10pcs", price: 11000, icon: "☕" },
    { id: 7, name: "Mie Instan 1 dus", price: 110000, icon: "🍜" },
    { id: 8, name: "Sabun Mandi 2pcs", price: 9000, icon: "🧼" },
    { id: 9, name: "Deterjen 800g", price: 16000, icon: "🧽" },
    { id: 10, name: "Garam 1kg", price: 5000, icon: "🧂" },
    { id: 11, name: "Kecap Manis 275ml", price: 13000, icon: "🍶" },
    { id: 12, name: "Susu Kental Manis", price: 14000, icon: "🥛" },
    { id: 13, name: "Roti Tawar", price: 17000, icon: "🍞" },
    { id: 14, name: "Air Mineral 600ml", price: 4000, icon: "💧" },
    { id: 15, name: "Sambal Botol", price: 12000, icon: "🌶️" },
    { id: 16, name: "Sikat Gigi 2pcs", price: 8000, icon: "🪥" }
];

// ==========================================
// UTILITIES
// ==========================================

function parseRupiah(str) {
    if (!str) return 0;
    let cleaned = String(str).replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(cleaned) || 0;
}

function formatRupiah(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatInputOnKey(el) {
    let cursorPosition = el.selectionStart;
    let originalLength = el.value.length;
    let value = el.value.replace(/[^0-9]/g, '');
    el.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    let newLength = el.value.length;
    if (value !== "") {
        el.selectionStart = el.selectionEnd = cursorPosition + (newLength - originalLength);
    }
    updateLiveTotal();
}

function updateLiveTotal() {
    let total = 0;
    document.querySelectorAll('.money-input').forEach(inp => {
        total += parseRupiah(inp.value);
    });
    const el = document.getElementById('live-total');
    if(el) el.innerText = "Rp " + formatRupiah(total);
}

function securePost(payload) {
    if (authToken) payload.token = authToken;
    return fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(r => r.json());
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if(t) {
        t.innerText = msg; 
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }
}

// ==========================================
// FAKE VIEW: SISTEM KASIR POS
// ==========================================

function initFakeView() {
    document.getElementById('fake-view').style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'none';
    document.title = "POS Kasir - Sembako Makmur";
    updatePanicButton(false);

    renderPosCatalog();
    renderPosCart();
    updatePosClock();
    setInterval(updatePosClock, 60000); // Update jam tiap menit
}

function updatePosClock() {
    const el = document.getElementById('pos-clock');
    if(el) {
        const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        el.innerText = dateStr + ' - ' + timeStr;
    }
}

function renderPosCatalog() {
    const container = document.getElementById('pos-grid');
    const searchVal = (document.getElementById('pos-search-input')?.value || '').toLowerCase();
    if (!container) return;
    
    const filtered = POS_PRODUCTS.filter(p => p.name.toLowerCase().includes(searchVal));
    
    container.innerHTML = '';
    if(filtered.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#94a3b8; padding:2rem;">Produk tidak ditemukan</div>';
        return;
    }

    filtered.forEach(prod => {
        const div = document.createElement('div');
        div.className = 'pos-product';
        div.onclick = () => addToPosCart(prod.id);
        div.innerHTML = `
            <div class="pos-product-icon">${prod.icon}</div>
            <div class="pos-product-name">${prod.name}</div>
            <div class="pos-product-price">Rp ${prod.price.toLocaleString('id-ID')}</div>
        `;
        container.appendChild(div);
    });
}

function addToPosCart(productId) {
    const product = POS_PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const existing = posCart.find(item => item.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        posCart.push({ ...product, qty: 1 });
    }
    renderPosCart();
}

function updatePosQty(productId, delta) {
    const item = posCart.find(i => i.id === productId);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        posCart = posCart.filter(i => i.id !== productId);
    }
    renderPosCart();
}

function posClearCart() {
    posCart = [];
    renderPosCart();
}

function renderPosCart() {
    const container = document.getElementById('pos-cart-list');
    if (!container) return;

    if (posCart.length === 0) {
        container.innerHTML = `<div class="pos-empty-cart"><i class="ph ph-shopping-bag-open" style="font-size:3rem; opacity:0.3;"></i><p>Belum ada item</p></div>`;
    } else {
        container.innerHTML = '';
        posCart.forEach(item => {
            const div = document.createElement('div');
            div.className = 'pos-cart-item';
            div.innerHTML = `
                <div class="pos-item-details">
                    <div class="pos-item-name">${item.name}</div>
                    <div class="pos-item-price">Rp ${item.price.toLocaleString('id-ID')}</div>
                </div>
                <div class="pos-item-qty">
                    <button onclick="updatePosQty(${item.id}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button onclick="updatePosQty(${item.id}, 1)">+</button>
                </div>
                <div class="pos-item-total">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</div>
            `;
            container.appendChild(div);
        });
    }
    calculatePosTotal();
}

function calculatePosTotal() {
    const subtotal = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discount = subtotal > 100000 ? Math.round(subtotal * 0.05) : 0; // Diskon fiktif 5% jika > 100rb
    const total = subtotal - discount;

    document.getElementById('pos-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('pos-discount').innerText = `- Rp ${discount.toLocaleString('id-ID')}`;
    document.getElementById('pos-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

function posPay() {
    const total = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    if (total === 0) return;

    const discount = total > 100000 ? Math.round(total * 0.05) : 0;
    const finalTotal = total - discount;

    document.getElementById('receipt-total-display').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    
    const receiptDetails = document.getElementById('receipt-details');
    let strukHtml = '';
    posCart.forEach(item => {
        strukHtml += `${item.name} (${item.qty}x)  Rp ${(item.price*item.qty).toLocaleString('id-ID')}<br>`;
    });
    strukHtml += `<br>-----------------------------<br>Subtotal: Rp ${total.toLocaleString('id-ID')}<br>Diskon: - Rp ${discount.toLocaleString('id-ID')}<br><b>TOTAL: Rp ${finalTotal.toLocaleString('id-ID')}</b>`;
    receiptDetails.innerHTML = strukHtml;

    document.getElementById('pos-receipt-modal').classList.add('active');
}

function closePosReceipt() {
    document.getElementById('pos-receipt-modal').classList.remove('active');
    posClearCart(); // Kosongkan keranjang setelah bayar
}


// ==========================================
// REVEAL / HIDE & KODE RAHASIA
// ==========================================

function updatePanicButton(show) {
    const btn = document.getElementById('panic-btn');
    if (btn) {
        if (show) btn.classList.add('visible');
        else btn.classList.remove('visible');
    }
}

function revealApp() {
    appRevealed = true;
    document.getElementById('fake-view').style.display = 'none';
    document.title = "Catatan KU - Sistem Aman";
    updatePanicButton(true);
    checkSession(); // Akan menampilkan login-view atau app-view
}

function hideToFake() {
    appRevealed = false;
    document.getElementById('fake-view').style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'none';
    document.title = "POS Kasir - Sembako Makmur";
    secretBuffer = "";
    updatePanicButton(false);
    
    // Tutup modal config jika terbuka
    const configModal = document.getElementById('config-modal');
    if (configModal) configModal.style.display = 'none';
}

function setupSecretListeners() {
    // 1. KEYBOARD: Ketik kode rahasia (Desktop)
    document.addEventListener('keydown', function(e) {
        // F9 untuk Bayar di Fake Kasir (supaya terlihat makin asli)
        if (!appRevealed && e.key === 'F9') { e.preventDefault(); posPay(); return; }
        
        // Panic button: Escape → langsung sembunyikan ke fake view
        if (appRevealed && e.key === 'Escape') { e.preventDefault(); hideToFake(); return; }

        if (appRevealed) return;

        const tag = document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        clearTimeout(secretTimer);
        secretBuffer += e.key.toLowerCase();

        // Reset buffer setelah 2 detik tidak mengetik
        secretTimer = setTimeout(() => { secretBuffer = ""; }, 2000);

        if (secretBuffer.includes(SECRET_CODE.toLowerCase())) {
            secretBuffer = "";
            revealApp();
        }
    });

    // 2. TAP: Tap pada header "Kasir Sembako" 7x (Mobile & Desktop)
    const headerEl = document.getElementById('pos-header-tap');
    if (headerEl) {
        headerEl.addEventListener('click', function() {
            if (appRevealed) return;
            tapCount++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => { tapCount = 0; }, 3000);
            if (tapCount >= SECRET_TAP_COUNT) { tapCount = 0; revealApp(); }
        });
    }

    // 3. LONG PRESS: Tahan ikon toko 3 detik (Mobile friendly)
    let longPressTimer = null;
    let longPressTriggered = false;
    const logoEl = document.getElementById('pos-logo-press');
    
    if (logoEl) {
        const startPress = () => { if (appRevealed) return; longPressTriggered = false; longPressTimer = setTimeout(() => { longPressTriggered = true; revealApp(); }, 3000); };
        const endPress = () => { clearTimeout(longPressTimer); };
        
        logoEl.addEventListener('touchstart', startPress, { passive: true });
        logoEl.addEventListener('touchend', endPress);
        logoEl.addEventListener('touchmove', endPress, { passive: true });
        logoEl.addEventListener('mousedown', startPress);
        logoEl.addEventListener('mouseup', endPress);
        logoEl.addEventListener('mouseleave', endPress);
    }

    // 4. SHAKE DETECTION: Goyangkan HP untuk panic
    setupShakeDetection();
}

function setupShakeDetection() {
    let lastX = 0, lastY = 0, lastZ = 0; 
    let lastUpdate = 0; let shakeCount = 0; let shakeTimer = null;
    
    if (!window.DeviceMotionEvent) return;
    
    window.addEventListener('devicemotion', function(e) {
        if (!appRevealed) return; // Hanya aktif di app asli
        
        const acc = e.accelerationIncludingGravity; 
        if (!acc) return;
        
        const curTime = Date.now();
        if ((curTime - lastUpdate) > 100) {
            const diffTime = curTime - lastUpdate; 
            lastUpdate = curTime;
            const x = acc.x || 0; const y = acc.y || 0; const z = acc.z || 0;
            const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;
            
            if (speed > 25) {
                shakeCount++; 
                clearTimeout(shakeTimer);
                shakeTimer = setTimeout(() => { shakeCount = 0; }, 1000);
                if (shakeCount >= 3) { shakeCount = 0; hideToFake(); }
            }
            lastX = x; lastY = y; lastZ = z;
        }
    });
}


// ==========================================
// AUTHENTICATION 
// ==========================================

function doLogin() {
    const pass = document.getElementById('login-pass').value.trim();
    const msg = document.getElementById('login-msg');
    if (!pass) return msg.innerText = "Masukkan password!";
    msg.innerText = "Memproses...";
    
    securePost({ action: 'login', password: pass })
    .then(res => {
        if (res.status === 'success') {
            user = res.user;
            authToken = res.token;
            const sessionData = { token: authToken, user: user, timestamp: Date.now() };
            localStorage.setItem('app_session', JSON.stringify(sessionData));
            initApp();
        } else {
            msg.innerText = res.message;
            document.getElementById('login-view').style.display = 'flex';
        }
    })
    .catch(e => {
        msg.innerText = "Koneksi Error";
        document.getElementById('login-view').style.display = 'flex';
    });
}

function doLogout() {
    localStorage.removeItem('app_session');
    user = null;
    authToken = null;
    location.reload();
}

function checkSession() {
    const sessionStr = localStorage.getItem('app_session');
    const loginMsg = document.getElementById('login-msg');

    if (sessionStr) {
        try {
            const session = JSON.parse(sessionStr);
            const now = Date.now();
            const elapsed = now - session.timestamp;

            if (elapsed > SESSION_DURATION) {
                localStorage.removeItem('app_session');
                document.getElementById('login-view').style.display = 'flex';
                if(loginMsg) loginMsg.innerText = "Sesi login telah habis. Silakan login ulang.";
            } else {
                authToken = session.token;
                user = session.user;
                initApp();
            }
        } catch (e) {
            localStorage.removeItem('app_session');
            document.getElementById('login-view').style.display = 'flex';
        }
    } else {
        document.getElementById('login-view').style.display = 'flex';
    }
}

// --- INISIALISASI APLIKASI ---
document.addEventListener('DOMContentLoaded', () => {
    initFakeView();
    setupSecretListeners();
});

function initApp() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    document.getElementById('u-name').innerText = user.nama_admin;
    document.getElementById('u-role').innerText = `${user.role} | ${user.kelompok || user.desa || ''}`;
    updatePanicButton(true);
    
    if(user.role === 'Daerah') {
        document.getElementById('filter-desa-container').style.display = 'block';
        document.getElementById('filter-desa-rekap-container').style.display = 'block';
        document.getElementById('nav-config').style.display = 'block';
        document.getElementById('nav-targets').style.display = 'block';
    }
    fetchConfig();
}


// ==========================================
// DATA FETCHING
// ==========================================

function fetchConfig() {
    securePost({ action: 'get_config' }) 
    .then(res => {
        if(res.status !== 'success') return alert(res.message);
        
        configData = res.config.map(r => ({
            cat_code: r.cat_code, cat_title: r.cat_title, item_id: r.item_id, item_label: r.item_label,
            tipe: r.tipe, allowed_groups: r.allowed_groups || "ALL",
            is_split: r.is_split || false, split_kel: r.split_kel || 0, split_desa: r.split_desa || 0, split_daerah: r.split_daerah || 0
        }));
        
        targetsData = res.targets || {}; 
        
        buildForm();
        fetchData();
        
        if(user.role === 'Daerah') renderConfigTable();
    });
}

function fetchData() {
    securePost({ action: 'fetch_data' })
    .then(res => {
        if(res.status === 'success') {
            allTransactions = res.data;
            updateDesaFilterOptions();
            renderDataTable();
            renderRecapTable(); 
        }
    });
}


// ==========================================
// UI BUILDERS (Aplikasi Asli)
// ==========================================

function buildForm() {
    const tabsContainer = document.getElementById('dynamic-tabs');
    const itemsContainer = document.getElementById('dynamic-items');
    if(!tabsContainer || !itemsContainer) return;
    
    tabsContainer.innerHTML = ''; 
    itemsContainer.innerHTML = '';

    const categories = {};
    configData.forEach(item => {
        if (!categories[item.cat_code]) {
            categories[item.cat_code] = { title: item.cat_title, items: [] };
        }
        categories[item.cat_code].items.push(item);
    });

    Object.keys(categories).forEach((code, index) => {
        const cat = categories[code];
        const btn = document.createElement('button');
        btn.className = `cat-tab ${index === 0 ? 'active' : ''}`;
        btn.id = `tab-btn-${code}`;
        btn.innerText = `${code}. ${cat.title}`;
        btn.onclick = () => switchCategory(code);
        tabsContainer.appendChild(btn);

        const pane = document.createElement('div');
        pane.id = `pane-${code}`;
        pane.className = `cat-pane ${index === 0 ? 'active' : ''}`;
        
        cat.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'item-row';
            row.innerHTML = `
                <label style="font-size:0.85rem">${item.item_label}</label>
                <div class="currency-wrap">
                    <span>Rp</span>
                    <input type="text" inputmode="numeric" class="form-control money-input" data-id="${item.item_id}" placeholder="0" oninput="formatInputOnKey(this)">
                </div>
                <button class="btn btn-sm" style="background:#e2e8f0;" onclick="quickFill(this, 50000)">+50rb</button>
            `;
            pane.appendChild(row);
            
            if (item.is_split) {
                const inp = row.querySelector('.money-input'); 
                const previewDiv = document.createElement('div');
                previewDiv.className = 'split-preview';
                previewDiv.style.cssText = "font-size:0.7rem; color:#64748b; margin-top:4px; padding:4px; background:#f1f5f9; border-radius:4px;";
                previewDiv.innerHTML = '<i class="ph ph-calculator"></i> <b>Otomatis:</b> <span class="val-kel">0</span> (Ke F) | <span class="val-desa">0</span> (Ke E) | <span class="val-dah">0</span> (Tetap C)';
                
                inp.addEventListener('input', () => {
                    const total = parseRupiah(inp.value);
                    const pKel = (total * (item.split_kel || 0)) / 100;
                    const pDesa = (total * (item.split_desa || 0)) / 100;
                    const pDah = (total * (item.split_daerah || 0)) / 100;
                    
                    previewDiv.querySelector('.val-kel').innerText = formatRupiah(pKel);
                    previewDiv.querySelector('.val-desa').innerText = formatRupiah(pDesa);
                    previewDiv.querySelector('.val-dah').innerText = formatRupiah(pDah);
                });
                row.appendChild(previewDiv); 
            }
        });
        itemsContainer.appendChild(pane);
    });
    
    const periodeInput = document.getElementById('input-periode');
    if(periodeInput) periodeInput.value = new Date().toISOString().slice(0, 7);
    
    updateLiveTotal();
}

function renderDataTable() {
    const tbody = document.getElementById('table-body-data');
    const filterPeriode = document.getElementById('filter-data-periode').value;
    const filterDesa = document.getElementById('filter-data-desa').value;
    
    if(!tbody) return;
    tbody.innerHTML = '';
    let grandTotal = 0;

    const filtered = allTransactions.filter(t => {
        let match = true;
        if (user.role === 'Kelompok') match = t.kelompok === user.kelompok;
        else if (user.role === 'Desa') match = t.desa === user.desa;
        if (match && filterPeriode) match = (t.periode && String(t.periode).trim() === filterPeriode);
        if (match && user.role === 'Daerah' && filterDesa) match = (t.desa && String(t.desa).trim() === filterDesa);
        return match;
    });

    filtered.reverse().forEach(t => {
        let valObj = {};
        try { valObj = JSON.parse(t.values_json); } catch(e){}
        const total = Object.values(valObj).reduce((a,b)=>a+(parseFloat(b)||0),0);
        grandTotal += total;

        const displayDate = t.timestamp ? String(t.timestamp).split(' ')[0] : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${displayDate}</td>
            <td>${t.periode}</td>
            <td>${t.nama_warga}</td>
            <td>${t.desa || '-'}</td>
            <td style="font-weight:bold; color:var(--accent)">Rp ${total.toLocaleString('id-ID')}</td>
            <td>
                <button class="btn btn-sm" onclick="editData('${t.id}')"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteData('${t.id}')"><i class="ph ph-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    const grandTotalEl = document.getElementById('grand-total-data');
    if(grandTotalEl) grandTotalEl.innerText = `Rp ${grandTotal.toLocaleString('id-ID')}`;
}

function renderRecapTable() {
    const tbody = document.getElementById('table-body-rekap');
    const filterPeriodeRaw = document.getElementById('filter-rekap-periode').value;
    const filterDesa = document.getElementById('filter-rekap-desa').value; 
    
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if (!filterPeriodeRaw) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-light);">Silakan pilih periode terlebih dahulu.</td></tr>';
        const footer = document.getElementById('grand-total-rekap');
        if(footer) footer.innerText = "Rp 0";
        return;
    }

    const [selectedYear, selectedMonthStr] = filterPeriodeRaw.split('-');
    const selectedMonth = parseInt(selectedMonthStr);
    
    let targetIdentity;
    if (user.role === 'Kelompok') targetIdentity = user.kelompok;
    else if (user.role === 'Desa') targetIdentity = user.desa;
    else if (user.role === 'Daerah') targetIdentity = filterDesa || "Daerah"; 
    else targetIdentity = "";

    const currentTargets = targetsData[targetIdentity] || {}; 
    const realisasiBlnIni = {}; 
    const akumulasiYTD = {};           
    let grandTotalBlnIni = 0;

    allTransactions.forEach(t => {
        const tPeriode = String(t.periode).trim(); 
        const [tYear, tMonthStr] = tPeriode.split('-');
        const tMonth = parseInt(tMonthStr);

        let matchUser = true;
        if (user.role === 'Kelompok') matchUser = t.kelompok === user.kelompok;
        else if (user.role === 'Desa') matchUser = t.desa === user.desa;
        if (matchUser && user.role === 'Daerah' && filterDesa) matchUser = t.desa === filterDesa;

        if (matchUser && tYear === selectedYear) {
            let valObj = {};
            try { valObj = JSON.parse(t.values_json); } catch(e){}
            for (let [key, val] of Object.entries(valObj)) {
                const nominal = parseFloat(val) || 0;
                akumulasiYTD[key] = (akumulasiYTD[key] || 0) + nominal;
                if (tMonth === selectedMonth) {
                    realisasiBlnIni[key] = (realisasiBlnIni[key] || 0) + nominal;
                    grandTotalBlnIni += nominal;
                }
            }
        }
    });

    configData.forEach(conf => {
        const id = conf.item_id;
        const bln = realisasiBlnIni[id] || 0;
        const ytd = akumulasiYTD[id] || 0;
        const tipe = (conf.tipe || "Tahunan").trim();
        const targetVal = parseFloat(currentTargets[id]) || 0;
        
        let persen = 0;
        let labelTarget = tipe === "Bulanan" ? "Target/Bln" : "Target/Thn";

        if (tipe === "Bulanan") {
            persen = targetVal > 0 ? Math.round((bln / targetVal) * 100) : 0;
        } else {
            persen = targetVal > 0 ? Math.round((ytd / targetVal) * 100) : 0;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:600; font-size:0.85rem;">${conf.item_label}</div>
                <div style="font-size:0.6rem; color:#fff; background:${tipe === 'Bulanan' ? '#8b5cf6' : '#3b82f6'}; padding:1px 6px; border-radius:10px; display:inline-block; margin-top:2px;">${tipe}</div>
            </td>
            <td style="text-align:right; font-weight:700; color:var(--accent);">Rp ${bln.toLocaleString('id-ID')}</td>
            <td style="text-align:right; font-size:0.8rem; color:var(--text-light);">${tipe === 'Bulanan' ? '-' : 'Rp ' + ytd.toLocaleString('id-ID')}</td>
            <td style="text-align:right;">
                <div style="font-size:0.8rem; font-weight:600;">Rp ${targetVal.toLocaleString('id-ID')}</div>
                <div style="font-size:0.55rem; color:var(--text-light); text-transform:uppercase;">${labelTarget}</div>
            </td>
            <td>
                <div style="font-size:0.7rem; margin-bottom:3px; display:flex; justify-content:space-between;">
                    <span style="font-weight:bold">${persen}%</span>
                    <span style="font-size:0.6rem; opacity:0.7">${tipe === 'Tahunan' ? 'YTD' : 'REAL'}</span>
                </div>
                <div class="progress-container" style="background:#e2e8f0; height:6px; border-radius:10px; overflow:hidden;">
                    <div class="progress-bar" style="width: ${persen > 100 ? 100 : persen}%; height:100%; background: ${persen >= 100 ? '#22c55e' : (tipe === 'Bulanan' ? '#a78bfa' : '#3b82f6')}; transition:0.3s;"></div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const footer = document.getElementById('grand-total-rekap');
    if(footer) footer.innerText = `Rp ${grandTotalBlnIni.toLocaleString('id-ID')}`;
}

function renderTargetsTable() {
    const thead = document.getElementById('thead-targets');
    const tbody = document.getElementById('tbody-targets');
    if(!thead || !tbody) return;
    
    thead.innerHTML = ''; 
    tbody.innerHTML = '';

    if (!targetsData || Object.keys(targetsData).length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:2rem;">Belum ada data Target.</td></tr>';
        return;
    }

    const itemsList = configData.map(c => c.item_id);
    let headerHTML = '<tr><th style="position:sticky; left:0; background:#f8fafc; z-index:10;">Identitas</th>';
    itemsList.forEach(itemId => {
        const itemConf = configData.find(c => c.item_id === itemId);
        const label = itemConf ? itemConf.item_label : itemId;
        headerHTML += `<th style="min-width:120px; text-align:center; font-size:0.75rem;">${label}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;

    Object.keys(targetsData).forEach(identity => {
        const tr = document.createElement('tr');
        let rowHTML = `<td style="font-weight:bold; position:sticky; left:0; background:white; z-index:5; border-right:2px solid #ddd;">${identity}</td>`;
        
        const dataRow = targetsData[identity]; 

        itemsList.forEach(itemId => {
            const val = dataRow[itemId] || 0; 
            rowHTML += `
                <td style="text-align:center;">
                    <input type="number" class="target-input" value="${val}" style="width:100px; text-align:center; padding:5px; border:1px solid #ddd; border-radius:4px;" onblur="updateTarget(this, '${identity}', '${itemId}')" onchange="this.style.background='#dcfce7'; setTimeout(()=>this.style.background='white', 500)">
                </td>
            `;
        });

        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });
}

function updateTarget(inputEl, identity, itemId) {
    const newValue = inputEl.value;
    inputEl.style.background = '#fef9c3'; 

    securePost({ action: 'update_target', identity: identity, item_id: itemId, value: newValue })
    .then(res => {
        if(res.status === 'success') {
            inputEl.style.background = '#dcfce7'; 
            setTimeout(() => inputEl.style.background = 'white', 1000);
            if(targetsData[identity]) { targetsData[identity][itemId] = parseFloat(newValue) || 0; }
        } else {
            alert("Gagal menyimpan: " + res.message);
            inputEl.style.background = '#fee2e2'; 
        }
    })
    .catch(e => {
        console.error(e);
        inputEl.style.background = '#fee2e2';
    });
}

// --- CONFIG CRUD ---
function renderConfigTable() {
    const tbody = document.getElementById('table-body-config');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    configData.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${item.item_id}</b></td>
            <td>${item.cat_title}</td>
            <td>${item.item_label}</td>
            <td><span style="font-size:0.75rem; background:${item.tipe==='Bulanan'?'#a78bfa':'#3b82f6'}; color:white; padding:2px 6px; border-radius:4px;">${item.tipe}</span></td>
            <td>${item.allowed_groups || "ALL"}</td>
            <td>
                <button class="btn btn-sm" onclick="editConfig('${item.item_id}')"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteConfig('${item.item_id}')"><i class="ph ph-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openConfigModal(isEdit = false) {
    document.getElementById('config-modal').style.display = 'flex';
    document.getElementById('modal-title-config').innerText = isEdit ? "Edit Item Config" : "Tambah Item Config";
    
    if (!isEdit) {
        document.getElementById('cfg-old-id').value = '';
        document.getElementById('cfg-item-id').value = '';
        document.getElementById('cfg-cat-code').value = '';
        document.getElementById('cfg-cat-title').value = '';
        document.getElementById('cfg-item-label').value = '';
        document.getElementById('cfg-tipe').value = 'Bulanan';
        document.getElementById('cfg-groups').value = '';
        document.getElementById('cfg-is-split').checked = false;
        document.getElementById('split-inputs').style.display = 'none';
        document.getElementById('cfg-split-kel').value = 0;
        document.getElementById('cfg-split-desa').value = 0;
        document.getElementById('cfg-split-dah').value = 0;
    }
}

function closeConfigModal() {
    document.getElementById('config-modal').style.display = 'none';
}

function editConfig(id) {
    const item = configData.find(x => x.item_id === id);
    if (!item) return alert("Data tidak ditemukan!");

    document.getElementById('cfg-old-id').value = item.item_id;
    document.getElementById('cfg-item-id').value = item.item_id;
    document.getElementById('cfg-cat-code').value = item.cat_code || '';
    document.getElementById('cfg-cat-title').value = item.cat_title || '';
    document.getElementById('cfg-item-label').value = item.item_label || '';
    document.getElementById('cfg-tipe').value = item.tipe || 'Bulanan';
    document.getElementById('cfg-groups').value = item.allowed_groups || '';

    const isSplit = item.is_split || false;
    document.getElementById('cfg-is-split').checked = isSplit;
    document.getElementById('split-inputs').style.display = isSplit ? 'grid' : 'none';
    document.getElementById('cfg-split-kel').value = item.split_kel || 0;
    document.getElementById('cfg-split-desa').value = item.split_desa || 0;
    document.getElementById('cfg-split-dah').value = item.split_daerah || 0;

    openConfigModal(true);
}

function saveConfig() {
    const oldId = document.getElementById('cfg-old-id').value.trim();
    const itemId = document.getElementById('cfg-item-id').value.trim();
    const catCode = document.getElementById('cfg-cat-code').value.trim();
    const catTitle = document.getElementById('cfg-cat-title').value.trim();
    const itemLabel = document.getElementById('cfg-item-label').value.trim();
    const tipe = document.getElementById('cfg-tipe').value;
    const groups = document.getElementById('cfg-groups').value.trim();

    const isSplit = document.getElementById('cfg-is-split').checked;
    const splitKel = parseFloat(document.getElementById('cfg-split-kel').value) || 0;
    const splitDesa = parseFloat(document.getElementById('cfg-split-desa').value) || 0;
    const splitDah = parseFloat(document.getElementById('cfg-split-dah').value) || 0;

    if (!itemId || !catCode || !catTitle || !itemLabel) return showToast("Lengkapi data wajib!");
    if (isSplit && (splitKel + splitDesa + splitDah !== 100)) return showToast("Total persentase split harus 100%!");

    const action = oldId ? 'update_config' : 'create_config';
    const payload = { action, old_id: oldId, item_id: itemId, cat_code: catCode, cat_title: catTitle, item_label: itemLabel, tipe, allowed_groups: groups || "ALL", is_split: isSplit, split_kel: splitKel, split_desa: splitDesa, split_daerah: splitDah };

    const btn = document.querySelector('#config-modal .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Menyimpan..."; btn.disabled = true;

    securePost(payload)
    .then(res => {
        if (res.status === 'success') { showToast("Config berhasil disimpan!"); closeConfigModal(); fetchConfig(); renderConfigTable(); } 
        else { showToast("Error: " + res.message); }
    })
    .catch(e => { console.error(e); showToast("Terjadi kesalahan koneksi."); })
    .finally(() => { btn.innerText = originalText; btn.disabled = false; });
}

function deleteConfig(id) {
    if(!confirm("Hapus item ini?")) return;
    securePost({ action: 'delete_config', item_id: id }).then(res => { if(res.status === 'success') { fetchConfig(); renderConfigTable(); } });
}

document.getElementById('cfg-is-split').addEventListener('change', function() {
    document.getElementById('split-inputs').style.display = this.checked ? 'grid' : 'none';
});


// ==========================================
// ACTIONS
// ==========================================

function submitData() {
    const btn = document.getElementById('btn-submit');
    const periode = document.getElementById('input-periode').value;
    const nama = document.getElementById('input-nama').value;
    if(!periode || !nama) return showToast("Periode & Nama harus diisi!");

    const values = {};
    let hasVal = false;
    document.querySelectorAll('.money-input').forEach(inp => {
        const v = parseRupiah(inp.value); 
        if(v > 0) { values[inp.dataset.id] = v; hasVal = true; }
    });
    if(!hasVal) return showToast("Isi minimal satu nominal!");

    let processedValues = JSON.parse(JSON.stringify(values));

    if (user.role !== 'Daerah') {
        Object.keys(values).forEach(key => {
            const conf = configData.find(c => c.item_id === key);
            if (conf && conf.is_split) {
                const totalAmount = values[key];
                const pKel = (totalAmount * (conf.split_kel || 0)) / 100;
                const pDesa = (totalAmount * (conf.split_desa || 0)) / 100;
                const pDah = (totalAmount * (conf.split_daerah || 0)) / 100;

                const targetSpecificE = configData.find(c => c.item_id === key + "_e");
                const targetSpecificF = configData.find(c => c.item_id === key + "_f");

                processedValues[key] = pDah;

                let destF = targetSpecificF || configData.find(c => c.cat_code === 'F');
                if (destF && pKel > 0) { processedValues[destF.item_id] = (processedValues[destF.item_id] || 0) + pKel; }

                let destE = targetSpecificE || configData.find(c => c.cat_code === 'E');
                if (destE && pDesa > 0) { processedValues[destE.item_id] = (processedValues[destE.item_id] || 0) + pDesa; }
            }
        });
    }

    btn.disabled = true; btn.innerText = "Menyimpan...";
    const payload = { action: isEditing ? 'update' : 'create', id: editId, periode, nama_warga: nama, values: processedValues };

    securePost(payload)
    .then(res => {
        if(res.status === 'success') { showToast("Berhasil!"); resetForm(); fetchData(); if(isEditing) switchTab('data'); } 
        else { showToast("Error: " + res.message); }
        btn.disabled = false; btn.innerHTML = `<i class="ph ph-floppy-disk"></i> Simpan Data`;
    })
    .catch(() => { showToast("Error Koneksi"); btn.disabled = false; });
}

function deleteData(id) {
    if(!confirm("Yakin ingin menghapus data ini?")) return;
    securePost({ action: 'delete', id: id })
    .then(res => {
        if(res.status === 'success') { showToast("Data dihapus"); fetchData(); } 
        else { showToast("Gagal: " + res.message); }
    });
}


// ==========================================
// HELPERS
// ==========================================

function switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`nav-${tabName}`).classList.add('active');
    document.getElementById(`view-${tabName}`).classList.add('active');
    
    if(tabName === 'config' && user.role === 'Daerah') renderConfigTable();
    if(tabName === 'targets' && user.role === 'Daerah') renderTargetsTable();
    if(tabName === 'rekap') renderRecapTable(); 
}

function switchCategory(code) {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cat-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-btn-${code}`).classList.add('active');
    document.getElementById(`pane-${code}`).classList.add('active');
}

function quickFill(btn, amount) {
    const inp = btn.parentElement.querySelector('input');
    let newVal = parseRupiah(inp.value) + amount;
    inp.value = formatRupiah(newVal);
    updateLiveTotal();
}

function updateDesaFilterOptions() {
    if(user.role !== 'Daerah') return;
    const desas = [...new Set(allTransactions.map(t => t.desa))].filter(Boolean);
    const selects = [document.getElementById('filter-data-desa'), document.getElementById('filter-rekap-desa')];
    selects.forEach(sel => {
        sel.innerHTML = '<option value="">Semua Desa</option>';
        desas.forEach(d => sel.innerHTML += `<option value="${d}">${d}</option>`);
    });
}

function resetForm() {
    isEditing = false; editId = null;
    const title = document.getElementById('form-title');
    if(title) title.innerText = "Input Baru";
    const cancelBtn = document.getElementById('cancel-edit');
    if(cancelBtn) cancelBtn.style.display = 'none';
    
    const namaInput = document.getElementById('input-nama');
    if(namaInput) namaInput.value = '';
    
    document.querySelectorAll('.money-input').forEach(i => i.value = '');
    updateLiveTotal();
}

function editData(id) {
    const t = allTransactions.find(x => x.id == id);
    if(!t) return;
    isEditing = true; editId = id;
    
    const title = document.getElementById('form-title');
    if(title) title.innerText = "Edit Data";
    
    const cancelBtn = document.getElementById('cancel-edit');
    if(cancelBtn) cancelBtn.style.display = 'block';

    const periodeInput = document.getElementById('input-periode');
    if(periodeInput) periodeInput.value = t.periode;

    const namaInput = document.getElementById('input-nama');
    if(namaInput) namaInput.value = t.nama_warga;

    document.querySelectorAll('.money-input').forEach(i => i.value = '');
    try {
        const vals = JSON.parse(t.values_json);
        for(let key in vals) {
            const input = document.querySelector(`.money-input[data-id="${key}"]`);
            if(input) input.value = formatRupiah(vals[key]);
        }
    } catch(e){}
    updateLiveTotal();
    switchTab('input');
}


// ==========================================
// EXCEL EXPORT
// ==========================================

async function downloadExcel() {
    const filterPeriodeRaw = document.getElementById('filter-rekap-periode').value;
    const filterDesa = document.getElementById('filter-rekap-desa').value;
    if (!filterPeriodeRaw) return showToast("Pilih periode dulu!");

    const [year, month] = filterPeriodeRaw.split('-');
    const dateObj = new Date(year, month - 1);
    const namaPeriode = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    let namaKelompok = (user.role === 'Kelompok' ? user.kelompok : ".........").toUpperCase();
    let namaDesaDisplay = (user.desa || ".........").toUpperCase();
    
    if (user.role === 'Daerah') { namaDesaDisplay = filterDesa ? filterDesa.toUpperCase() : ""; }

    let allowedCategories = [];
    if (user.role === 'Daerah') allowedCategories = ['A', 'B', 'C', 'D'];
    else if (user.role === 'Desa') allowedCategories = ['A', 'B', 'C', 'D', 'E'];
    else if (user.role === 'Kelompok') allowedCategories = ['A', 'B', 'C', 'D', 'E', 'F'];

    let reportTitle = user.role === 'Kelompok' ? "REKAPITULASI HIBAH BULANAN KELOMPOK KE DESA" :
                      (user.role === 'Desa' ? "REKAPITULASI HIBAH BULANAN DESA KE DAERAH" : "REKAPITULASI HIBAH BULANAN DAERAH");
    
    let reportSubtitle = "";
    if(user.role === 'Kelompok') reportSubtitle = `KELOMPOK ${namaKelompok} DESA ${namaDesaDisplay}`;
    else if(user.role === 'Desa' || (user.role === 'Daerah' && filterDesa)) reportSubtitle = `DESA ${namaDesaDisplay}`;

    let targetKey = user.role === 'Kelompok' ? user.kelompok : (user.role === 'Desa' ? user.desa : (filterDesa || "Daerah"));
    const currentTargets = targetsData[targetKey] || {};
    
    const categorizedData = {};
    configData.forEach(conf => {
        if (!allowedCategories.includes(conf.cat_code.toUpperCase())) return; 
        if (!categorizedData[conf.cat_title]) categorizedData[conf.cat_title] = [];
        
        const realisasiBln = allTransactions.filter(t => {
            const tPeriode = String(t.periode).trim();
            let matchRole = true;
            if (user.role === 'Kelompok') matchRole = t.kelompok === user.kelompok;
            else if (user.role === 'Desa') matchRole = t.desa === user.desa;
            else if (user.role === 'Daerah' && filterDesa) matchRole = t.desa === filterDesa;
            return tPeriode === filterPeriodeRaw && matchRole;
        }).reduce((acc, t) => {
            let vals = {}; try { vals = JSON.parse(t.values_json); } catch(e){}
            return acc + (parseFloat(vals[conf.item_id]) || 0);
        }, 0);

        categorizedData[conf.cat_title].push({ cat_code: conf.cat_code, label: conf.item_label, target: parseFloat(currentTargets[conf.item_id]) || 0, realisasi: realisasiBln });
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan', { pageSetup: { paperSize: 9, orientation: 'portrait' } });

    worksheet.mergeCells('A1:E1'); worksheet.mergeCells('A2:E2'); worksheet.mergeCells('A3:E3');
    
    worksheet.getCell('A1').value = reportTitle; worksheet.getCell('A1').font = { bold: true, size: 14 }; worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.getCell('A2').value = reportSubtitle; worksheet.getCell('A2').font = { bold: true, size: 11 }; worksheet.getCell('A2').alignment = { horizontal: 'center' };
    worksheet.getCell('A3').value = "PERIODE " + namaPeriode; worksheet.getCell('A3').font = { bold: true, size: 11 }; worksheet.getCell('A3').alignment = { horizontal: 'center' };

    const headerRow = worksheet.addRow(['NO', 'URAIAN', 'TARGET', 'REALISASI', 'KETERANGAN']);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }; cell.alignment = { horizontal: 'center' };
    });

    let counter = 1; let grandTotalRealisasi = 0; let totalHakKelompok = 0; let totalHakDesa = 0;     

    for (const [catTitle, items] of Object.entries(categorizedData)) {
        const cat = configData.find(c => c.cat_title === catTitle); const catCode = cat ? cat.cat_code : '';
        const catRow = worksheet.addRow(['', catTitle.toUpperCase(), '', '', '']); catRow.getCell(2).font = { bold: true };
        
        items.forEach(item => {
            grandTotalRealisasi += item.realisasi;
            if (catCode === 'F') totalHakKelompok += item.realisasi;
            if (catCode === 'E') totalHakDesa += item.realisasi;
            const row = worksheet.addRow([counter++, item.label, item.target, item.realisasi, ""]);
            row.getCell(3).numFmt = '#,##0'; row.getCell(4).numFmt = '#,##0';
        });
    }
    
    const footerRow = worksheet.addRow(['', 'TOTAL KESELURUHAN', '', grandTotalRealisasi, '']);
    footerRow.eachCell((cell) => { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; });
    footerRow.getCell(4).numFmt = '#,##0';

    let totalYangDisetor = 0; let labelSetoran = "";
    if (user.role === 'Kelompok') { totalYangDisetor = grandTotalRealisasi - totalHakKelompok; labelSetoran = "TOTAL YANG DISETOR KE DESA"; } 
    else if (user.role === 'Desa') { totalYangDisetor = grandTotalRealisasi - totalHakDesa; labelSetoran = "TOTAL YANG DISETOR KE DAERAH"; }

    if ((user.role === 'Kelompok' || user.role === 'Desa') && totalYangDisetor > 0) {
        const setoranRow = worksheet.addRow(['', labelSetoran, '', totalYangDisetor, '']);
        setoranRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });
        setoranRow.getCell(4).numFmt = '#,##0'; setoranRow.getCell(4).alignment = { horizontal: 'center' };
    }

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 5) {
            row.eachCell((cell) => {
                if (!cell.fill || cell.fill.fgColor.argb !== 'FF0F766E') { cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }; }
                if (cell.address.startsWith('A') || cell.address.startsWith('C') || cell.address.startsWith('D')) { cell.alignment = { horizontal: 'center' }; }
            });
        }
    });

    worksheet.getColumn(1).width = 5; worksheet.getColumn(2).width = 45; worksheet.getColumn(3).width = 18; worksheet.getColumn(4).width = 18; worksheet.getColumn(5).width = 20;

    let fileName = (user.role === 'Kelompok' ? `Laporan_Kelompok_${namaKelompok}` : (user.role === 'Desa' ? `Laporan_Desa_${namaDesaDisplay}` : `Laporan_Daerah_Keseluruhan`)) + `_${filterPeriodeRaw}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = fileName; anchor.click();
    window.URL.revokeObjectURL(url);
    showToast("File Excel berhasil didownload!");
}
