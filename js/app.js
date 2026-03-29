(() => {
  'use strict';

  function formatPrice(num) {
    return num.toLocaleString('ko-KR') + '원';
  }

  function renderCard(item) {
    const soldClass = item.sold ? ' sold' : '';
    const images = item.images
      .map((file, i) => {
        const lazy = i > 0 ? ' loading="lazy"' : '';
        return `<img src="images/${item.id}/${file}" alt="${item.name} 사진 ${i + 1}"${lazy}>`;
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
      const res = await fetch('data/furniture.json');
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      setContactLinks(data.contact.kakaoOpenChatUrl);

      const html = data.furniture.map(renderCard).join('');
      list.innerHTML = html;

      initGalleryIndicators();
      scrollToHash();
    } catch (err) {
      list.innerHTML = '<p class="error-msg">데이터를 불러오지 못했습니다.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
