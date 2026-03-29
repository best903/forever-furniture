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
  let editingItem = null; // null = new item
  let pendingNewPhotos = []; // { file, dataUrl, blob }
  let pendingDeletePhotos = []; // filenames to delete

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

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
    return { content: data.content, sha: data.sha, encoding: data.encoding };
  }

  async function putFile(path, contentBase64, sha, message) {
    const body = {
      message,
      content: contentBase64,
      branch: BRANCH,
    };
    if (sha) body.sha = sha;

    try {
      return await apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (err.status === 409) {
        // SHA conflict — refresh and retry once
        const fresh = await getFile(path).catch(() => null);
        if (fresh) {
          body.sha = fresh.sha;
          return await apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          });
        }
      }
      throw err;
    }
  }

  async function deleteFile(path, sha, message) {
    return apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: BRANCH }),
    });
  }

  async function getDir(path) {
    try {
      const data = await apiRequest(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  // ===== Token Management =====
  function getToken() {
    return sessionStorage.getItem('gh_token') || '';
  }

  function setToken(t) {
    sessionStorage.setItem('gh_token', t);
    token = t;
  }

  function clearToken() {
    sessionStorage.removeItem('gh_token');
    token = '';
  }

  async function validateToken() {
    await apiRequest(`/repos/${OWNER}/${REPO}`);
  }

  // ===== Data Management =====
  async function loadFurnitureData() {
    const file = await getFile('data/furniture.json');
    furnitureSha = file.sha;
    const json = atob(file.content.replace(/\n/g, ''));
    furnitureData = JSON.parse(json);
    return furnitureData;
  }

  async function saveFurnitureData(message) {
    const json = JSON.stringify(furnitureData, null, 2) + '\n';
    const base64 = btoa(unescape(encodeURIComponent(json)));
    const result = await putFile('data/furniture.json', base64, furnitureSha, message);
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
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round(h * (maxWidth / w));
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);

          let quality = 0.8;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob.size > maxSizeKB * 1024 && quality > 0.3) {
                  quality -= 0.1;
                  tryCompress();
                } else {
                  const dataUrl = URL.createObjectURL(blob);
                  resolve({ blob, dataUrl });
                }
              },
              'image/jpeg',
              quality
            );
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
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
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

    list.innerHTML = furnitureData.furniture
      .map((item) => {
        const thumbSrc = item.images.length
          ? `images/${item.id}/${item.images[0]}`
          : '';
        const thumbHtml = thumbSrc
          ? `<img class="admin-card-thumb" src="${thumbSrc}" alt="">`
          : `<div class="admin-card-thumb"></div>`;
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
      })
      .join('');
  }

  // ===== Edit Modal =====
  function openEditModal(item) {
    editingItem = item || null;
    pendingNewPhotos = [];
    pendingDeletePhotos = [];

    $('#modal-title').textContent = item ? '가구 편집' : '새 가구 추가';
    $('#edit-id').value = item ? item.id : '';
    $('#edit-name').value = item ? item.name : '';
    $('#edit-original-price').value = item ? item.originalPrice : '';
    $('#edit-selling-price').value = item ? item.sellingPrice : '';
    $('#edit-description').value = item ? item.description : '';
    $('#edit-detail-url').value = item ? item.detailUrl : '';
    $('#edit-sold').checked = item ? item.sold : false;

    renderPhotoList();
    $('#edit-modal').style.display = '';
    $('#edit-name').focus();
  }

  function closeEditModal() {
    $('#edit-modal').style.display = 'none';
    pendingNewPhotos.forEach((p) => URL.revokeObjectURL(p.dataUrl));
    pendingNewPhotos = [];
    pendingDeletePhotos = [];
  }

  function renderPhotoList() {
    const container = $('#photo-list');
    let html = '';

    // Existing photos
    if (editingItem) {
      editingItem.images
        .filter((f) => !pendingDeletePhotos.includes(f))
        .forEach((filename) => {
          html += `
            <div class="photo-item">
              <img src="images/${editingItem.id}/${filename}" alt="">
              <button type="button" class="photo-remove" onclick="Admin.removePhoto('${filename}')">&times;</button>
            </div>`;
        });
    }

    // New photos
    pendingNewPhotos.forEach((p, i) => {
      html += `
        <div class="photo-item new-photo">
          <img src="${p.dataUrl}" alt="">
          <button type="button" class="photo-remove" onclick="Admin.removeNewPhoto(${i})">&times;</button>
        </div>`;
    });

    container.innerHTML = html;
  }

  // ===== Save =====
  async function handleSave(e) {
    e.preventDefault();
    const saveBtn = $('#btn-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    try {
      const isNew = !editingItem;
      const id = isNew
        ? `item-${Date.now()}`
        : editingItem.id;

      const itemData = {
        id,
        name: $('#edit-name').value.trim(),
        originalPrice: Number($('#edit-original-price').value),
        sellingPrice: Number($('#edit-selling-price').value),
        description: $('#edit-description').value.trim(),
        detailUrl: $('#edit-detail-url').value.trim(),
        images: isNew ? [] : editingItem.images.filter((f) => !pendingDeletePhotos.includes(f)),
        sold: $('#edit-sold').checked,
      };

      // 1. Upload new photos
      for (let i = 0; i < pendingNewPhotos.length; i++) {
        const photo = pendingNewPhotos[i];
        const filename = `${itemData.images.length + 1}.jpg`;
        showToast(`사진 업로드 중... (${i + 1}/${pendingNewPhotos.length})`, 'info');

        const base64 = await blobToBase64(photo.blob);
        await putFile(`images/${id}/${filename}`, base64, null, `Add image: ${id}/${filename}`);
        itemData.images.push(filename);
      }

      // 2. Delete removed photos
      for (const filename of pendingDeletePhotos) {
        showToast(`사진 삭제 중...`, 'info');
        try {
          const fileInfo = await getFile(`images/${editingItem.id}/${filename}`);
          await deleteFile(`images/${editingItem.id}/${filename}`, fileInfo.sha, `Delete image: ${editingItem.id}/${filename}`);
        } catch {
          // Ignore if file already gone
        }
      }

      // 3. Update furniture.json (last, once)
      // Refresh SHA before save
      const freshFile = await getFile('data/furniture.json');
      furnitureSha = freshFile.sha;
      const freshJson = atob(freshFile.content.replace(/\n/g, ''));
      furnitureData = JSON.parse(freshJson);

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
      overlay.innerHTML = `
        <div class="confirm-box">
          <p>${msg}</p>
          <button class="btn btn-danger btn-sm" id="confirm-yes">삭제</button>
          <button class="btn btn-ghost btn-sm" id="confirm-no">취소</button>
        </div>`;
      document.body.appendChild(overlay);

      overlay.querySelector('#confirm-yes').onclick = () => {
        overlay.remove();
        resolve(true);
      };
      overlay.querySelector('#confirm-no').onclick = () => {
        overlay.remove();
        resolve(false);
      };
    });
  }

  async function removeFurniture(id) {
    const item = furnitureData.furniture.find((f) => f.id === id);
    if (!item) return;

    const confirmed = await showConfirm(`"${item.name}"을(를) 삭제하시겠습니까?`);
    if (!confirmed) return;

    showToast('삭제 중...', 'info');

    try {
      // Delete images
      const files = await getDir(`images/${id}`);
      for (const file of files) {
        await deleteFile(file.path, file.sha, `Delete image: ${file.path}`);
      }

      // Refresh and update JSON
      const freshFile = await getFile('data/furniture.json');
      furnitureSha = freshFile.sha;
      const freshJson = atob(freshFile.content.replace(/\n/g, ''));
      furnitureData = JSON.parse(freshJson);

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
      pendingNewPhotos.push({ file, dataUrl: resized.dataUrl, blob: resized.blob });
    }
    renderPhotoList();
    e.target.value = '';
  }

  function removeExistingPhoto(filename) {
    pendingDeletePhotos.push(filename);
    renderPhotoList();
  }

  function removeNewPhoto(index) {
    URL.revokeObjectURL(pendingNewPhotos[index].dataUrl);
    pendingNewPhotos.splice(index, 1);
    renderPhotoList();
  }

  // ===== Init =====
  async function init() {
    // Event listeners
    $('#token-submit').addEventListener('click', handleAuth);
    $('#token-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAuth();
    });
    $('#btn-add').addEventListener('click', () => openEditModal(null));
    $('#btn-logout').addEventListener('click', () => {
      clearToken();
      location.reload();
    });
    $('#btn-cancel').addEventListener('click', closeEditModal);
    $('.modal-backdrop').addEventListener('click', closeEditModal);
    $('#edit-form').addEventListener('submit', handleSave);
    $('#photo-upload').addEventListener('change', handlePhotoUpload);

    // Check existing token
    const savedToken = getToken();
    if (savedToken) {
      token = savedToken;
      try {
        await loadAndShow();
      } catch {
        clearToken();
        showAuthScreen();
      }
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
      const msg = err.status === 401
        ? '토큰이 유효하지 않습니다. 권한을 확인해주세요.'
        : `연결 실패 (${err.status || ''}): ${err.message}`;
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

  // ===== Public API (for onclick handlers) =====
  window.Admin = {
    edit(id) {
      const item = furnitureData.furniture.find((f) => f.id === id);
      if (item) openEditModal(item);
    },
    remove(id) {
      removeFurniture(id);
    },
    removePhoto(filename) {
      removeExistingPhoto(filename);
    },
    removeNewPhoto(index) {
      removeNewPhoto(index);
    },
  };

  document.addEventListener('DOMContentLoaded', init);
})();
