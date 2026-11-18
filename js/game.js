import { createInput } from "./input.js";
import { levels } from "./levels.js";
import { createPlayer, updatePlayer, drawPlayer, playerTouches, setPlayerGrowth } from "./player.js";
import { createEnemies, updateEnemies, drawEnemies } from "./enemies.js";
import { createCoins, drawCoins } from "./coins.js";
import {
  POWERUPS,
  createPlayerFireball,
  createPowerups,
  createSurpriseBoxes,
  drawPlayerFireballs,
  drawPowerupIcon,
  drawPowerups,
  drawSurpriseBoxes,
  releaseSurpriseReward,
  resetLevelSurpriseRewards,
  updatePlayerFireballs,
  updateWorldItems,
} from "./powerups.js";
import { createAvatarCustomization } from "./avatar.js";
import {
  canStompToad,
  createCaveRuntime,
  drawCaveDarkness,
  drawCaveRoom,
  findNearbyTunnel,
  updateCaveRuntime,
} from "./cave.js";

const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const screen = document.querySelector("#screen");
const screenTitle = document.querySelector("#screen-title");
const screenCopy = document.querySelector("#screen-copy");
const screenKicker = document.querySelector("#screen-kicker");
const screenActions = document.querySelector("#screen-actions");
const screenCard = document.querySelector(".screen-card");
const welcomeTools = document.querySelector("#welcome-tools");
const screenFoot = document.querySelector("#screen-foot");
const hud = document.querySelector("#hud");
const soundButton = document.querySelector("#sound-button");
const powerupToast = document.querySelector("#powerup-toast");
const powerupToastIcon = document.querySelector("#powerup-toast-icon");
const powerupToastName = document.querySelector("#powerup-toast-name");
const powerupToastDescription = document.querySelector("#powerup-toast-description");
const powerupToastKey = document.querySelector("#powerup-toast-key");
const bestScoreValue = document.querySelector("#best-score-value");
const fullscreenButton = document.querySelector("#fullscreen-button");
const fullscreenLabel = document.querySelector("#fullscreen-label");
const fullscreenStatus = document.querySelector("#fullscreen-status");
const gameShell = document.querySelector(".game-shell");
const pauseButton = document.querySelector("#pause-button");
const gameHint = document.querySelector("#game-hint");
const roomName = document.querySelector("#room-name");
const avatarCustomization = createAvatarCustomization({
  fileInput: document.querySelector("#face-upload"),
  preview: document.querySelector("#avatar-preview"),
  zoomInput: document.querySelector("#avatar-zoom"),
  zoomValue: document.querySelector("#zoom-value"),
  saveCheckbox: document.querySelector("#save-photo"),
  status: document.querySelector("#avatar-status"),
  onAvatarChange: () => { if (state === "menu") showMenu(); },
});

let state = "menu";
let levelIndex = 0;
let areaIndex = 0;
let score = 0;
let lifeCount = 3;
let levelCoins = 0;
let player;
let enemies = [];
let coins = [];
let activeArea;
let runtime;
let areaStates = new Map();
let tunnelTransition = null;
let portalCooldown = 0;
let caveCheckpoint = { areaIndex: 0, x: 55, y: 436 };
let cameraX = 0;
let elapsed = 0;
let lastTime = 0;
let audioContext;
let caveDrone;
let caveDroneGain;
let screenShake = 0;
let soundEnabled = true;
let checkpointX = 55;
let checkpointReached = false;
let bestScore = loadBestScore();
let seenPowerupIds = loadSeenPowerups();
let powerupToastTimer;
let skipInstructionsCheckbox;

const input = createInput(togglePause, restartLevel);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function setupLevel(index) {
  levelIndex = index;
  const level = levels[levelIndex];
  tunnelTransition = null;
  portalCooldown = 0;
  levelCoins = 0;
  if (level.underground) {
    areaStates = new Map();
    caveCheckpoint = { areaIndex: level.startArea, x: 55, y: 436 };
    activateCaveArea(level.startArea, 55, 436);
  } else {
    activeArea = level;
    runtime = {
      platforms: level.platforms,
      enemies: createEnemies(level.enemies),
      coins: createCoins(level.coins),
      powerups: createPowerups(level.powerups),
      boxes: createSurpriseBoxes(level.boxes),
      playerFireballs: [],
    };
    enemies = runtime.enemies;
    coins = runtime.coins;
    player = createPlayer(checkpointX, 436);
    player.grounded = true;
    cameraX = clamp(player.x - 180, 0, level.width - canvas.width);
  }
  gameHint.hidden = true;
}

function activateCaveArea(index, x, y, preservePowerups = false) {
  const level = levels[levelIndex];
  const previousPlayer = player;
  areaIndex = index;
  activeArea = level.areas[index];
  if (!areaStates.has(index)) areaStates.set(index, createCaveRuntime(activeArea));
  runtime = areaStates.get(index);
  enemies = [];
  coins = runtime.coins;
  player = createPlayer(x, y);
  player.grounded = true;
  if (preservePowerups && previousPlayer) {
    player.firePower = previousPlayer.firePower;
    player.starTimer = previousPlayer.starTimer;
    player.fireCooldown = previousPlayer.fireCooldown;
    player.invulnerable = previousPlayer.invulnerable;
    setPlayerGrowth(player, previousPlayer.grown, [...runtime.platforms, ...runtime.boxes]);
  }
  cameraX = clamp(player.x - 180, 0, activeArea.width - canvas.width);
  roomName.textContent = activeArea.name;
  gameHint.hidden = true;
}

function startGame() {
  score = 0;
  lifeCount = 3;
  checkpointX = 55;
  checkpointReached = false;
  setupLevel(0);
  state = "playing";
  syncPauseButton();
  dismissPowerupToast();
  hud.hidden = false;
  hideScreen();
  updateHud();
  updateCaveAmbience(false);
  playTone(520, 0.1);
}

function restartLevel() {
  if (state !== "playing" && state !== "paused") return;
  setupLevel(levelIndex);
  state = "playing";
  syncPauseButton();
  hideScreen();
  updateCaveAmbience(levelIndex === 1);
}

function loseLife() {
  if (player.invulnerable > 0) return;
  lifeCount--;
  playTone(150, 0.22, "sawtooth");
  if (lifeCount <= 0) {
    state = "gameover";
    hud.hidden = true;
    showScreen("המשחק נגמר", "המשחק נגמר", `אספתם ${score} נקודות. אפשר לצאת להרפתקה נוספת!`, [
      ["ניסיון נוסף", "play"], ["לתפריט הראשי", "menu"],
    ]);
    return;
  }
  resetLevelSurpriseRewards(levels[levelIndex], areaStates, runtime);
  if (levels[levelIndex].underground) {
    activateCaveArea(caveCheckpoint.areaIndex, caveCheckpoint.x, caveCheckpoint.y);
  } else {
    player = createPlayer(checkpointX, 436);
    player.grounded = true;
  }
  player.invulnerable = 1.8;
  cameraX = clamp(player.x - 180, 0, activeArea.width - canvas.width);
  updateHud();
}

function completeLevel() {
  playTone(740, 0.12);
  if (levelIndex === levels.length - 1) {
    state = "victory";
    hud.hidden = true;
    showScreen("ניצחתם!", "ניצחתם!", `השלמתם את כל שלושת העולמות עם ${score} נקודות. איזו הרפתקה נהדרת!`, [
      ["משחק חדש", "play"], ["לתפריט הראשי", "menu"],
    ]);
  } else {
    checkpointX = 55;
    checkpointReached = false;
    const firePower = player.firePower;
    setupLevel(levelIndex + 1);
    player.firePower = firePower;
    updateCaveAmbience(levelIndex === 1);
    updateHud();
  }
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    showScreen("עוצרים לרגע", "המשחק בהשהיה", "ההרפתקה מחכה בדיוק במקום שבו עצרתם.", [
      ["המשך משחק", "resume"], ["התחלת השלב מחדש", "restart"], ["לתפריט הראשי", "menu"],
    ]);
    syncPauseButton();
  } else if (state === "paused") {
    state = "playing";
    hideScreen();
    syncPauseButton();
  }
}

function showInstructions() {
  screen.hidden = false;
  screen.classList.add("instructions-screen");
  powerupToast.hidden = true;
  screenCard.classList.remove("welcome-card");
  screenCard.classList.add("instructions-card");
  welcomeTools.hidden = true;
  screenKicker.textContent = "ההרפתקה שלכם, הכללים שלכם";
  screenTitle.innerHTML = "איך<br><span>משחקים?</span>";
  screenCopy.innerHTML = buildInstructionsMarkup();
  for (const icon of screenCopy.querySelectorAll("[data-collectible]")) {
    drawPowerupIcon(icon.getContext("2d"), icon.dataset.collectible, 0, 0, icon.width, elapsed);
  }
  skipInstructionsCheckbox = document.querySelector("#skip-instructions");
  skipInstructionsCheckbox.checked = readBooleanPreference("pixel-adventure-skip-instructions");
  screenActions.innerHTML = '<button class="primary-button" data-action="begin-game">הבנתי, בואו נשחק! <span>←</span></button><button class="secondary-button" data-action="menu">חזרה לתפריט</button>';
  screenFoot.textContent = "שלושה עולמות · שלושה חיים · המון מטבעות";
}

function requestStartGame() {
  if (readBooleanPreference("pixel-adventure-skip-instructions")) startGame();
  else showInstructions();
}

function beginGameFromInstructions() {
  if (skipInstructionsCheckbox?.checked) {
    writeLocalPreference("pixel-adventure-skip-instructions", "true");
  } else {
    removeLocalPreference("pixel-adventure-skip-instructions");
  }
  startGame();
}

function buildInstructionsMarkup() {
  const controls = [
    ["תנועה ימינה", "→ / D"],
    ["תנועה שמאלה", "← / A"],
    ["קפיצה", "רווח / ↑ / W"],
    ["יריית אש", "F"],
    ["כניסה למנהרות", "↓ / S"],
    ["השהיה", "P"],
    ["התחלת השלב מחדש", "R"],
  ];
  const controlCards = controls.map(([label, keys]) =>
    `<div class="instruction-control"><span>${label}</span><kbd>${keys}</kbd></div>`).join("");
  const collectibleCards = POWERUPS.map((item) =>
    `<article class="powerup-card"><canvas class="powerup-icon" width="56" height="56" data-collectible="${item.id}" aria-label="איור: ${item.name}"></canvas><div><strong>${item.name}</strong><p>${item.description}</p></div></article>`).join("");

  return `<div class="instructions-panel">
    <div class="instruction-column">
      <section class="instruction-section"><h2>איך שולטים במשחק?</h2><div class="instruction-controls">${controlCards}</div></section>
      <section class="instruction-section"><h2>המטרה והסכנות</h2><ul class="instruction-objectives">
        <li>אספו מטבעות, צברו נקודות ושברו את השיא האישי.</li>
        <li>קפצו על אויבים מלמעלה כדי להביס אותם; הימנעו ממגע מהצד.</li>
        <li>קפצו מעל כדורי אש, לבה, מלכודות וסלעים נופלים.</li>
        <li>התקדמו עד לנקודות הביקורת; אם תאבדו חיים, תחזרו לנקודה האחרונה. הגיעו לדגל הסיום כדי להתקדם.</li>
        <li>במערה לחצו על <kbd>↓</kbd> ליד פתח כדי להיכנס למנהרה.</li>
      </ul></section>
    </div>
    <section class="instruction-section"><h2>פריטים וכוחות</h2><div class="powerup-grid">${collectibleCards}</div></section>
  </div>
  <label class="skip-intro"><input id="skip-instructions" type="checkbox"><span>אל תציג שוב בכניסה הבאה</span></label>`;
}

function showScreen(kicker, title, copy, actions) {
  screen.hidden = false;
  screen.classList.remove("instructions-screen");
  powerupToast.hidden = true;
  screenCard.classList.remove("welcome-card");
  screenCard.classList.remove("instructions-card");
  welcomeTools.hidden = true;
  screenKicker.textContent = kicker;
  screenTitle.innerHTML = title;
  screenCopy.textContent = copy;
  screenActions.innerHTML = actions.map(([label, action], index) =>
    `<button class="${index === 0 ? "primary-button" : "secondary-button"}" data-action="${action}">${label}${index === 0 ? " <span>←</span>" : ""}</button>`).join("");
  screenFoot.textContent = "אפשר להשהות בכל עת בלחיצה על P או Escape";
}

function showMenu() {
  state = "menu";
  hud.hidden = true;
  gameHint.hidden = true;
  powerupToast.hidden = true;
  updateCaveAmbience(false);
  screen.hidden = false;
  screen.classList.remove("instructions-screen");
  screenCard.classList.add("welcome-card");
  screenCard.classList.remove("instructions-card");
  welcomeTools.hidden = false;
  screenKicker.textContent = "משחק פלטפורמות צבעוני";
  screenTitle.innerHTML = "הרפתקת<br><span>הפיקסלים</span>";
  screenCopy.textContent = "הפכו לגיבורים בהרפתקה משלכם!";
  const removeButton = avatarCustomization.getAvatar()
    ? '<button class="secondary-button remove-photo-button" data-action="remove-photo">הסרת התמונה</button>'
    : "";
  screenActions.innerHTML = `<button class="primary-button" data-action="play">התחלת המשחק <span>←</span></button><button class="secondary-button" data-action="upload">העלאת תמונת פנים</button><button class="secondary-button" data-action="change-photo">החלפת תמונה</button>${removeButton}<button class="text-button" data-action="instructions">איך משחקים?</button>`;
  screenFoot.textContent = "התמונה נשארת כאן, במכשיר שלכם";
}

function hideScreen() { screen.hidden = true; }

screen.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "play") requestStartGame();
  else if (action === "begin-game") beginGameFromInstructions();
  else if (action === "upload" || action === "change-photo") avatarCustomization.openFilePicker();
  else if (action === "remove-photo") {
    avatarCustomization.removePhoto();
    showMenu();
  }
  else if (action === "instructions") showInstructions();
  else if (action === "resume") { state = "playing"; hideScreen(); syncPauseButton(); }
  else if (action === "restart") restartLevel();
  else if (action === "menu") showMenu();
});

pauseButton.addEventListener("click", togglePause);
document.querySelector("#powerup-toast-dismiss").addEventListener("click", dismissPowerupToast);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  const soundLabel = soundEnabled ? "צליל פעיל" : "צליל כבוי";
  soundButton.innerHTML = `<span aria-hidden="true">${soundEnabled ? "♫" : "♪"}</span><span>${soundLabel}</span>`;
  soundButton.setAttribute("aria-label", soundEnabled ? "כיבוי הצליל" : "הפעלת הצליל");
  soundButton.title = soundLabel;
  updateCaveAmbience(levelIndex === 1 && state === "playing");
  if (soundEnabled) playTone(520, 0.08);
});

fullscreenButton.addEventListener("click", async () => {
  setFullscreenStatus("");
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (document.fullscreenEnabled && gameShell.requestFullscreen) {
      await gameShell.requestFullscreen();
    } else {
      setFullscreenStatus("הדפדפן הזה אינו תומך במצב מסך מלא.");
    }
  } catch (error) {
    setFullscreenStatus("לא ניתן להפעיל מסך מלא. אפשר לנסות שוב.");
    console.error("הפעלת מסך מלא נכשלה.", error);
  }
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === gameShell;
  const label = isFullscreen ? "יציאה ממסך מלא" : "מסך מלא";
  fullscreenLabel.textContent = label;
  fullscreenButton.title = label;
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "יציאה ממסך מלא" : "הפעלת מסך מלא");
  setFullscreenStatus("");
});

document.addEventListener("keydown", (event) => {
  if (event.code !== "Escape" || !document.fullscreenElement) return;
  event.preventDefault();
  document.exitFullscreen().catch((error) => {
    setFullscreenStatus("לא ניתן לצאת ממצב מסך מלא.");
    console.error("יציאה ממסך מלא נכשלה.", error);
  });
});

function setFullscreenStatus(message) {
  fullscreenStatus.textContent = message;
  fullscreenStatus.classList.toggle("visually-hidden", !message);
}

function syncPauseButton() {
  const isPaused = state === "paused";
  pauseButton.setAttribute("aria-label", isPaused ? "המשך המשחק" : "השהיית המשחק");
  pauseButton.title = isPaused ? "המשך משחק" : "השהיה";
}

function updatePowerupTimers(dt) {
  player.starTimer = Math.max(0, player.starTimer - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
}

function collectRoomPowerups() {
  for (const item of runtime.powerups || []) {
    if (item.collected || (item.type === "heart" && lifeCount >= 5) || !playerTouches(player, item, 2)) continue;
    if (item.type === "growth" &&
        !setPlayerGrowth(player, true, [...runtime.platforms, ...runtime.boxes])) continue;
    item.collected = true;
    applyPowerup(item.type);
  }
}

function applyPowerup(type) {
  if (type === "growth" &&
      !setPlayerGrowth(player, true, [...runtime.platforms, ...runtime.boxes])) return false;
  else if (type === "fire") player.firePower = true;
  else if (type === "star") player.starTimer = 8;
  else if (type === "heart") lifeCount = Math.min(5, lifeCount + 1);
  notifyFirstPowerup(type);
  updateHud();
  playTone(type === "star" ? 940 : 720, 0.12, "triangle");
}

function takePlayerHit(fromEnemy = false) {
  if (player.invulnerable > 0 || player.starTimer > 0) return false;
  if (player.firePower) player.firePower = false;
  if (fromEnemy && player.grown) {
    setPlayerGrowth(player, false);
    player.invulnerable = 1.15;
    return true;
  }
  loseLife();
  return true;
}

function tryShootFireball() {
  if (!input.fire || !player.firePower || player.fireCooldown > 0) return;
  runtime.playerFireballs.push(createPlayerFireball(player));
  player.fireCooldown = 0.38;
  playTone(520, 0.07, "square");
}

function updatePlayerProjectiles(dt) {
  const targets = [...enemies, ...(runtime.toads || [])];
  const defeated = updatePlayerFireballs(runtime.playerFireballs, dt, activeArea.width, runtime.platforms, targets);
  if (defeated) {
    addScore(defeated * 100);
    playTone(390, 0.09);
  }
}

function openSurpriseBox(box) {
  if (box.opened) return;
  box.opened = true;
  box.bumpTimer = 0.3;
  releaseSurpriseReward(runtime, box);
  playTone(320, 0.1, "square");
}

function notifyFirstPowerup(type) {
  if (seenPowerupIds.has(type)) return;
  const item = POWERUPS.find((powerup) => powerup.id === type);
  if (!item) return;
  seenPowerupIds.add(type);
  writeLocalPreference("pixel-adventure-seen-powerups", JSON.stringify([...seenPowerupIds]));
  showToast(item.id, item.name, item.notification || item.description, item.key);
}

function showToast(type, name, description, key = "") {
  dismissPowerupToast();
  powerupToastName.textContent = name;
  powerupToastDescription.textContent = description;
  powerupToastKey.innerHTML = key ? `מקש <kbd>${key}</kbd>` : "";
  powerupToastKey.hidden = !key;
  const toastContext = powerupToastIcon.getContext("2d");
  toastContext.clearRect(0, 0, powerupToastIcon.width, powerupToastIcon.height);
  drawPowerupIcon(toastContext, type, 0, 0, powerupToastIcon.width, elapsed);
  powerupToast.hidden = false;
  powerupToastTimer = setTimeout(dismissPowerupToast, 7000);
}

function dismissPowerupToast() {
  clearTimeout(powerupToastTimer);
  powerupToast.hidden = true;
}

function addScore(points) {
  score += points;
  if (score > bestScore) {
    bestScore = score;
    writeLocalPreference("pixel-adventure-best-score", String(bestScore));
  }
}

function loadBestScore() {
  const value = Number(readLocalPreference("pixel-adventure-best-score"));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function loadSeenPowerups() {
  const raw = readLocalPreference("pixel-adventure-seen-powerups");
  if (!raw) return new Set();
  try {
    const stored = JSON.parse(raw);
    return new Set(Array.isArray(stored) ? stored.filter((id) => POWERUPS.some((item) => item.id === id)) : []);
  } catch (error) {
    console.error("קריאת העדפות הודעות הכוח נכשלה.", error);
    return new Set();
  }
}

function readBooleanPreference(key) {
  return readLocalPreference(key) === "true";
}

function readLocalPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    setFullscreenStatus("האחסון המקומי אינו זמין בדפדפן הזה.");
    console.error("קריאת ההעדפה המקומית נכשלה.", error);
    return null;
  }
}

function writeLocalPreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    setFullscreenStatus("לא ניתן לשמור את ההעדפה במכשיר הזה.");
    console.error("שמירת ההעדפה המקומית נכשלה.", error);
  }
}

function removeLocalPreference(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    setFullscreenStatus("לא ניתן לעדכן את ההעדפה במכשיר הזה.");
    console.error("עדכון ההעדפה המקומית נכשל.", error);
  }
}

function updateHud() {
  document.querySelector("#level-value").textContent = `${levelIndex + 1} / ${levels.length}`;
  document.querySelector("#coin-value").textContent = levelCoins;
  document.querySelector("#score-value").textContent = score;
  bestScoreValue.textContent = bestScore;
  document.querySelector("#lives-value").textContent = lifeCount;
  roomName.textContent = levels[levelIndex].underground ? activeArea.name : "";
}

function update(dt) {
  if (state !== "playing") return;
  screenShake = Math.max(0, screenShake - dt);
  portalCooldown = Math.max(0, portalCooldown - dt);
  updatePowerupTimers(dt);
  if (tunnelTransition) {
    updateTunnelTransition(dt);
    return;
  }

  if (levels[levelIndex].underground) {
    updateCave(dt);
    return;
  }

  const hitBox = updatePlayer(player, input, dt, runtime.platforms, runtime.boxes);
  if (hitBox) openSurpriseBox(hitBox);
  tryShootFireball();
  updateEnemies(enemies, dt, runtime.platforms);
  updateWorldItems(runtime, dt);
  updatePlayerProjectiles(dt);
  collectRoomPowerups();

  for (const coin of coins) {
    if (!coin.collected && playerTouches(player, coin, 3)) {
      coin.collected = true;
      levelCoins++;
      addScore(10);
      playTone(820, 0.06);
    }
  }
  for (const enemy of enemies) {
    if (!enemy.alive || !playerTouches(player, enemy, 4)) continue;
    const previousBottom = player.y + player.h - player.vy * dt;
    if (player.vy > 40 && previousBottom <= enemy.y + 12) {
      enemy.alive = false;
      player.vy = -350;
      addScore(100);
      playTone(390, 0.09);
    } else {
      takePlayerHit(true);
      break;
    }
  }

  if (!checkpointReached && player.x >= activeArea.width * 0.5) {
    checkpointReached = true;
    checkpointX = Math.floor(activeArea.width * 0.5);
  }
  if (player.y > canvas.height + 70) takePlayerHit();
  if (player.x >= activeArea.width - 92) completeLevel();
  cameraX += (clamp(player.x - canvas.width * 0.36, 0, activeArea.width - canvas.width) - cameraX) * Math.min(1, dt * 5);
  updateHud();
}

function updateCave(dt) {
  const events = updateCaveRuntime(runtime, activeArea, player, dt);
  const hitBox = updatePlayer(player, input, dt, runtime.platforms, runtime.boxes);
  if (hitBox) openSurpriseBox(hitBox);
  tryShootFireball();
  updateWorldItems(runtime, dt);
  updatePlayerProjectiles(dt);
  collectRoomPowerups();

  let shouldLoseLife = events.damage;
  let enemyHit = false;
  for (const toad of runtime.toads) {
    if (canStompToad(player, toad, dt)) {
      addScore(150);
      player.vy = -360;
      playTone(330, 0.1);
    } else if (toad.alive && playerTouches(player, toad, 4) && player.invulnerable <= 0) {
      shouldLoseLife = true;
      enemyHit = true;
    }
  }
  for (const coin of coins) {
    if (!coin.collected && playerTouches(player, coin, 3)) {
      coin.collected = true;
      levelCoins++;
      addScore(10);
      playTone(820, 0.06);
    }
  }

  if (events.shot) playTone(175, 0.16, "sawtooth");
  if (events.trap) {
    screenShake = Math.max(screenShake, 0.12);
    playTone(110, 0.12, "triangle");
  }
  screenShake = Math.max(screenShake, events.shake);
  if (shouldLoseLife) takePlayerHit(enemyHit);
  if (player.y > canvas.height + 65) takePlayerHit();
  saveCaveCheckpoint();

  const tunnel = findNearbyTunnel(activeArea, player);
  gameHint.hidden = !tunnel;
  if (tunnel) {
    gameHint.innerHTML = `לחצו <bdi>↓</bdi> כדי להיכנס · ${tunnel.label}`;
    if (input.down && portalCooldown <= 0) {
      beginTunnel(tunnel);
      updateHud();
      return;
    }
  }

  if (activeArea.finishX && player.x >= activeArea.finishX) completeLevel();
  cameraX += (clamp(player.x - canvas.width * 0.36, 0, activeArea.width - canvas.width) - cameraX) * Math.min(1, dt * 5);
  updateHud();
}

function saveCaveCheckpoint() {
  for (const point of activeArea.checkpoints || []) {
    if (player.x + player.w / 2 >= point.x) {
      caveCheckpoint = { areaIndex, x: point.x, y: point.y };
    }
  }
}

function beginTunnel(tunnel) {
  tunnelTransition = { elapsed: 0, duration: 0.76, switched: false, destination: tunnel.destination };
  gameHint.hidden = true;
  playTone(210, 0.16, "triangle");
  setTimeout(() => playTone(330, 0.12, "sine"), 190);
}

function updateTunnelTransition(dt) {
  tunnelTransition.elapsed += dt;
  if (!tunnelTransition.switched && tunnelTransition.elapsed >= tunnelTransition.duration / 2) {
    const destination = tunnelTransition.destination;
    activateCaveArea(destination.area, destination.x, destination.y, true);
    portalCooldown = 0.9;
    tunnelTransition.switched = true;
  }
  if (tunnelTransition.elapsed >= tunnelTransition.duration) {
    tunnelTransition = null;
    gameHint.hidden = true;
  }
  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#75cfff");
  sky.addColorStop(1, "#c8f2ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawClouds();
  ctx.fillStyle = "rgba(255,255,255,.32)";
  ctx.beginPath();
  ctx.arc(790, 106, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe68a";
  ctx.beginPath();
  ctx.arc(790, 106, 30, 0, Math.PI * 2);
  ctx.fill();
  drawHills("#a0e3c1", 0.16, 386, 58);
  drawHills("#72d0a6", 0.3, 425, 76);
}

function drawClouds() {
  const offset = cameraX * 0.18;
  for (let i = 0; i < 7; i++) {
    const baseX = ((i * 193 - offset) % 1250 + 1250) % 1250 - 120;
    const y = 83 + (i % 3) * 51;
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillRect(baseX + 13, y + 9, 62, 17);
    ctx.fillRect(baseX + 27, y, 34, 17);
    ctx.fillRect(baseX, y + 15, 87, 12);
  }
}

function drawHills(color, speed, baseY, height) {
  ctx.fillStyle = color;
  const offset = cameraX * speed;
  for (let i = -1; i < 5; i++) {
    const x = i * 270 - (offset % 270);
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + 125, baseY - height, x + 270, baseY);
    ctx.lineTo(x + 270, canvas.height);
    ctx.lineTo(x, canvas.height);
    ctx.fill();
  }
}

function drawPlatforms(platforms) {
  for (const platform of platforms) {
    const x = Math.round(platform.x - cameraX);
    if (x + platform.w < -5 || x > canvas.width + 5) continue;
    if (platform.type === "ground") {
      ctx.fillStyle = "#9c6246";
      ctx.fillRect(x, platform.y, platform.w, platform.h);
      ctx.fillStyle = "#61bd68";
      ctx.fillRect(x, platform.y, platform.w, 12);
      ctx.fillStyle = "#7bdd72";
      ctx.fillRect(x, platform.y, platform.w, 4);
      ctx.fillStyle = "rgba(91,53,51,.23)";
      for (let tileX = x + 12; tileX < x + platform.w; tileX += 32) ctx.fillRect(tileX, platform.y + 25, 4, 5);
    } else if (platform.type === "brick") {
      ctx.fillStyle = "#b96c51";
      ctx.fillRect(x, platform.y, platform.w, platform.h);
      ctx.fillStyle = "#e39a67";
      ctx.fillRect(x, platform.y, platform.w, 5);
      ctx.strokeStyle = "#8f5347";
      ctx.lineWidth = 2;
      for (let bx = 0; bx < platform.w; bx += 28) {
        ctx.strokeRect(x + bx, platform.y + 1, 28, 11);
        ctx.strokeRect(x + bx - 14, platform.y + 12, 28, 11);
      }
    } else {
      ctx.fillStyle = "#9b674d";
      ctx.fillRect(x, platform.y + 8, platform.w, platform.h - 8);
      ctx.fillStyle = "#62c36b";
      ctx.fillRect(x, platform.y + 2, platform.w, 10);
      ctx.fillStyle = "#8ae17a";
      ctx.fillRect(x, platform.y, platform.w, 4);
      for (let gx = x + 10; gx < x + platform.w; gx += 32) {
        ctx.fillStyle = "#70d272";
        ctx.fillRect(gx, platform.y - 4, 3, 6);
      }
    }
  }
}

function drawFinishFlag() {
  const x = Math.round(activeArea.width - 72 - cameraX);
  ctx.fillStyle = "#f4f1d8";
  ctx.fillRect(x, 337, 6, 137);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 2, 337, 2, 137);
  ctx.fillStyle = "#ee765d";
  ctx.beginPath();
  ctx.moveTo(x + 6, 340);
  ctx.lineTo(x + 53, 354);
  ctx.lineTo(x + 6, 373);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff2cc";
  ctx.fillRect(x + 11, 348, 10, 5);
  ctx.fillStyle = "#f5d276";
  ctx.fillRect(x - 7, 469, 21, 5);
}

function draw() {
  const shakeX = screenShake > 0 ? Math.sin(elapsed * 56) * screenShake * 12 : 0;
  const shakeY = screenShake > 0 ? Math.cos(elapsed * 43) * screenShake * 7 : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  if (player && state !== "menu" && levels[levelIndex].underground) {
    drawCaveRoom(ctx, activeArea, runtime, cameraX, elapsed);
    drawCoins(ctx, coins, cameraX, elapsed);
    drawCaveCheckpoints();
    if (activeArea.finishX) drawFinishFlag();
    drawCaveDarkness(ctx, activeArea, runtime, player, cameraX, elapsed);
    drawPlayer(ctx, player, cameraX, avatarCustomization.getAvatar());
  } else {
    drawBackground();
    if (player && state !== "menu") {
      drawPlatforms(activeArea.platforms);
      drawSurpriseBoxes(ctx, runtime.boxes, cameraX, elapsed);
      drawPowerups(ctx, runtime.powerups, cameraX, elapsed);
      drawPlayerFireballs(ctx, runtime.playerFireballs, cameraX, elapsed);
      drawCoins(ctx, coins, cameraX, elapsed);
      drawEnemies(ctx, enemies, cameraX);
      drawFinishFlag();
      drawPlayer(ctx, player, cameraX, avatarCustomization.getAvatar());
      ctx.fillStyle = "rgba(46,102,113,.12)";
      ctx.fillRect(0, 500, canvas.width, 40);
    } else {
      drawTitleScene();
    }
  }
  ctx.restore();
  if (state === "paused") {
    ctx.fillStyle = "rgba(29,53,77,.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (tunnelTransition) {
    const progress = clamp(tunnelTransition.elapsed / tunnelTransition.duration, 0, 1);
    const opacity = Math.min(0.94, progress < 0.5 ? progress * 1.88 : (1 - progress) * 1.88);
    ctx.fillStyle = `rgba(3,5,12,${opacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(255,172,78,${Math.max(0, opacity - 0.24)})`;
    ctx.fillRect(0, 252, canvas.width, 3);
  }
}

function drawCaveCheckpoints() {
  for (const point of activeArea.checkpoints || []) {
    const x = Math.round(point.x - cameraX);
    if (x < -20 || x > 980) continue;
    const saved = caveCheckpoint.areaIndex === areaIndex && caveCheckpoint.x === point.x;
    ctx.fillStyle = saved ? "#ffd078" : "#7f899b";
    ctx.fillRect(x, 423, 4, 51);
    ctx.fillStyle = saved ? "#ff8a4c" : "#687387";
    ctx.beginPath();
    ctx.moveTo(x + 4, 424);
    ctx.lineTo(x + 31, 432);
    ctx.lineTo(x + 4, 442);
    ctx.closePath();
    ctx.fill();
    if (saved) {
      ctx.fillStyle = "rgba(255,184,99,.75)";
      ctx.beginPath();
      ctx.arc(x + 4, 428, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTitleScene() {
  drawPlatforms([{x:0,y:474,w:960,h:100,type:"ground"}]);
  drawCoins(ctx, createCoins([[330,410],[390,370],[450,410],[720,395]]), 0, elapsed);
  drawEnemies(ctx, createEnemies([{x:680,y:448,min:650,max:750,speed:30}]), 0);
  drawPlayer(ctx, { ...createPlayer(160 + Math.sin(elapsed * 2) * 12, 430), anim: elapsed * 8, vx: 40 }, 0, avatarCustomization.getAvatar());
}

function playTone(frequency, duration, type = "sine") {
  if (!soundEnabled) return;
  try {
    audioContext = audioContext || new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.055, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn("שמע אינו זמין בדפדפן הזה.", error);
  }
}

function updateCaveAmbience(active) {
  if (!active || !soundEnabled) {
    if (caveDrone && caveDroneGain && audioContext) {
      const oldDrone = caveDrone;
      caveDroneGain.gain.cancelScheduledValues(audioContext.currentTime);
      caveDroneGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.06);
      caveDrone = null;
      caveDroneGain = null;
      setTimeout(() => {
        try { oldDrone.stop(); } catch { /* The oscillator may already have stopped. */ }
      }, 260);
    }
    return;
  }
  if (caveDrone) return;
  try {
    audioContext = audioContext || new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    oscillator.type = "sine";
    oscillator.frequency.value = 58;
    filter.type = "lowpass";
    filter.frequency.value = 130;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.016, audioContext.currentTime + 0.8);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    caveDrone = oscillator;
    caveDroneGain = gain;
  } catch (error) {
    console.warn("צלילי המערה אינם זמינים בדפדפן הזה.", error);
  }
}

function frame(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 1 / 30);
  lastTime = timestamp;
  elapsed += dt;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

showMenu();
requestAnimationFrame(frame);
