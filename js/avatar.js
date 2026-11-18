const DATABASE_NAME = "pixel-adventure";
const STORE_NAME = "character";
const AVATAR_KEY = "face";
const PREVIEW_SIZE = 192;

export function createAvatarCustomization({ fileInput, preview, zoomInput, zoomValue, saveCheckbox, status, onAvatarChange }) {
  const previewContext = preview.getContext("2d");
  let avatar = null;
  let pointerPosition = null;
  let saveTimer;

  function setStatus(message) {
    status.textContent = message;
  }

  function drawPreview() {
    previewContext.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    if (avatar) {
      drawCircularImage(previewContext, avatar, 0, 0, PREVIEW_SIZE);
    } else {
      drawDefaultHead(previewContext);
    }
  }

  function updateZoom() {
    if (!avatar) return;
    avatar.zoom = Number(zoomInput.value);
    zoomValue.textContent = `${avatar.zoom.toFixed(1)}×`;
    drawPreview();
    scheduleSave();
  }

  async function acceptFile(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStatus("Choose a JPG, PNG, or WebP image.");
      fileInput.value = "";
      return;
    }
    try {
      const image = await loadImage(file);
      avatar = { image, blob: file, zoom: 1, offsetX: 0, offsetY: 0 };
      zoomInput.value = "1";
      zoomValue.textContent = "1.0×";
      setStatus("Photo ready! Drag the circle to position your face.");
      drawPreview();
      onAvatarChange();
      await persistIfRequested();
    } catch (error) {
      setStatus("Could not read that photo. Please choose another image.");
      console.error("Could not load the selected character photo.", error);
    }
    fileInput.value = "";
  }

  function removePhoto() {
    avatar = null;
    zoomInput.value = "1";
    zoomValue.textContent = "1.0×";
    saveCheckbox.checked = false;
    setStatus("Default explorer restored.");
    drawPreview();
    onAvatarChange();
    deleteStoredAvatar().catch((error) => {
      setStatus("Photo removed for this session, but saved photo data could not be cleared.");
      console.error("Could not remove the saved character photo.", error);
    });
  }

  function scheduleSave() {
    if (!saveCheckbox.checked || !avatar) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistIfRequested, 250);
  }

  async function persistIfRequested() {
    if (!saveCheckbox.checked || !avatar) return;
    try {
      await putStoredAvatar({
        blob: avatar.blob,
        zoom: avatar.zoom,
        offsetX: avatar.offsetX,
        offsetY: avatar.offsetY,
      });
      setStatus("Photo saved on this device only.");
    } catch (error) {
      setStatus("Could not save your photo on this device.");
      console.error("Could not save the character photo.", error);
    }
  }

  async function restoreSavedAvatar() {
    try {
      const saved = await getStoredAvatar();
      if (!saved) return;
      const image = await loadImage(saved.blob);
      avatar = {
        image,
        blob: saved.blob,
        zoom: saved.zoom || 1,
        offsetX: saved.offsetX || 0,
        offsetY: saved.offsetY || 0,
      };
      zoomInput.value = String(avatar.zoom);
      zoomValue.textContent = `${avatar.zoom.toFixed(1)}×`;
      saveCheckbox.checked = true;
      setStatus("Your saved photo is ready.");
      drawPreview();
      onAvatarChange();
    } catch (error) {
      setStatus("Could not restore the saved photo. The default explorer is ready.");
      console.error("Could not restore the saved character photo.", error);
    }
  }

  fileInput.addEventListener("change", () => acceptFile(fileInput.files[0]));
  zoomInput.addEventListener("input", updateZoom);
  saveCheckbox.addEventListener("change", async () => {
    if (saveCheckbox.checked && avatar) {
      await persistIfRequested();
    } else if (!saveCheckbox.checked) {
      try {
        await deleteStoredAvatar();
        if (avatar) setStatus("Photo will only be used for this session.");
      } catch (error) {
        setStatus("Could not clear the saved photo.");
        console.error("Could not clear the saved character photo.", error);
      }
    }
  });

  preview.addEventListener("pointerdown", (event) => {
    if (!avatar) return;
    pointerPosition = { x: event.clientX, y: event.clientY };
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener("pointermove", (event) => {
    if (!pointerPosition || !avatar) return;
    const bounds = preview.getBoundingClientRect();
    const scale = PREVIEW_SIZE / Math.min(bounds.width, bounds.height);
    avatar.offsetX = clampOffset(avatar.offsetX + (event.clientX - pointerPosition.x) * scale / PREVIEW_SIZE);
    avatar.offsetY = clampOffset(avatar.offsetY + (event.clientY - pointerPosition.y) * scale / PREVIEW_SIZE);
    pointerPosition = { x: event.clientX, y: event.clientY };
    drawPreview();
    scheduleSave();
  });
  preview.addEventListener("pointerup", () => { pointerPosition = null; });
  preview.addEventListener("pointercancel", () => { pointerPosition = null; });
  preview.addEventListener("wheel", (event) => {
    if (!avatar) return;
    event.preventDefault();
    zoomInput.value = String(Math.max(1, Math.min(3, avatar.zoom + (event.deltaY < 0 ? 0.1 : -0.1))));
    updateZoom();
  }, { passive: false });

  drawPreview();
  restoreSavedAvatar();
  return {
    getAvatar: () => avatar,
    openFilePicker: () => fileInput.click(),
    removePhoto,
  };
}

function clampOffset(value) {
  return Math.max(-1, Math.min(1, value));
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decoding failed."));
    };
    image.src = url;
  });
}

export function drawCircularImage(context, avatar, x, y, size) {
  const image = avatar.image;
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * avatar.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const drawX = x + (size - width) * (avatar.offsetX + 1) / 2;
  const drawY = y + (size - height) * (avatar.offsetY + 1) / 2;

  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, drawX, drawY, width, height);
  context.restore();
}

function drawDefaultHead(context) {
  context.fillStyle = "#fff4d8";
  context.beginPath();
  context.arc(96, 96, 92, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffd1a0";
  context.fillRect(61, 43, 70, 65);
  context.fillRect(52, 65, 12, 27);
  context.fillRect(128, 62, 12, 28);
  context.fillStyle = "#253853";
  context.fillRect(73, 62, 13, 17);
  context.fillRect(108, 62, 13, 17);
  context.fillStyle = "#fff";
  context.fillRect(78, 64, 5, 6);
  context.fillRect(113, 64, 5, 6);
  context.fillStyle = "#f28a50";
  context.fillRect(47, 105, 98, 65);
  context.fillRect(60, 94, 72, 20);
  context.fillStyle = "#f8c94e";
  context.fillRect(84, 125, 24, 17);
  context.fillStyle = "#38577b";
  context.fillRect(65, 159, 62, 19);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open photo storage."));
  });
}

async function getStoredAvatar() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(AVATAR_KEY);
    request.onsuccess = () => { database.close(); resolve(request.result || null); };
    request.onerror = () => { database.close(); reject(request.error || new Error("Could not read saved photo.")); };
  });
}

async function putStoredAvatar(value) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, AVATAR_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("Could not save photo.")); };
  });
}

async function deleteStoredAvatar() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(AVATAR_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("Could not remove saved photo.")); };
  });
}
