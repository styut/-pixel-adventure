import { createInput } from "./input.js";
import { levels } from "./levels.js";
import { createPlayer, updatePlayer, drawPlayer, playerTouches } from "./player.js";
import { createEnemies, updateEnemies, drawEnemies } from "./enemies.js";
import { createCoins, drawCoins } from "./coins.js";
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
    };
    enemies = runtime.enemies;
    coins = runtime.coins;
    player = createPlayer(checkpointX, 420);
    cameraX = clamp(player.x - 180, 0, level.width - canvas.width);
  }
  gameHint.hidden = true;
}

function activateCaveArea(index, x, y) {
  const level = levels[levelIndex];
  areaIndex = index;
  activeArea = level.areas[index];
  if (!areaStates.has(index)) areaStates.set(index, createCaveRuntime(activeArea));
  runtime = areaStates.get(index);
  enemies = [];
  coins = runtime.coins;
  player = createPlayer(x, y);
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
    showScreen("GAME OVER", "GAME OVER", `You collected ${score} points. Every great explorer gets another try!`, [
      ["Try again", "play"], ["Main menu", "menu"],
    ]);
    return;
  }
  if (levels[levelIndex].underground) {
    activateCaveArea(caveCheckpoint.areaIndex, caveCheckpoint.x, caveCheckpoint.y);
  } else {
    player = createPlayer(checkpointX, 420);
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
    showScreen("YOU DID IT!", "YOU DID<br><span>IT!</span>", `All three worlds explored. You finished with ${score} points. What an adventure!`, [
      ["Play again", "play"], ["Main menu", "menu"],
    ]);
  } else {
    checkpointX = 55;
    checkpointReached = false;
    setupLevel(levelIndex + 1);
    updateCaveAmbience(levelIndex === 1);
    updateHud();
  }
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    showScreen("TAKE A BREATHER", "PAUSED", "Your adventure is right where you left it.", [
      ["Keep going", "resume"], ["Restart level", "restart"], ["Main menu", "menu"],
    ]);
  } else if (state === "paused") {
    state = "playing";
    hideScreen();
  }
}

function showInstructions() {
  screen.hidden = false;
  screenCard.classList.remove("welcome-card");
  welcomeTools.hidden = true;
  screenKicker.textContent = "YOUR ADVENTURE, YOUR RULES";
  screenTitle.innerHTML = "HOW TO<br><span>PLAY</span>";
  screenCopy.innerHTML = '<div class="instructions"><strong>Move:</strong> ← → or A / D<br><strong>Jump:</strong> Space, ↑ or W<br><strong>Enter tunnels:</strong> ↓ when prompted<br><strong>Pause:</strong> P or Escape &nbsp; <strong>Restart:</strong> R<br><br>Collect coins, bounce on friendly critters, and look out for fire toads, falling rocks, lava and crumbling ledges. Reach glowing flags to save a checkpoint.</div>';
  screenActions.innerHTML = '<button class="primary-button" data-action="play">Got it — let’s go <span>→</span></button><button class="secondary-button" data-action="menu">Back</button>';
  screenFoot.textContent = "THREE WORLDS • THREE LIVES • LOTS OF COINS";
}

function showScreen(kicker, title, copy, actions) {
  screen.hidden = false;
  screenCard.classList.remove("welcome-card");
  welcomeTools.hidden = true;
  screenKicker.textContent = kicker;
  screenTitle.innerHTML = title;
  screenCopy.textContent = copy;
  screenActions.innerHTML = actions.map(([label, action], index) =>
    `<button class="${index === 0 ? "primary-button" : "secondary-button"}" data-action="${action}">${label}${index === 0 ? " <span>→</span>" : ""}</button>`).join("");
  screenFoot.textContent = "PAUSE ANYTIME WITH P OR ESC";
}

function showMenu() {
  state = "menu";
  hud.hidden = true;
  gameHint.hidden = true;
  updateCaveAmbience(false);
  screen.hidden = false;
  screenCard.classList.add("welcome-card");
  welcomeTools.hidden = false;
  screenKicker.textContent = "A SUNNY LITTLE PLATFORMER";
  screenTitle.innerHTML = "PIXEL<br><span>ADVENTURE</span>";
  screenCopy.textContent = "Become the hero of your own adventure!";
  const removeButton = avatarCustomization.getAvatar()
    ? '<button class="secondary-button remove-photo-button" data-action="remove-photo">Remove photo</button>'
    : "";
  screenActions.innerHTML = `<button class="primary-button" data-action="play">Play Game <span>→</span></button><button class="secondary-button" data-action="upload">Upload Your Face</button><button class="secondary-button" data-action="change-photo">Change Photo</button>${removeButton}<button class="text-button" data-action="instructions">How to play</button>`;
  screenFoot.textContent = "YOUR PHOTO STAYS RIGHT HERE ON YOUR DEVICE";
}

function hideScreen() { screen.hidden = true; }

screen.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "play") startGame();
  else if (action === "upload" || action === "change-photo") avatarCustomization.openFilePicker();
  else if (action === "remove-photo") {
    avatarCustomization.removePhoto();
    showMenu();
  }
  else if (action === "instructions") showInstructions();
  else if (action === "resume") { state = "playing"; hideScreen(); }
  else if (action === "restart") restartLevel();
  else if (action === "menu") showMenu();
});

pauseButton.addEventListener("click", togglePause);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.innerHTML = `${soundEnabled ? "♫" : "♪"} <span>Sound ${soundEnabled ? "on" : "off"}</span>`;
  updateCaveAmbience(levelIndex === 1 && state === "playing");
  if (soundEnabled) playTone(520, 0.08);
});

function updateHud() {
  document.querySelector("#level-value").textContent = `${levelIndex + 1} / ${levels.length}`;
  document.querySelector("#coin-value").textContent = levelCoins;
  document.querySelector("#score-value").textContent = score;
  document.querySelector("#lives-value").textContent = lifeCount;
  roomName.textContent = levels[levelIndex].underground ? activeArea.name : "";
}

function update(dt) {
  if (state !== "playing") return;
  screenShake = Math.max(0, screenShake - dt);
  portalCooldown = Math.max(0, portalCooldown - dt);
  if (tunnelTransition) {
    updateTunnelTransition(dt);
    return;
  }

  if (levels[levelIndex].underground) {
    updateCave(dt);
    return;
  }

  updatePlayer(player, input, dt, runtime.platforms);
  updateEnemies(enemies, dt, runtime.platforms);

  for (const coin of coins) {
    if (!coin.collected && playerTouches(player, coin, 3)) {
      coin.collected = true;
      levelCoins++;
      score += 10;
      playTone(820, 0.06);
    }
  }
  for (const enemy of enemies) {
    if (!enemy.alive || !playerTouches(player, enemy, 4)) continue;
    const previousBottom = player.y + player.h - player.vy * dt;
    if (player.vy > 40 && previousBottom <= enemy.y + 12) {
      enemy.alive = false;
      player.vy = -350;
      score += 100;
      playTone(390, 0.09);
    } else {
      loseLife();
      break;
    }
  }

  if (!checkpointReached && player.x >= activeArea.width * 0.5) {
    checkpointReached = true;
    checkpointX = Math.floor(activeArea.width * 0.5);
  }
  if (player.y > canvas.height + 70) loseLife();
  if (player.x >= activeArea.width - 92) completeLevel();
  cameraX += (clamp(player.x - canvas.width * 0.36, 0, activeArea.width - canvas.width) - cameraX) * Math.min(1, dt * 5);
  updateHud();
}

function updateCave(dt) {
  const events = updateCaveRuntime(runtime, activeArea, player, dt);
  updatePlayer(player, input, dt, runtime.platforms);

  let shouldLoseLife = events.damage;
  for (const toad of runtime.toads) {
    if (canStompToad(player, toad, dt)) {
      score += 150;
      player.vy = -360;
      playTone(330, 0.1);
    } else if (toad.alive && playerTouches(player, toad, 4) && player.invulnerable <= 0) {
      shouldLoseLife = true;
    }
  }
  for (const coin of coins) {
    if (!coin.collected && playerTouches(player, coin, 3)) {
      coin.collected = true;
      levelCoins++;
      score += 10;
      playTone(820, 0.06);
    }
  }

  if (events.shot) playTone(175, 0.16, "sawtooth");
  if (events.trap) {
    screenShake = Math.max(screenShake, 0.12);
    playTone(110, 0.12, "triangle");
  }
  screenShake = Math.max(screenShake, events.shake);
  if (shouldLoseLife) loseLife();
  if (player.y > canvas.height + 65) loseLife();
  saveCaveCheckpoint();

  const tunnel = findNearbyTunnel(activeArea, player);
  gameHint.hidden = !tunnel;
  if (tunnel) {
    gameHint.textContent = `Press ↓ to enter · ${tunnel.label}`;
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
    activateCaveArea(destination.area, destination.x, destination.y);
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
    console.warn("Audio is unavailable in this browser.", error);
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
    console.warn("Cave ambience is unavailable in this browser.", error);
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
