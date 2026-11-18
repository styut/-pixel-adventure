import { createCoins, drawCoins } from "./coins.js";
import { playerTouches } from "./player.js";

export const POWERUPS = [
  {
    id: "growth",
    name: "פטריית גדילה",
    description: "מגדילה את הדמות שלך! אם אויב פוגע בך, תחזור לגודל הרגיל במקום לאבד חיים.",
    notification: "הדמות שלך גדלה! פגיעת אויב תחזיר אותך לגודל הרגיל בלי לאבד חיים.",
  },
  {
    id: "fire",
    name: "פטריית אש",
    description: "נותנת לך כוח לירות כדורי אש על אויבים. לחצו על F כדי לירות. הכוח נעלם כשנפגעים.",
    notification: "לחצו על F כדי לירות כדורי אש! הכוח נעלם כשנפגעים.",
    key: "F",
  },
  {
    id: "star",
    name: "כוכב קסום",
    description: "נותן לך חסינות מפגיעות למשך 8 שניות. בזמן הזה הדמות שלך זוהרת!",
    notification: "חסינות מפגיעות למשך 8 שניות!",
  },
  {
    id: "heart",
    name: "לב חיים",
    description: "מוסיף לך חיים אחד, עד למקסימום של 5 חיים.",
    notification: "קיבלתם חיים נוספים! (עד 5 חיים)",
  },
  {
    id: "box",
    name: "קופסת הפתעה",
    description: "קפצו ופגעו בקופסה מלמטה. התגמול יעלה מעליה—געו בו כדי לאסוף אותו.",
  },
  {
    id: "coin",
    name: "מטבעות",
    description: "אספו מטבעות כדי לצבור נקודות ולשבור את השיא שלכם!",
  },
];

export function createPowerups(definitions = []) {
  return definitions.map((item, index) => ({
    ...item,
    w: 28,
    h: 28,
    phase: index * 0.9,
    collected: false,
  }));
}

export function createSurpriseBoxes(definitions = []) {
  return definitions.map((box, index) => ({
    ...box,
    id: box.id || `surprise-box-${index}`,
    reward: box.reward || "coins",
    w: 32,
    h: 32,
    opened: false,
    rewardReleased: false,
    bumpTimer: 0,
  }));
}

export function resetSurpriseRewards(runtime, definitions = []) {
  const boxIds = new Set((runtime.boxes || []).map((box) => box.id));
  for (const items of [runtime.coins || [], runtime.powerups || []]) {
    for (let index = items.length - 1; index >= 0; index--) {
      if (items[index].sourceBoxId && boxIds.has(items[index].sourceBoxId)) {
        items.splice(index, 1);
      }
    }
  }
  runtime.boxes = createSurpriseBoxes(definitions);
}

export function resetLevelSurpriseRewards(level, areaStates, runtime) {
  if (!level.underground) {
    resetSurpriseRewards(runtime, level.boxes || []);
    return;
  }
  for (let index = 0; index < level.areas.length; index++) {
    const roomRuntime = areaStates.get(index);
    if (roomRuntime) resetSurpriseRewards(roomRuntime, level.areas[index].boxes || []);
  }
}

export function releaseSurpriseReward(runtime, box) {
  if (!box.opened || box.rewardReleased) return;
  box.rewardReleased = true;

  if (box.reward === "coins") {
    const center = box.x + box.w / 2;
    const coins = createCoins([
      [center - 24, box.y - 23],
      [center - 9, box.y - 34],
      [center + 6, box.y - 23],
    ]);
    for (const coin of coins) {
      coin.startX = center - coin.w / 2;
      coin.startY = box.y + 5;
      coin.targetX = coin.x;
      coin.targetY = coin.y;
      coin.x = coin.startX;
      coin.y = coin.startY;
      coin.sourceBoxId = box.id;
      coin.emergeTime = 0;
      coin.emergeDuration = 0.42;
      coin.emerging = true;
    }
    runtime.coins.push(...coins);
    return;
  }

  const [reward] = createPowerups([{
    x: box.x + (box.w - 28) / 2,
    y: box.y + 4,
    type: box.reward,
    sourceBoxId: box.id,
  }]);
  reward.startX = reward.x;
  reward.startY = reward.y;
  reward.targetX = reward.x;
  reward.targetY = box.y - reward.h - 6;
  reward.emergeTime = 0;
  reward.emergeDuration = 0.42;
  reward.emerging = true;
  runtime.powerups.push(reward);
}

export function createPlayerFireball(player) {
  const direction = player.facing;
  return {
    x: direction > 0 ? player.x + player.w : player.x - 16,
    y: player.y + player.h * 0.42,
    w: 16,
    h: 14,
    vx: direction * 390,
    vy: -45,
    gravity: 165,
    life: 2.2,
    anim: 0,
  };
}

export function updateWorldItems(runtime, dt) {
  for (const item of runtime.powerups || []) {
    item.phase += dt * 4;
    if (item.emerging) updateEmergingItem(item, dt);
  }
  for (const coin of runtime.coins || []) {
    if (coin.emerging) updateEmergingItem(coin, dt);
  }
  for (const box of runtime.boxes || []) box.bumpTimer = Math.max(0, box.bumpTimer - dt);
}

function updateEmergingItem(item, dt) {
  item.emergeTime = Math.min(item.emergeDuration, item.emergeTime + dt);
  const progress = item.emergeTime / item.emergeDuration;
  const eased = 1 - (1 - progress) ** 3;
  item.x = item.startX + (item.targetX - item.startX) * eased;
  item.y = item.startY + (item.targetY - item.startY) * eased;
  if (progress === 1) item.emerging = false;
}

export function updatePlayerFireballs(projectiles, dt, roomWidth, platforms, targets) {
  let defeated = 0;
  for (const fireball of projectiles) {
    fireball.x += fireball.vx * dt;
    fireball.y += fireball.vy * dt;
    fireball.vy += fireball.gravity * dt;
    fireball.life -= dt;
    fireball.anim += dt * 16;

    const target = targets.find((enemy) => enemy.alive && playerTouches(fireball, enemy, 2));
    if (target) {
      target.alive = false;
      fireball.life = 0;
      defeated++;
      continue;
    }
    if (platforms.some((platform) => platform.solid !== false && playerTouches(fireball, platform))) {
      fireball.life = 0;
    }
  }
  const active = projectiles.filter((fireball) =>
    fireball.life > 0 && fireball.x + fireball.w > 0 && fireball.x < roomWidth &&
    fireball.y + fireball.h > -20 && fireball.y < 540);
  projectiles.splice(0, projectiles.length, ...active);
  return defeated;
}

export function drawPowerups(ctx, items, cameraX, elapsed) {
  for (const item of items || []) {
    if (item.collected) continue;
    const x = Math.round(item.x - cameraX);
    const bob = item.emerging ? 0 : Math.sin(item.phase + elapsed * 2) * 3;
    const y = Math.round(item.y + bob);
    ctx.save();
    ctx.shadowColor = item.type === "star" ? "#ffe16b" : item.type === "fire" ? "#ff8a45" : "#b2ed8b";
    ctx.shadowBlur = 10;
    ctx.translate(x, y);
    drawItemArt(ctx, item.type, 32, elapsed);
    ctx.restore();
  }
}

export function drawSurpriseBoxes(ctx, boxes, cameraX, elapsed) {
  for (const box of boxes || []) {
    const x = Math.round(box.x - cameraX);
    const bump = box.bumpTimer > 0 ? Math.sin((1 - box.bumpTimer / 0.3) * Math.PI) * 6 : 0;
    ctx.save();
    ctx.translate(x, Math.round(box.y + bump));
    drawItemArt(ctx, box.opened ? "usedBox" : "box", 32, elapsed);
    ctx.restore();
  }
}

export function drawPlayerFireballs(ctx, projectiles, cameraX, elapsed) {
  for (const fireball of projectiles || []) {
    const x = Math.round(fireball.x - cameraX);
    const y = Math.round(fireball.y + Math.sin(elapsed * 16 + fireball.anim) * 2);
    ctx.save();
    ctx.shadowColor = "#ff672f";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#e94b2f";
    ctx.fillRect(x + 2, y + 4, 12, 9);
    ctx.fillStyle = "#ff9c36";
    ctx.fillRect(x + 5, y + 1, 8, 8);
    ctx.fillStyle = "#fff0a0";
    ctx.fillRect(x + 8, y + 3, 4, 5);
    ctx.restore();
  }
}

export function drawPowerupIcon(ctx, type, x = 0, y = 0, size = 56, elapsed = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  if (type === "coin") {
    drawCoins(ctx, createCoins([[7, 5]]), 0, elapsed);
  } else {
    drawItemArt(ctx, type, 32, elapsed);
  }
  ctx.restore();
}

function drawItemArt(ctx, type, size, elapsed) {
  if (type === "growth" || type === "fire") {
    const cap = type === "growth" ? "#ec5361" : "#f28a3c";
    const spots = type === "growth" ? "#fff6df" : "#ffe776";
    ctx.fillStyle = "#f4e3c2";
    ctx.fillRect(10, 17, 12, 12);
    ctx.fillRect(7, 20, 3, 7);
    ctx.fillRect(22, 20, 3, 7);
    ctx.fillStyle = cap;
    ctx.fillRect(4, 11, 24, 8);
    ctx.fillRect(7, 7, 18, 5);
    ctx.fillRect(11, 4, 10, 4);
    ctx.fillStyle = spots;
    ctx.fillRect(9, 10, 4, 4);
    ctx.fillRect(19, 13, 4, 3);
    if (type === "fire") {
      ctx.fillStyle = "#ffd34f";
      ctx.fillRect(13, 1, 6, 4);
      ctx.fillRect(15, 0, 3, 7);
    }
    ctx.fillStyle = "#533c46";
    ctx.fillRect(12, 18, 2, 3);
    ctx.fillRect(19, 18, 2, 3);
    return;
  }

  if (type === "star") {
    const centerX = 16;
    const centerY = 16;
    const outer = 15;
    const inner = 7;
    ctx.beginPath();
    for (let point = 0; point < 10; point++) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const radius = point % 2 === 0 ? outer : inner;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#ffc83d";
    ctx.fill();
    ctx.strokeStyle = "#e79332";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#55404a";
    ctx.fillRect(12, 14, 2, 4);
    ctx.fillRect(19, 14, 2, 4);
    ctx.fillStyle = "#fff3ad";
    ctx.fillRect(7, 7, 3, 3);
    return;
  }

  if (type === "heart") {
    ctx.fillStyle = "#ed5d73";
    ctx.fillRect(4, 8, 9, 8);
    ctx.fillRect(19, 8, 9, 8);
    ctx.fillRect(2, 11, 28, 8);
    ctx.fillRect(5, 18, 22, 5);
    ctx.fillRect(9, 23, 14, 4);
    ctx.fillRect(13, 27, 6, 3);
    ctx.fillStyle = "#ffb1ad";
    ctx.fillRect(7, 11, 3, 5);
    return;
  }

  if (type === "box" || type === "usedBox") {
    ctx.fillStyle = type === "box" ? "#a95c32" : "#777985";
    ctx.fillRect(2, 2, 28, 28);
    ctx.fillStyle = type === "box" ? "#ffd05a" : "#b5b4b1";
    ctx.fillRect(4, 4, 24, 24);
    ctx.fillStyle = type === "box" ? "#f5a43d" : "#8e8b88";
    ctx.fillRect(6, 6, 20, 20);
    ctx.fillStyle = type === "box" ? "#ffe88a" : "#c5c1bb";
    ctx.fillRect(8, 8, 16, 16);
    ctx.fillStyle = type === "box" ? "#fff4c1" : "#e4ded2";
    ctx.font = "bold 19px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(type === "box" ? "?" : "✓", 16, 16);
    if (type === "box") {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(elapsed * 4) * 0.1})`;
      ctx.fillRect(7, 6, 4, 3);
    }
  }
}
