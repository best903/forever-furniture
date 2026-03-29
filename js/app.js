(() => {
  'use strict';

  function formatPrice(num) {
    return num.toLocaleString('ko-KR') + '원';
  }

  const cacheBust = Date.now();

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

    return `
      <article id="${item.id}" class="furniture-card${soldClass}">
        <div class="gallery-wrapper">
          <div class="gallery">${images}</div>
          ${item.images.length > 1 ? `<div class="gallery-dots">${dots}</div>` : ''}
        </div>
        <div class="card-body">
          <h2 class="card-title">${item.name}</h2>
          <div class="card-price">
            <span class="price-original">${formatPrice(item.originalPrice)}</span>
            <span class="price-selling">${formatPrice(item.sellingPrice)}</span>
          </div>
          <p class="card-description">${item.description}</p>
          ${detailLink}
        </div>
      </article>`;
  }

  function initGalleryIndicators() {
    document.querySelectorAll('.gallery').forEach((gallery) => {
      const imgs = gallery.querySelectorAll('img');
      const dotsContainer = gallery.parentElement.querySelector('.gallery-dots');
      if (!dotsContainer || imgs.length <= 1) return;

      const dots = dotsContainer.querySelectorAll('.dot');

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const idx = Array.from(imgs).indexOf(entry.target);
              dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
            }
          });
        },
        { root: gallery, threshold: 0.5 }
      );

      imgs.forEach((img) => observer.observe(img));
    });
  }

  // ===== Lightbox =====
  let lightboxEl = null;
  let lightboxGallery = null;
  let lightboxObserver = null;
  let lightboxSourceGallery = null;
  let lightboxCurrentIndex = 0;

  function openLightbox(gallery, startIndex) {
    const imgs = gallery.querySelectorAll('img');
    if (!imgs.length) return;

    lightboxSourceGallery = gallery;
    lightboxCurrentIndex = startIndex;

    // Build lightbox HTML
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

    lightboxGallery = lightboxEl.querySelector('.lightbox-gallery');

    // Scroll to start image
    const lbImgs = lightboxGallery.querySelectorAll('img');
    if (lbImgs[startIndex]) {
      lightboxGallery.scrollLeft = lbImgs[startIndex].offsetLeft;
    }

    // Dot indicators
    if (imgs.length > 1) {
      const dots = lightboxEl.querySelectorAll('.dot');
      lightboxObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              lightboxCurrentIndex = Array.from(lbImgs).indexOf(entry.target);
              dots.forEach((dot, i) => dot.classList.toggle('active', i === lightboxCurrentIndex));
            }
          });
        },
        { root: lightboxGallery, threshold: 0.5 }
      );
      lbImgs.forEach((img) => lightboxObserver.observe(img));
    }

    // Events
    lightboxEl.addEventListener('click', closeLightbox);
    lightboxEl.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightboxGallery.addEventListener('click', (e) => e.stopPropagation());
    const lbDots = lightboxEl.querySelector('.lightbox-dots');
    if (lbDots) lbDots.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', handleLightboxKey);
  }

  function closeLightbox() {
    if (!lightboxEl) return;

    // Sync source gallery to current index
    if (lightboxSourceGallery) {
      const sourceImgs = lightboxSourceGallery.querySelectorAll('img');
      if (sourceImgs[lightboxCurrentIndex]) {
        lightboxSourceGallery.scrollLeft = sourceImgs[lightboxCurrentIndex].offsetLeft;
      }
    }

    if (lightboxObserver) {
      lightboxObserver.disconnect();
      lightboxObserver = null;
    }
    document.removeEventListener('keydown', handleLightboxKey);
    lightboxEl.remove();
    lightboxEl = null;
    lightboxGallery = null;
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
        const imgs = gallery.querySelectorAll('img');
        const index = Array.from(imgs).indexOf(img);
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

      initGalleryIndicators();
      initLightboxTriggers();
      scrollToHash();
    } catch (err) {
      list.innerHTML = '<p class="error-msg">데이터를 불러오지 못했습니다.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
