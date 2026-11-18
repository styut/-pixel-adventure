import { drawCircularImage } from "./avatar.js";

const WIDTH = 28;
const HEIGHT = 38;
const GRAVITY = 1550;
const MOVE_SPEED = 245;
const JUMP_SPEED = 560;

export function createPlayer(x = 55, y = 420) {
  return { x, y, w: WIDTH, h: HEIGHT, vx: 0, vy: 0, grounded: false, groundedOn: null, facing: 1, anim: 0, invulnerable: 0 };
}

export function updatePlayer(player, input, dt, platforms) {
  const direction = Number(input.right) - Number(input.left);
  player.vx = direction * MOVE_SPEED;
  if (direction) player.facing = direction;
  if (input.jump && player.grounded) {
    player.vy = -JUMP_SPEED;
    player.grounded = false;
    player.groundedOn = null;
  }
  player.vy = Math.min(player.vy + GRAVITY * dt, 820);

  player.x += player.vx * dt;
  for (const platform of platforms) {
    if (platform.solid === false || platform.oneWay) continue;
    if (overlaps(player, platform)) {
      if (player.vx > 0) player.x = platform.x - player.w;
      else if (player.vx < 0) player.x = platform.x + platform.w;
    }
  }
  player.x = Math.max(0, player.x);

  const previousBottom = player.y + player.h;
  player.y += player.vy * dt;
  player.grounded = false;
  player.groundedOn = null;
  for (const platform of platforms) {
    if (platform.solid === false) continue;
    if (overlaps(player, platform)) {
      if (platform.oneWay && player.vy < 0) continue;
      if (player.vy >= 0 && previousBottom <= platform.y + 8) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.groundedOn = platform.id || null;
      } else if (player.vy < 0) {
        player.y = platform.y + platform.h;
        player.vy = 0;
      }
    }
  }
  if (direction) player.anim += dt * 12;
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function drawPlayer(ctx, player, cameraX, avatar = null) {
  if (!avatar && player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y);
  const walking = Math.abs(player.vx) > 0;
  const step = walking ? Math.sin(player.anim) : 0;
  ctx.save();
  ctx.translate(x + player.w / 2, 0);
  ctx.scale(player.facing, 1);
  ctx.translate(-player.w / 2, 0);
  // A little orange explorer, drawn in pixel-sized blocks.
  ctx.fillStyle = "#253853";
  ctx.fillRect(4, y + 34 + Math.max(0, step * 2), 8, 5);
  ctx.fillRect(17, y + 34 + Math.max(0, -step * 2), 8, 5);
  ctx.fillStyle = "#f28a50";
  ctx.fillRect(3, y + 15, 23, 18);
  ctx.fillRect(6, y + 10, 17, 7);
  if (avatar) {
    drawCircularImage(ctx, avatar, 3, y + 1, 22);
    ctx.strokeStyle = "#fff3cf";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14, y + 12, 10.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffd1a0";
    ctx.fillRect(7, y + 3, 16, 13);
    ctx.fillRect(4, y + 8, 4, 6);
    ctx.fillRect(21, y + 7, 4, 6);
    ctx.fillStyle = "#263a55";
    ctx.fillRect(10, y + 7, 3, 4);
    ctx.fillRect(19, y + 7, 3, 4);
    ctx.fillStyle = "#fff";
    ctx.fillRect(11, y + 7, 1, 1);
    ctx.fillRect(20, y + 7, 1, 1);
  }
  ctx.fillStyle = "#df6f42";
  ctx.fillRect(2, y + 16, 5, 12);
  ctx.fillRect(22, y + 16, 5, 12);
  ctx.fillStyle = "#f8c94e";
  ctx.fillRect(12, y + 20, 5, 4);
  ctx.fillStyle = "#38577b";
  ctx.fillRect(7, y + 29, 15, 6);
  ctx.restore();
}

export function playerTouches(a, b, inset = 0) {
  return a.x + inset < b.x + b.w && a.x + a.w - inset > b.x &&
    a.y + inset < b.y + b.h && a.y + a.h - inset > b.y;
}
