(() => {
  'use strict';

  const cacheBust = Date.now();
  const SWIPE_THRESHOLD = 40;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url) {
    const s = String(url).trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }

  function formatPrice(num) {
    return num.toLocaleString('ko-KR') + '원';
  }

  function calcDiscount(original, selling) {
    if (!original || original <= selling) return 0;
    return Math.round((1 - selling / original) * 100);
  }

  function renderCard(item) {
    const soldClass = item.sold ? ' sold' : '';
    const safeId = escapeHtml(item.id);
    const safeName = escapeHtml(item.name);
    const images = item.images
      .map((file, i) => {
        return `<img src="images/${safeId}/${escapeHtml(file)}?t=${cacheBust}" alt="${safeName} 사진 ${i + 1}">`;
      })
      .join('');

    const dots = item.images
      .map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`)
      .join('');

    const links = item.links || (item.detailUrl ? [{ label: '상품 정보', url: item.detailUrl }] : []);
    const linksHtml = links
      .filter((l) => l.url)
      .map((l) => {
        const safeUrl = sanitizeUrl(l.url);
        return safeUrl ? `<a href="${escapeHtml(safeUrl)}" class="detail-link" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label || '링크')}</a>` : '';
      })
      .join('');

    const discount = calcDiscount(item.originalPrice, item.sellingPrice);
    const discountBadge = discount > 0 ? `<span class="price-discount">${discount}%</span>` : '';

    return `
      <article id="${safeId}" class="furniture-card${soldClass}">
        <div class="gallery-wrapper">
          <div class="gallery" data-index="0">${images}</div>
          ${item.images.length > 1 ? `<button class="gallery-arrow gallery-arrow-left">&#8249;</button><button class="gallery-arrow gallery-arrow-right">&#8250;</button><div class="gallery-dots">${dots}</div>` : ''}
        </div>
        <div class="card-body">
          <h2 class="card-title">${safeName}</h2>
          <div class="card-price">
            ${discountBadge}
            <span class="price-original">${formatPrice(item.originalPrice)}</span>
            <span class="price-selling">${formatPrice(item.sellingPrice)}</span>
          </div>
          <p class="card-description">${escapeHtml(item.description)}</p>
          ${linksHtml}
        </div>
      </article>`;
  }

  // ===== Swipe Controller =====
  function initSwipe(container) {
    let startX = 0;
    let currentIndex = 0;
    const imgs = container.querySelectorAll('img');
    const count = imgs.length;
    if (count <= 1) return;

    // Touch target is the overflow-hidden wrapper
    const touchTarget = container.parentElement;

    function goTo(idx) {
      currentIndex = Math.max(0, Math.min(idx, count - 1));
      container.style.transform = `translateX(-${currentIndex * 100}%)`;
      container.style.transition = 'transform 0.3s ease';
      container.dataset.index = currentIndex;

      // Update dots — look in parent or grandparent for dots
      const wrapper = container.closest('.gallery-wrapper, .lightbox');
      if (wrapper) {
        const dotsContainer = wrapper.querySelector('.gallery-dots, .lightbox-dots');
        if (dotsContainer) {
          dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentIndex);
          });
        }
      }
    }

    let startY = 0;
    let swiping = false;

    touchTarget.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = false;
      container.style.transition = 'none';
    }, { passive: true });

    touchTarget.addEventListener('touchmove', (e) => {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > dy && dx > 10) {
        swiping = true;
        e.preventDefault(); // prevent vertical scroll during horizontal swipe
      }
    }, { passive: false });

    touchTarget.addEventListener('touchend', (e) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > SWIPE_THRESHOLD) {
        goTo(currentIndex + (diff > 0 ? 1 : -1));
      } else {
        goTo(currentIndex); // snap back
      }
    });

    // Card gallery arrow buttons
    const wrapper = container.closest('.gallery-wrapper');
    if (wrapper) {
      const leftBtn = wrapper.querySelector('.gallery-arrow-left');
      const rightBtn = wrapper.querySelector('.gallery-arrow-right');
      if (leftBtn) leftBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(currentIndex - 1); });
      if (rightBtn) rightBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(currentIndex + 1); });
    }

    // Store goTo for external use
    container._goTo = goTo;
    container._getIndex = () => currentIndex;
    container._setIndex = (idx) => { currentIndex = idx; };
  }

  function initAllSwipes() {
    document.querySelectorAll('.gallery').forEach(initSwipe);
  }

  // ===== Lightbox =====
  let lightboxEl = null;
  let lightboxSourceGallery = null;

  function openLightbox(gallery, startIndex) {
    const imgs = gallery.querySelectorAll('img');
    if (!imgs.length) return;

    lightboxSourceGallery = gallery;

    const imagesHtml = Array.from(imgs)
      .map((img) => `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}">`)
      .join('');

    const dotsHtml = imgs.length > 1
      ? `<div class="lightbox-dots">${Array.from(imgs).map((_, i) => `<span class="dot${i === startIndex ? ' active' : ''}"></span>`).join('')}</div>`
      : '';

    lightboxEl = document.createElement('div');
    lightboxEl.className = 'lightbox';
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.innerHTML = `
      <button class="lightbox-close">&times;</button>
      <div class="lightbox-gallery-wrapper"><div class="lightbox-gallery">${imagesHtml}</div></div>
      ${dotsHtml}`;

    document.body.appendChild(lightboxEl);
    document.body.classList.add('lightbox-open');

    const lbGallery = lightboxEl.querySelector('.lightbox-gallery');
    const imgCount = imgs.length;

    // Init swipe for lightbox
    initSwipe(lbGallery);
    if (lbGallery._goTo) {
      lbGallery._setIndex(startIndex);
      lbGallery.style.transform = `translateX(-${startIndex * 100}%)`;
      lbGallery.style.transition = 'none';
      // Update dots
      const dots = lightboxEl.querySelectorAll('.dot');
      dots.forEach((dot, i) => dot.classList.toggle('active', i === startIndex));
    }

    // Nav arrows (PC)
    if (imgCount > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'lightbox-arrow lightbox-arrow-left';
      prevBtn.innerHTML = '&#8249;';
      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); lbGallery._goTo(lbGallery._getIndex() - 1); });

      const nextBtn = document.createElement('button');
      nextBtn.className = 'lightbox-arrow lightbox-arrow-right';
      nextBtn.innerHTML = '&#8250;';
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); lbGallery._goTo(lbGallery._getIndex() + 1); });

      lightboxEl.appendChild(prevBtn);
      lightboxEl.appendChild(nextBtn);
    }

    // History: push state so back button closes lightbox
    history.pushState({ lightbox: true }, '');
    window.addEventListener('popstate', onPopStateLightbox);

    // Events
    lightboxEl.addEventListener('click', () => closeLightbox());
    lightboxEl.querySelector('.lightbox-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightbox();
    });
    const lbWrapper = lightboxEl.querySelector('.lightbox-gallery-wrapper');
    lbWrapper.addEventListener('click', (e) => e.stopPropagation());
    const lbDots = lightboxEl.querySelector('.lightbox-dots');
    if (lbDots) lbDots.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', handleLightboxKey);
  }

  function closeLightbox(fromPopState) {
    if (!lightboxEl) return;

    if (fromPopState !== true) {
      // X, background click, ESC: let history.back() trigger popstate → actual cleanup
      history.back();
      return;
    }

    // Called from popstate: history already popped, do DOM cleanup
    window.removeEventListener('popstate', onPopStateLightbox);

    // Sync source gallery to current index
    const lbGallery = lightboxEl.querySelector('.lightbox-gallery');
    if (lightboxSourceGallery && lbGallery._getIndex) {
      const idx = lbGallery._getIndex();
      if (lightboxSourceGallery._goTo) {
        lightboxSourceGallery._setIndex(idx);
        lightboxSourceGallery.style.transform = `translateX(-${idx * 100}%)`;
        lightboxSourceGallery.style.transition = 'none';
        // Update card dots
        const dotsContainer = lightboxSourceGallery.parentElement.querySelector('.gallery-dots');
        if (dotsContainer) {
          dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === idx);
          });
        }
      }
    }

    document.removeEventListener('keydown', handleLightboxKey);
    lightboxEl.remove();
    lightboxEl = null;
    lightboxSourceGallery = null;
    document.body.classList.remove('lightbox-open');
  }

  function onPopStateLightbox() {
    closeLightbox(true);
  }

  function handleLightboxKey(e) {
    if (e.key === 'Escape') closeLightbox();
    const lbGallery = lightboxEl && lightboxEl.querySelector('.lightbox-gallery');
    if (!lbGallery || !lbGallery._goTo) return;
    if (e.key === 'ArrowLeft') lbGallery._goTo(lbGallery._getIndex() - 1);
    if (e.key === 'ArrowRight') lbGallery._goTo(lbGallery._getIndex() + 1);
  }

  function initLightboxTriggers() {
    document.querySelectorAll('.furniture-card .gallery img').forEach((img) => {
      img.addEventListener('click', () => {
        const gallery = img.closest('.gallery');
        const index = gallery._getIndex ? gallery._getIndex() : 0;
        openLightbox(gallery, index);
      });
    });
  }

  function scrollToHash() {
    if (!location.hash) return;
    const el = document.querySelector(location.hash);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }

  function setContactLinks(url) {
    const safeUrl = sanitizeUrl(url);
    document.querySelectorAll('#contact-link, #footer-contact-link').forEach((link) => {
      link.href = safeUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  function initHeroAutoplay() {
    const heroGallery = document.querySelector('.hero-slider .gallery');
    if (!heroGallery || !heroGallery._goTo) return;
    const count = heroGallery.querySelectorAll('img').length;
    let timer;
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = (heroGallery._getIndex() + 1) % count;
        heroGallery._goTo(next);
        schedule();
      }, 5000);
    }
    const wrapper = heroGallery.parentElement;
    wrapper.addEventListener('touchend', () => schedule());
    schedule();
  }

  async function init() {
    // Init hero slider (static HTML, no data dependency)
    const heroGallery = document.querySelector('.hero-slider .gallery');
    if (heroGallery) initSwipe(heroGallery);
    initHeroAutoplay();

    const list = document.getElementById('furniture-list');

    try {
      const res = await fetch('data/furniture.json?t=' + Date.now());
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      setContactLinks(data.contact.kakaoOpenChatUrl);

      const html = data.furniture.map(renderCard).join('');
      list.innerHTML = html;

      // Init card galleries only (not hero)
      document.querySelectorAll('.furniture-card .gallery').forEach(initSwipe);
      initLightboxTriggers();
      scrollToHash();
    } catch (err) {
      list.innerHTML = '<p class="error-msg">데이터를 불러오지 못했습니다.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
