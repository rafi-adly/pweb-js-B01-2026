// Halaman Katalog Produk
(function () {
  'use strict';

  const PRODUCTS_API = 'https://dummyjson.com/products';
  const PAGE_SIZE = 12;

  const firstName = localStorage.getItem('firstName');
  if (!firstName) {
    window.location.href = 'login.html';
    return;
  }

  const state = {
    allProducts: [],
    filtered: [],
    visibleCount: 0,
    searchTerm: '',
    category: 'ALL',
    sort: 'default',
    cart: [],
  };

  let els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els = {
      navUserSlot: document.getElementById('nav-user-slot'),
      logoutBtn: document.getElementById('btn-logout'),
      searchInput: document.getElementById('search-input'),
      categorySelect: document.getElementById('category-select'),
      sortSelect: document.getElementById('sort-select'),
      grid: document.getElementById('products-grid'),
      showMoreBtn: document.getElementById('btn-show-more'),
      counter: document.getElementById('result-counter'),
      emptyState: document.getElementById('empty-state'),
      retryBtn: document.getElementById('retry-btn'),
      cartBtn: document.getElementById('btn-cart'),
      cartBadge: document.getElementById('cart-badge'),
      cartPanel: document.getElementById('cart-panel'),
      cartOverlay: document.getElementById('cart-overlay'),
      cartClose: document.getElementById('cart-close'),
      cartItems: document.getElementById('cart-items'),
      cartTotal: document.getElementById('cart-total'),
      featuredTrack: document.querySelector('.autoscroll-track'),
    };

    // Navbar: ucapan selamat datang
    if (els.navUserSlot) els.navUserSlot.textContent = `Hai, ${firstName}!`;

    els.logoutBtn?.addEventListener('click', () => {
      localStorage.removeItem('firstName');
      window.location.href = 'login.html';
    });

    state.cart = loadCart();
    updateCartBadge();

    buildModal();
    bindEvents();
    loadFeaturedCarousel();
    loadProducts();
  }

  function bindEvents() {
    if (els.searchInput) {
      els.searchInput.addEventListener('input', debounce((e) => {
        state.searchTerm = e.target.value.trim();
        applyFilters();
      }, 300));
    }

    els.categorySelect?.addEventListener('change', (e) => {
      state.category = e.target.value;
      applyFilters();
    });

    els.sortSelect?.addEventListener('change', (e) => {
      state.sort = e.target.value;
      applyFilters();
    });

    els.showMoreBtn?.addEventListener('click', () => render(false));
    els.retryBtn?.addEventListener('click', loadProducts);

    // tombol "Tambah ke Keranjang" dan detail kartu produk
    els.grid?.addEventListener('click', (event) => {
      const addBtn = event.target.closest('.btn-add-cart');
      if (addBtn) {
        event.stopPropagation();
        addToCart(Number(addBtn.dataset.id));
        return;
      }
      const card = event.target.closest('.product-card');
      if (card) {
        showProductDetail(card.dataset.id);
      }
    });

    els.featuredTrack?.addEventListener('click', (event) => {
      const card = event.target.closest('.featured-product-card');
      if (!card) return;
      event.preventDefault();
      showProductDetail(card.dataset.id);
    });

    // Panel keranjang
    els.cartBtn?.addEventListener('click', () => toggleCartPanel(true));
    els.cartClose?.addEventListener('click', () => toggleCartPanel(false));
    els.cartOverlay?.addEventListener('click', () => toggleCartPanel(false));
    els.cartItems?.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('.cart-item-remove');
      const incBtn = event.target.closest('.qty-inc');
      const decBtn = event.target.closest('.qty-dec');

      if (removeBtn) {
        removeFromCart(Number(removeBtn.dataset.id));
      } else if (incBtn) {
        changeQty(Number(incBtn.dataset.id), 1);
      } else if (decBtn) {
        changeQty(Number(decBtn.dataset.id), -1);
      }
    });
  }

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  function starHTML(rating) {
    const max = 5;
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    const empty = max - full - half;
    let html = '';
    for (let i = 0; i < full; i++) html += '<span class="star full">★</span>';
    if (half) html += '<span class="star half">★</span>';
    for (let i = 0; i < empty; i++) html += '<span class="star empty">★</span>';
    return `<div class="stars" title="${rating.toFixed(1)} / 5">${html}<span class="rating-number">${rating.toFixed(1)}</span></div>`;
  }

  function formatPrice(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function normalize(str) {
    return (str || '').toString().toLowerCase();
  }

  function matchesQuery(product, q) {
    if (!q) return true;
    const n = normalize(q);
    const haystacks = [product.title, product.category, product.brand, product.description]
      .map(normalize)
      .join(' | ');
    return haystacks.includes(n);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  // Kartu produk
  function buildCard(p) {
    const category = p.category || '-';
    const discount = p.discountPercentage || 0;
    const img = p.thumbnail || (p.images && p.images[0]) || 'https://placehold.co/600x400?text=Product';
    const outOfStock = (p.stock || 0) <= 0;

    return `
      <article class="product-card" data-id="${p.id}">
        <div class="thumb-wrap">
          <img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy">
          ${discount > 0 ? `<div class="badge discount">-${Math.round(discount)}%</div>` : ''}
        </div>
        <div class="card-body">
          <div class="category-label">${escapeHtml(category)}</div>
          <h3 class="title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</h3>
          <div class="price-row">
            <span class="price">${formatPrice(p.price)}</span>
            ${starHTML(p.rating || 0)}
          </div>
          <div class="actions">
            <button class="btn btn-add-cart" data-id="${p.id}" type="button" ${outOfStock ? 'disabled' : ''}>
              ${outOfStock ? 'Stok Habis' : 'Tambah ke Keranjang'}
            </button>
          </div>
        </div>
      </article>`;
  }

  function render(reset = false) {
    if (!els.grid) return;
    if (reset) {
      state.visibleCount = 0;
      els.grid.innerHTML = '';
    }

    // Load More / Pagination
    const next = state.filtered.slice(state.visibleCount, state.visibleCount + PAGE_SIZE);
    els.grid.insertAdjacentHTML('beforeend', next.map(buildCard).join(''));
    state.visibleCount += next.length;

    if (els.counter) {
      els.counter.textContent = `${state.filtered.length} produk ditemukan`;
    }
    if (els.showMoreBtn) {
      els.showMoreBtn.style.display = state.visibleCount < state.filtered.length ? 'inline-flex' : 'none';
    }
    if (els.emptyState) {
      els.emptyState.hidden = state.filtered.length !== 0;
    }
    els.grid.hidden = state.filtered.length === 0;
  }

  // Filter & Sorting
  function applyFilters() {
    let result = state.allProducts.filter((p) => {
      const okCategory = state.category === 'ALL' || p.category === state.category;
      const okQuery = matchesQuery(p, state.searchTerm);
      return okCategory && okQuery;
    });

    if (state.sort === 'price-asc') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (state.sort === 'price-desc') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (state.sort === 'rating-desc') {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    state.filtered = result;
    render(true);
  }

  function hydrateCategoryDropdown(list) {
    if (!els.categorySelect) return;
    const set = new Set(list.map((p) => p.category).filter(Boolean));
    const options = ['<option value="ALL">Semua kategori</option>']
      .concat(Array.from(set).sort().map((c) => `<option value="${c}">${c}</option>`))
      .join('');
    els.categorySelect.innerHTML = options;
  }

  // Fetch produk (Global Error Handling)
  async function loadProducts() {
    showLoading(true);
    hideErrorBanner();

    try {
      const res = await fetch(`${PRODUCTS_API}?limit=0`);
      if (!res.ok) throw new Error('Gagal memuat produk dari server.');
      const data = await res.json();

      state.allProducts = data.products || [];
      hydrateCategoryDropdown(state.allProducts);
      state.filtered = state.allProducts.slice();
      render(true);
    } catch (err) {
      console.error(err);
      showErrorBanner(err.message || 'Terjadi kesalahan saat memuat produk.');
      if (els.grid) els.grid.hidden = true;
    } finally {
      showLoading(false);
    }
  }

  function showLoading(isLoading) {
    if (els.loading) els.loading.hidden = !isLoading;
    if (isLoading && els.grid) els.grid.hidden = true;
  }

  function showErrorBanner(msg) {
    if (!els.errorBanner) return;
    els.errorBannerText.textContent = msg;
    els.errorBanner.hidden = false;
  }

  function hideErrorBanner() {
    if (els.errorBanner) els.errorBanner.hidden = true;
  }

  // autoscroll featured carousel
  async function loadFeaturedCarousel() {
    if (!els.featuredTrack) return;

    try {
      const response = await fetch(`${PRODUCTS_API}?limit=6&select=title,thumbnail,id`);
      if (!response.ok) throw new Error('Failed to fetch featured products');
      const data = await response.json();

      const productsHtml = data.products
        .map(
          (p) => `
          <a href="#" class="featured-product-card" data-id="${p.id}">
            <img src="${p.thumbnail}" alt="${escapeHtml(p.title)}">
            <h4>${escapeHtml(p.title)}</h4>
          </a>`
        )
        .join('');

      els.featuredTrack.innerHTML = productsHtml + productsHtml + productsHtml;
    } catch (error) {
      console.error(error);
      els.featuredTrack.innerHTML = `<p style="color:#fff;text-align:center;width:100%;">Tidak dapat memuat produk.</p>`;
    }
  }

  // Modal detail produk
  let modalEls = {};

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'product-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-card">
        <button class="modal-close" type="button" aria-label="Tutup">&times;</button>
        <div class="modal-content"><p>Memuat produk...</p></div>
      </div>
    `;
    document.body.appendChild(modal);

    modalEls = {
      modal,
      overlay: modal.querySelector('.modal-overlay'),
      content: modal.querySelector('.modal-content'),
      close: modal.querySelector('.modal-close'),
    };

    modalEls.overlay.addEventListener('click', hideModal);
    modalEls.close.addEventListener('click', hideModal);
  }

  function showModal() {
    modalEls.modal.classList.add('show');
  }
  function hideModal() {
    modalEls.modal.classList.remove('show');
  }

  async function showProductDetail(id) {
    try {
      modalEls.content.innerHTML = '<p>Memuat produk...</p>';
      showModal();

      const res = await fetch(`${PRODUCTS_API}/${id}`);
      if (!res.ok) throw new Error('Produk tidak ditemukan');
      const p = await res.json();

      const img = p.thumbnail || p.images?.[0] || 'https://placehold.co/600x400?text=Product';
      const outOfStock = (p.stock || 0) <= 0;
      const lowStock = !outOfStock && p.stock <= 10;

      modalEls.content.innerHTML = `
        <div class="detail-header">
          <img src="${img}" alt="${escapeHtml(p.title)}" class="detail-image">
          <div class="detail-info">
            <span class="category-label">${escapeHtml(p.category || '-')}</span>
            <h2>${escapeHtml(p.title)}</h2>
            <div class="detail-brand">Brand: ${escapeHtml(p.brand || '-')}</div>
            <div class="detail-price-row">
              <span class="price">${formatPrice(p.price)}</span>
              ${starHTML(p.rating || 0)}
            </div>
            <div class="stock-info${lowStock ? ' low' : ''}">
              ${outOfStock ? 'Stok habis' : `Stok tersedia: ${p.stock}`}
            </div>
            <div class="detail-description">${escapeHtml(p.description || '')}</div>
            <button class="btn-primary modal-add-cart-btn" type="button" style="width:100%" ${outOfStock ? 'disabled' : ''}>
              ${outOfStock ? 'Stok Habis' : 'Tambah ke Keranjang'}
            </button>
          </div>
        </div>
      `;

      modalEls.content.querySelector('.modal-add-cart-btn')?.addEventListener('click', () => {
        addToCart(p.id, { id: p.id, title: p.title, price: p.price, thumbnail: img });
      });
    } catch (err) {
      modalEls.content.innerHTML = `<p class="error">Gagal memuat produk: ${escapeHtml(err.message)}</p>`;
    }
  }

  // Keranjang Belanja
  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem('cart')) || [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartBadge();
    renderCart();
  }

  function addToCart(id, fallbackData) {
    const existing = state.cart.find((c) => c.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      const product = state.allProducts.find((p) => p.id === id);
      const img = product ? (product.thumbnail || (product.images && product.images[0])) : (fallbackData && fallbackData.thumbnail);
      state.cart.push(
        product
          ? { id: product.id, title: product.title, price: product.price, thumbnail: img, qty: 1 }
          : { ...(fallbackData || { id, title: `Produk #${id}`, price: 0, thumbnail: '' }), qty: 1 }
      );
    }
    saveCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((c) => c.id !== id);
    saveCart();
  }

  function changeQty(id, delta) {
    const item = state.cart.find((c) => c.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((c) => c.id !== id);
    }
    saveCart();
  }

  function updateCartBadge() {
    const totalQty = state.cart.reduce((sum, c) => sum + c.qty, 0);
    if (els.cartBadge) els.cartBadge.textContent = totalQty;
  }

  function cartTotalPrice() {
    return state.cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  }

  function renderCart() {
    if (!els.cartItems) return;
    if (state.cart.length === 0) {
      els.cartItems.innerHTML = `<div class="cart-empty">Keranjang belanja masih kosong.</div>`;
    } else {
      els.cartItems.innerHTML = state.cart
        .map(
          (c) => `
        <div class="cart-item">
          <img src="${c.thumbnail || 'https://placehold.co/100x100?text=Product'}" alt="${escapeHtml(c.title)}">
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(c.title)}</div>
            <div class="cart-item-price">${formatPrice(c.price)} x ${c.qty}</div>
            <div class="cart-item-qty">
              <button class="qty-dec" data-id="${c.id}" type="button">-</button>
              <span>${c.qty}</span>
              <button class="qty-inc" data-id="${c.id}" type="button">+</button>
              <button class="cart-item-remove" data-id="${c.id}" type="button">Hapus</button>
            </div>
          </div>
        </div>`
        )
        .join('');
    }

    if (els.cartTotal) {
      els.cartTotal.textContent = formatPrice(cartTotalPrice());
    }
  }

  function toggleCartPanel(open) {
    if (!els.cartPanel) return;
    els.cartPanel.hidden = !open;
    els.cartOverlay.hidden = !open;
    if (open) renderCart();
  }
})();
