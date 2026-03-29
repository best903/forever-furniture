(() => {
  'use strict';

  const OWNER = 'best903';
  const REPO = 'forever-furniture';
  const BRANCH = 'main';
  const API_BASE = 'https://api.github.com';

  // ===== State =====
  let token = '';
  let furnitureData = null;
  let furnitureSha = '';
  let editingItem = null;
  let allPhotos = []; // { type: 'existing', filename } | { type: 'new', blob, dataUrl }
  let editingLinks = []; // [{ label, url }]

  const $ = (sel) => document.querySelector(sel);

  // ===== Toast =====
  function showToast(msg, type = 'info', duration = 3000) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = '';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
  }

  // ===== GitHub API =====
  async function apiRequest(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.message || res.statusText);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function getFile(path) {
    const data = await apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
    return { content: data.content, sha: data.sha };
  }

  async function putFile(path, contentBase64, sha, message) {
    if (!sha) {
      const existing = await getFile(path).catch(() => null);
      if (existing) sha = existing.sha;
    }
    const body = { message, content: contentBase64, branch: BRANCH };
    if (sha) body.sha = sha;
    try {
      return await apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
        method: 'PUT', body: JSON.stringify(body),
      });
    } catch (err) {
      if (err.status === 409 || err.status === 422) {
        const fresh = await getFile(path).catch(() => null);
        if (fresh) {
          body.sha = fresh.sha;
          return await apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
            method: 'PUT', body: JSON.stringify(body),
          });
        }
      }
      throw err;
    }
  }

  async function deleteFile(path, sha, message) {
    return apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'DELETE', body: JSON.stringify({ message, sha, branch: BRANCH }),
    });
  }

  async function getDir(path) {
    try {
      const data = await apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  // ===== Token =====
  function getToken() { return localStorage.getItem('gh_token') || ''; }
  function setToken(t) { localStorage.setItem('gh_token', t); token = t; }
  function clearToken() { localStorage.removeItem('gh_token'); token = ''; }
  async function validateToken() { await apiRequest(`/repos/${OWNER}/${REPO}`); }

  // ===== Data =====
  function decodeBase64(b64) {
    const binary = atob(b64.replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  }

  function encodeBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  async function loadFurnitureData() {
    const file = await getFile('data/furniture.json');
    furnitureSha = file.sha;
    furnitureData = JSON.parse(decodeBase64(file.content));
    return furnitureData;
  }

  async function saveFurnitureData(message) {
    const json = JSON.stringify(furnitureData, null, 2) + '\n';
    const fresh = await getFile('data/furniture.json');
    furnitureSha = fresh.sha;
    const result = await putFile('data/furniture.json', encodeBase64(json), furnitureSha, message);
    furnitureSha = result.content.sha;
  }

  // ===== Image Resize =====
  function resizeImage(file, maxWidth = 1200, maxSizeKB = 500) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          let quality = 0.8;
          const tryCompress = () => {
            canvas.toBlob((blob) => {
              if (blob.size > maxSizeKB * 1024 && quality > 0.3) { quality -= 0.1; tryCompress(); }
              else { resolve({ blob, dataUrl: URL.createObjectURL(blob) }); }
            }, 'image/jpeg', quality);
          };
          tryCompress();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  // ===== Render List =====
  function renderList() {
    const list = $('#furniture-list');
    if (!furnitureData || !furnitureData.furniture.length) {
      list.innerHTML = '<p class="loading-msg">등록된 가구가 없습니다.</p>';
      return;
    }
    list.innerHTML = furnitureData.furniture.map((item) => {
      const thumbSrc = item.images.length ? `images/${item.id}/${item.images[0]}` : '';
      const thumbHtml = thumbSrc ? `<img class="admin-card-thumb" src="${thumbSrc}" alt="">` : `<div class="admin-card-thumb"></div>`;
      const soldClass = item.sold ? ' sold' : '';
      const statusText = item.sold ? '판매완료' : `${item.sellingPrice.toLocaleString('ko-KR')}원`;
      return `
        <div class="admin-card${soldClass}" data-id="${item.id}">
          ${thumbHtml}
          <div class="admin-card-info">
            <div class="admin-card-name">${item.name}</div>
            <div class="admin-card-price">${statusText}</div>
          </div>
          <div class="admin-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="Admin.edit('${item.id}')">편집</button>
            <button class="btn btn-danger btn-sm" onclick="Admin.remove('${item.id}')">삭제</button>
          </div>
        </div>`;
    }).join('');
  }

  // ===== Edit Modal =====
  function openEditModal(item) {
    editingItem = item || null;

    // Init allPhotos
    if (item) {
      allPhotos = item.images.map((f) => ({ type: 'existing', filename: f }));
    } else {
      allPhotos = [];
    }

    // Init editingLinks
    if (item && item.links) {
      editingLinks = item.links.map((l) => ({ ...l }));
    } else if (item && item.detailUrl) {
      editingLinks = [{ label: '상품 정보', url: item.detailUrl }];
    } else {
      editingLinks = [];
    }

    $('#modal-title').textContent = item ? '가구 편집' : '새 가구 추가';
    $('#edit-id').value = item ? item.id : '';
    $('#edit-name').value = item ? item.name : '';
    $('#edit-original-price').value = item ? item.originalPrice : '';
    $('#edit-selling-price').value = item ? item.sellingPrice : '';
    $('#edit-description').value = item ? item.description : '';
    $('#edit-sold').checked = item ? item.sold : false;

    renderPhotoList();
    renderLinksList();
    $('#edit-modal').style.display = '';
    $('#edit-name').focus();
  }

  function closeEditModal() {
    $('#edit-modal').style.display = 'none';
    allPhotos.filter((p) => p.type === 'new').forEach((p) => URL.revokeObjectURL(p.dataUrl));
    allPhotos = [];
    editingLinks = [];
  }

  // ===== Photo List with ↑↓ =====
  function renderPhotoList() {
    const container = $('#photo-list');
    const count = allPhotos.length;
    container.innerHTML = allPhotos.map((photo, i) => {
      const src = photo.type === 'existing'
        ? `images/${editingItem.id}/${photo.filename}`
        : photo.dataUrl;
      const isNew = photo.type === 'new' ? ' new-photo' : '';
      const upBtn = i > 0 ? `<button type="button" class="photo-order-btn" onclick="Admin.movePhoto(${i},-1)">↑</button>` : '';
      const downBtn = i < count - 1 ? `<button type="button" class="photo-order-btn" onclick="Admin.movePhoto(${i},1)">↓</button>` : '';
      return `
        <div class="photo-item${isNew}">
          <img src="${src}" alt="">
          <div class="photo-controls">
            ${upBtn}${downBtn}
            <button type="button" class="photo-remove" onclick="Admin.removePhoto(${i})">&times;</button>
          </div>
        </div>`;
    }).join('');
  }

  // ===== Links List =====
  function renderLinksList() {
    const container = $('#links-list');
    container.innerHTML = editingLinks.map((link, i) => `
      <div class="link-row">
        <input type="text" value="${link.label}" placeholder="라벨" onchange="Admin.updateLink(${i},'label',this.value)">
        <input type="url" value="${link.url}" placeholder="https://..." onchange="Admin.updateLink(${i},'url',this.value)">
        <button type="button" class="btn btn-danger btn-sm" onclick="Admin.removeLink(${i})">&times;</button>
      </div>
    `).join('');
  }

  // ===== Save =====
  async function handleSave(e) {
    e.preventDefault();
    const saveBtn = $('#btn-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    try {
      const isNew = !editingItem;
      const id = isNew ? `item-${Date.now()}` : editingItem.id;

      // Determine which existing photos were removed
      const originalImages = isNew ? [] : editingItem.images;
      const keptExisting = allPhotos.filter((p) => p.type === 'existing').map((p) => p.filename);
      const deletedImages = originalImages.filter((f) => !keptExisting.includes(f));

      // 1. Delete removed photos
      for (const filename of deletedImages) {
        showToast('사진 삭제 중...', 'info');
        try {
          const fileInfo = await getFile(`images/${editingItem.id}/${filename}`);
          await deleteFile(`images/${editingItem.id}/${filename}`, fileInfo.sha, `Delete image: ${editingItem.id}/${filename}`);
        } catch { /* ignore */ }
      }

      // 2. Upload new photos
      const finalImages = [];
      for (const photo of allPhotos) {
        if (photo.type === 'existing') {
          finalImages.push(photo.filename);
        } else {
          const filename = `${Date.now()}-${finalImages.length + 1}.jpg`;
          showToast(`사진 업로드 중...`, 'info');
          const base64 = await blobToBase64(photo.blob);
          await putFile(`images/${id}/${filename}`, base64, null, `Add image: ${id}/${filename}`);
          finalImages.push(filename);
        }
      }

      // 3. Build item data
      const itemData = {
        id,
        name: $('#edit-name').value.trim(),
        originalPrice: Number($('#edit-original-price').value),
        sellingPrice: Number($('#edit-selling-price').value),
        description: $('#edit-description').value.trim(),
        links: editingLinks.filter((l) => l.url),
        images: finalImages,
        sold: $('#edit-sold').checked,
      };

      // 4. Update furniture.json
      const freshFile = await getFile('data/furniture.json');
      furnitureSha = freshFile.sha;
      furnitureData = JSON.parse(decodeBase64(freshFile.content));

      if (isNew) {
        furnitureData.furniture.push(itemData);
      } else {
        const idx = furnitureData.furniture.findIndex((f) => f.id === id);
        if (idx >= 0) furnitureData.furniture[idx] = itemData;
      }

      await saveFurnitureData(isNew ? `Add furniture: ${itemData.name}` : `Update furniture: ${itemData.name}`);

      showToast(isNew ? '가구가 추가되었습니다.' : '가구가 수정되었습니다.', 'success');
      closeEditModal();
      renderList();
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error', 5000);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  }

  // ===== Delete Furniture =====
  function showConfirm(msg) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `<div class="confirm-box"><p>${msg}</p><button class="btn btn-danger btn-sm" id="confirm-yes">삭제</button><button class="btn btn-ghost btn-sm" id="confirm-no">취소</button></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
      overlay.querySelector('#confirm-no').onclick = () => { overlay.remove(); resolve(false); };
    });
  }

  async function removeFurniture(id) {
    const item = furnitureData.furniture.find((f) => f.id === id);
    if (!item) return;
    const confirmed = await showConfirm(`"${item.name}"을(를) 삭제하시겠습니까?`);
    if (!confirmed) return;
    showToast('삭제 중...', 'info');
    try {
      const files = await getDir(`images/${id}`);
      for (const file of files) {
        await deleteFile(file.path, file.sha, `Delete image: ${file.path}`);
      }
      const freshFile = await getFile('data/furniture.json');
      furnitureSha = freshFile.sha;
      furnitureData = JSON.parse(decodeBase64(freshFile.content));
      furnitureData.furniture = furnitureData.furniture.filter((f) => f.id !== id);
      await saveFurnitureData(`Delete furniture: ${item.name}`);
      showToast('삭제되었습니다.', 'success');
      renderList();
    } catch (err) {
      showToast(`삭제 실패: ${err.message}`, 'error', 5000);
    }
  }

  // ===== Photo Handlers =====
  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    for (const file of files) {
      showToast('사진 처리 중...', 'info');
      const resized = await resizeImage(file);
      allPhotos.push({ type: 'new', blob: resized.blob, dataUrl: resized.dataUrl });
    }
    renderPhotoList();
    e.target.value = '';
  }

  // ===== Init =====
  async function init() {
    $('#token-submit').addEventListener('click', handleAuth);
    $('#token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuth(); });
    $('#btn-add').addEventListener('click', () => openEditModal(null));
    $('#btn-logout').addEventListener('click', () => { clearToken(); location.reload(); });
    $('#btn-cancel').addEventListener('click', closeEditModal);
    $('.modal-backdrop').addEventListener('click', closeEditModal);
    $('#edit-form').addEventListener('submit', handleSave);
    $('#photo-upload').addEventListener('change', handlePhotoUpload);
    $('#btn-add-link').addEventListener('click', () => {
      editingLinks.push({ label: '', url: '' });
      renderLinksList();
    });

    const savedToken = getToken();
    if (savedToken) {
      token = savedToken;
      try { await loadAndShow(); }
      catch { clearToken(); showAuthScreen(); }
    } else {
      showAuthScreen();
    }
  }

  async function handleAuth() {
    const input = $('#token-input');
    const errorEl = $('#auth-error');
    const btn = $('#token-submit');
    const val = input.value.trim();
    if (!val) return;
    btn.disabled = true;
    btn.textContent = '연결 중...';
    errorEl.style.display = 'none';
    try {
      setToken(val);
      await validateToken();
      await loadAndShow();
    } catch (err) {
      clearToken();
      const msg = err.status === 401 ? '토큰이 유효하지 않습니다.' : `연결 실패: ${err.message}`;
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
      showToast(msg, 'error', 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = '연결';
    }
  }

  function showAuthScreen() {
    $('#auth-screen').style.display = '';
    $('#admin-screen').style.display = 'none';
  }

  async function loadAndShow() {
    $('#auth-screen').style.display = 'none';
    $('#admin-screen').style.display = '';
    await loadFurnitureData();
    renderList();
  }

  // ===== Public API =====
  window.Admin = {
    edit(id) {
      const item = furnitureData.furniture.find((f) => f.id === id);
      if (item) openEditModal(item);
    },
    remove(id) { removeFurniture(id); },
    removePhoto(index) {
      const photo = allPhotos[index];
      if (photo.type === 'new') URL.revokeObjectURL(photo.dataUrl);
      allPhotos.splice(index, 1);
      renderPhotoList();
    },
    movePhoto(index, dir) {
      const newIdx = index + dir;
      if (newIdx < 0 || newIdx >= allPhotos.length) return;
      [allPhotos[index], allPhotos[newIdx]] = [allPhotos[newIdx], allPhotos[index]];
      renderPhotoList();
    },
    updateLink(index, field, value) {
      editingLinks[index][field] = value;
    },
    removeLink(index) {
      editingLinks.splice(index, 1);
      renderLinksList();
    },
  };

  document.addEventListener('DOMContentLoaded', init);
})();
