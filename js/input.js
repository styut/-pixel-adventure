const keys = new Set();
const blockedKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

export function createInput(onPause, onRestart) {
  window.addEventListener("keydown", (event) => {
    if (blockedKeys.has(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === "KeyP" || event.code === "Escape") onPause();
    if (event.code === "KeyR") onRestart();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());

  return {
    get left() { return keys.has("ArrowLeft") || keys.has("KeyA"); },
    get right() { return keys.has("ArrowRight") || keys.has("KeyD"); },
    get jump() { return keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW"); },
    get down() { return keys.has("ArrowDown") || keys.has("KeyS"); },
  };
}
