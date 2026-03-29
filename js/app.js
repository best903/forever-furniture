(() => {
  'use strict';

  const cacheBust = Date.now();
  const SWIPE_THRESHOLD = 40;

  function formatPrice(num) {
    return num.toLocaleString('ko-KR') + '원';
  }

  function calcDiscount(original, selling) {
    if (!original || original <= selling) return 0;
    return Math.round((1 - selling / original) * 100);
  }

  function renderCard(item) {
    const soldClass = item.sold ? ' sold' : '';
    const images = item.images
      .map((file, i) => {
        const lazy = i > 0 ? ' loading="lazy"' : '';
        return `<img src="images/${item.id}/${file}?t=${cacheBust}" alt="${item.name} 사진 ${i + 1}"${lazy}>`;
      })
      .join('');

    const dots = item.images
      .map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`)
      .join('');

    const detailLink = item.detailUrl
      ? `<a href="${item.detailUrl}" class="detail-link" target="_blank" rel="noopener">상품 정보 보기</a>`
      : '';

    const discount = calcDiscount(item.originalPrice, item.sellingPrice);
    const discountBadge = discount > 0 ? `<span class="price-discount">${discount}%</span>` : '';

    return `
      <article id="${item.id}" class="furniture-card${soldClass}">
        <div class="gallery-wrapper">
          <div class="gallery" data-index="0">${images}</div>
          ${item.images.length > 1 ? `<div class="gallery-dots">${dots}</div>` : ''}
        </div>
        <div class="card-body">
          <h2 class="card-title">${item.name}</h2>
          <div class="card-price">
            ${discountBadge}
            <span class="price-original">${formatPrice(item.originalPrice)}</span>
            <span class="price-selling">${formatPrice(item.sellingPrice)}</span>
          </div>
          <p class="card-description">${item.description}</p>
          ${detailLink}
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

    function goTo(idx) {
      currentIndex = Math.max(0, Math.min(idx, count - 1));
      container.style.transform = `translateX(-${currentIndex * 100}%)`;
      container.style.transition = 'transform 0.3s ease';
      container.dataset.index = currentIndex;

      // Update dots
      const dotsContainer = container.parentElement.querySelector('.gallery-dots, .lightbox-dots');
      if (dotsContainer) {
        dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
          dot.classList.toggle('active', i === currentIndex);
        });
      }
    }

    container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      container.style.transition = 'none';
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > SWIPE_THRESHOLD) {
        goTo(currentIndex + (diff > 0 ? 1 : -1));
      } else {
        goTo(currentIndex); // snap back
      }
    });

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
      .map((img) => `<img src="${img.src}" alt="${img.alt}">`)
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
      <div class="lightbox-gallery">${imagesHtml}</div>
      ${dotsHtml}`;

    document.body.appendChild(lightboxEl);
    document.body.classList.add('lightbox-open');

    const lbGallery = lightboxEl.querySelector('.lightbox-gallery');

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

    // Events
    lightboxEl.addEventListener('click', closeLightbox);
    lightboxEl.querySelector('.lightbox-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightbox();
    });
    lbGallery.addEventListener('click', (e) => e.stopPropagation());
    const lbDots = lightboxEl.querySelector('.lightbox-dots');
    if (lbDots) lbDots.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', handleLightboxKey);
  }

  function closeLightbox() {
    if (!lightboxEl) return;

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

  function handleLightboxKey(e) {
    if (e.key === 'Escape') closeLightbox();
  }

  function initLightboxTriggers() {
    document.querySelectorAll('.gallery img').forEach((img) => {
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
    document.querySelectorAll('#contact-link, #footer-contact-link').forEach((link) => {
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
    });
  }

  async function init() {
    const list = document.getElementById('furniture-list');

    try {
      const res = await fetch('data/furniture.json?t=' + Date.now());
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      setContactLinks(data.contact.kakaoOpenChatUrl);

      const html = data.furniture.map(renderCard).join('');
      list.innerHTML = html;

      initAllSwipes();
      initLightboxTriggers();
      scrollToHash();
    } catch (err) {
      list.innerHTML = '<p class="error-msg">데이터를 불러오지 못했습니다.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
