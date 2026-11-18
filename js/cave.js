import { createCoins } from "./coins.js";
import { playerTouches } from "./player.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let darknessCanvas;
let darknessContext;

export function createCaveRuntime(room) {
  const platforms = room.platforms.map((platform) => ({ ...platform }));
  const movingPlatforms = (room.movingPlatforms || []).map((platform, index) => {
    const moving = {
      ...platform,
      id: `moving-${index}`,
      type: "moving",
      baseX: platform.x,
      previousX: platform.x,
      dx: 0,
      solid: true,
      oneWay: true,
    };
    platforms.push(moving);
    return moving;
  });
  const crumblingPlatforms = platforms.filter((platform) => platform.type === "crumble");
  crumblingPlatforms.forEach((platform, index) => {
    platform.id = `crumble-${index}`;
    platform.oneWay = true;
  });

  return {
    platforms,
    movingPlatforms,
    crumblingPlatforms,
    coins: createCoins(room.coins || []),
    toads: (room.fireToads || []).map((toad, index) => ({
      ...toad,
      w: 48,
      h: 40,
      direction: -1,
      alive: true,
      state: "idle",
      attackTimer: (toad.cooldown || 1.2) + index * 0.65,
      anim: index * 2,
    })),
    fireballs: [],
    particles: [],
    stalactites: (room.stalactites || []).map((stalactite) => ({
      ...stalactite,
      startY: stalactite.y,
      y: stalactite.y,
      h: 34,
      state: "idle",
      timer: 0,
      velocity: 0,
    })),
    traps: (room.fireTraps || []).map((trap) => ({ ...trap, active: false })),
    time: 0,
  };
}

export function updateCaveRuntime(runtime, room, player, dt) {
  const events = { damage: false, shake: 0, shot: false, trap: false };
  runtime.time += dt;
  for (const platform of runtime.movingPlatforms) {
    platform.previousX = platform.x;
    platform.x = platform.baseX + Math.sin(runtime.time * platform.speed + platform.phase) * platform.range;
    platform.dx = platform.x - platform.previousX;
    if (player.groundedOn === platform.id) player.x += platform.dx;
  }
  updateCrumblingPlatforms(runtime, player, dt);
  updateStalactites(runtime, player, dt, events);
  updateFireTraps(runtime, player, dt, events);
  updateToads(runtime, player, dt, events);
  updateFireballs(runtime, player, room, dt, events);
  updateParticles(runtime, dt);

  if ((room.lava || []).some((lava) => playerTouches(player, lava, 5))) events.damage = true;
  return events;
}

function updateCrumblingPlatforms(runtime, player, dt) {
  for (const platform of runtime.crumblingPlatforms) {
    if (platform.solid && player.groundedOn === platform.id) {
      platform.crumbleTimer = (platform.crumbleTimer || 0) + dt;
      if (platform.crumbleTimer >= 0.78) {
        platform.solid = false;
        platform.respawnTimer = 3.2;
        platform.crumbleTimer = 0;
      }
    } else if (platform.solid) {
      platform.crumbleTimer = 0;
    } else {
      platform.respawnTimer -= dt;
      if (platform.respawnTimer <= 0) {
        platform.solid = true;
        platform.crumbleTimer = 0;
      }
    }
  }
}

function updateStalactites(runtime, player, dt, events) {
  for (const stalactite of runtime.stalactites) {
    if (stalactite.state === "idle" && Math.abs(player.x + player.w / 2 - stalactite.x) < 105) {
      stalactite.state = "warning";
      stalactite.timer = 0.92;
    } else if (stalactite.state === "warning") {
      stalactite.timer -= dt;
      if (stalactite.timer <= 0) {
        stalactite.state = "falling";
        stalactite.velocity = 90;
        events.trap = true;
      }
    } else if (stalactite.state === "falling") {
      const falling = { x: stalactite.x - 12, y: stalactite.y, w: 24, h: stalactite.h };
      if (playerTouches(player, falling, 3)) events.damage = true;
      stalactite.velocity += 1100 * dt;
      stalactite.y += stalactite.velocity * dt;
      if (stalactite.y + stalactite.h >= 474) {
        stalactite.y = 474 - stalactite.h;
        stalactite.state = "impact";
        stalactite.timer = 0.48;
        events.shake = Math.max(events.shake, 0.2);
      }
    } else if (stalactite.state === "impact") {
      stalactite.timer -= dt;
      if (stalactite.timer <= 0) {
        stalactite.state = "resetting";
        stalactite.timer = 1.25;
      }
    } else if (stalactite.state === "resetting") {
      stalactite.timer -= dt;
      if (stalactite.timer <= 0) {
        stalactite.state = "idle";
        stalactite.y = stalactite.startY;
      }
    }
  }
}

function updateFireTraps(runtime, player, dt, events) {
  for (const trap of runtime.traps) {
    trap.clock = (trap.clock || trap.phase || 0) + dt;
    const nextActive = trap.clock % trap.period < trap.activeFor;
    if (nextActive && !trap.active) events.trap = true;
    trap.active = nextActive;
    if (trap.active && playerTouches(player, trap, 3)) events.damage = true;
  }
}

function updateToads(runtime, player, dt, events) {
  for (const toad of runtime.toads) {
    if (!toad.alive) continue;
    toad.anim += dt * (toad.state === "windup" ? 13 : 5);
    toad.x += toad.speed * toad.direction * dt;
    if (toad.x <= toad.min || toad.x + toad.w >= toad.max) toad.direction *= -1;
    if (toad.state === "idle") {
      toad.attackTimer -= dt;
      const horizontalDistance = Math.abs(player.x + player.w / 2 - (toad.x + toad.w / 2));
      if (horizontalDistance < toad.range && toad.attackTimer <= 0) {
        toad.direction = player.x < toad.x ? -1 : 1;
        toad.state = "windup";
        toad.attackTimer = 0.72;
        emitParticles(runtime, toad.x + toad.w / 2, toad.y + 22, "#ff9a54", 7);
      }
    } else {
      toad.attackTimer -= dt;
      if (toad.attackTimer <= 0) {
        const direction = player.x + player.w / 2 < toad.x + toad.w / 2 ? -1 : 1;
        const startX = toad.x + toad.w / 2 + direction * 17;
        const startY = toad.y + 16;
        const targetY = player.y + player.h * 0.55;
        runtime.fireballs.push({
          x: startX,
          y: startY,
          w: 18,
          h: 14,
          vx: direction * 205,
          vy: clamp((targetY - startY) * 0.35, -72, 72),
          gravity: 16,
          life: 4.5,
          anim: 0,
        });
        emitParticles(runtime, startX, startY, "#ff7d36", 12);
        toad.state = "idle";
        toad.attackTimer = (toad.cooldown || 1.2) + 1.05;
        events.shot = true;
      }
    }
  }
}

function updateFireballs(runtime, player, room, dt, events) {
  for (const fireball of runtime.fireballs) {
    fireball.x += fireball.vx * dt;
    fireball.y += fireball.vy * dt;
    fireball.vy += fireball.gravity * dt;
    fireball.life -= dt;
    fireball.anim += dt * 18;
    emitParticles(runtime, fireball.x + fireball.w / 2, fireball.y + fireball.h / 2, "#ff9148", 1);
    if (playerTouches(player, fireball, 3)) {
      events.damage = true;
      fireball.life = 0;
    }
    if (runtime.platforms.some((platform) => platform.solid !== false && playerTouches(fireball, platform))) {
      fireball.life = 0;
    }
  }
  runtime.fireballs = runtime.fireballs.filter((fireball) =>
    fireball.life > 0 && fireball.x + fireball.w > 0 && fireball.x < room.width &&
    fireball.y + fireball.h > -20 && fireball.y < 540);
}

function updateParticles(runtime, dt) {
  for (const particle of runtime.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += particle.gravity * dt;
    particle.life -= dt;
  }
  runtime.particles = runtime.particles.filter((particle) => particle.life > 0);
}

function emitParticles(runtime, x, y, color, count) {
  for (let i = 0; i < count; i++) {
    if (runtime.particles.length > 130) break;
    const angle = Math.random() * Math.PI * 2;
    const speed = 24 + Math.random() * 100;
    runtime.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 28,
      gravity: 105,
      size: 2 + Math.random() * 3,
      color,
      life: 0.18 + Math.random() * 0.34,
    });
  }
}

export function drawCaveRoom(ctx, room, runtime, cameraX, elapsed) {
  drawCaveBackground(ctx, room, cameraX, elapsed);
  drawLava(ctx, room.lava || [], cameraX, elapsed);
  drawCaveDecor(ctx, room, cameraX, elapsed);
  drawCavePlatforms(ctx, runtime.platforms, cameraX);
  drawStalactites(ctx, runtime.stalactites, cameraX);
  drawFireTraps(ctx, runtime.traps, cameraX, runtime.time);
  drawFireToads(ctx, runtime.toads, cameraX);
  drawFireballs(ctx, runtime.fireballs, cameraX, runtime.time);
  drawParticles(ctx, runtime.particles, cameraX);
  drawTunnels(ctx, room.tunnels || [], cameraX, elapsed);
}

function drawCaveBackground(ctx, room, cameraX, elapsed) {
  const background = ctx.createLinearGradient(0, 0, 0, 540);
  background.addColorStop(0, "#111523");
  background.addColorStop(0.55, "#20283a");
  background.addColorStop(1, "#10141e");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 960, 540);

  ctx.fillStyle = "#182031";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = -80; x <= 1040; x += 80) {
    ctx.lineTo(x, 58 + Math.sin((x + cameraX * 0.22) * 0.016) * 18);
  }
  ctx.lineTo(960, 0);
  ctx.closePath();
  ctx.fill();

  for (let index = -1; index < 8; index++) {
    const x = index * 190 - (cameraX * 0.48 % 190);
    const seed = index * 37 + room.width;
    ctx.fillStyle = index % 2 ? "#242d40" : "#1c2637";
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x + 24, 136 + seed % 42);
    ctx.lineTo(x + 63, 170 + seed % 48);
    ctx.lineTo(x + 104, 119 + seed % 30);
    ctx.lineTo(x + 148, 74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(100,115,146,.12)";
    ctx.fillRect(x + 40, 182 + seed % 32, 54, 4);
  }

  ctx.fillStyle = "rgba(4,8,15,.55)";
  ctx.beginPath();
  ctx.ellipse(520 + Math.sin(elapsed * 0.35) * 110, 150, 285, 96, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLava(ctx, lavaPits, cameraX, elapsed) {
  for (const lava of lavaPits) {
    const x = Math.round(lava.x - cameraX);
    if (x + lava.w < 0 || x > 960) continue;
    const glow = 0.75 + Math.sin(elapsed * 4 + lava.x) * 0.12;
    const gradient = ctx.createLinearGradient(0, lava.y, 0, lava.y + lava.h);
    gradient.addColorStop(0, `rgba(255,132,48,${glow})`);
    gradient.addColorStop(0.18, "#e9482d");
    gradient.addColorStop(1, "#5b1d29");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, lava.y, lava.w, lava.h);
    ctx.fillStyle = "#ffb54d";
    for (let i = 0; i < lava.w; i += 29) {
      const waveY = lava.y + Math.sin(elapsed * 5 + i * 0.12) * 4;
      ctx.fillRect(x + i, waveY, Math.min(20, lava.w - i), 4);
    }
  }
}

function drawCaveDecor(ctx, room, cameraX, elapsed) {
  for (const [worldX, y] of room.torches || []) {
    const x = Math.round(worldX - cameraX);
    if (x < -40 || x > 1000) continue;
    ctx.fillStyle = "#514038";
    ctx.fillRect(x - 5, y + 7, 10, 24);
    ctx.fillStyle = "#ad6941";
    ctx.fillRect(x - 7, y + 27, 14, 5);
    const flicker = Math.sin(elapsed * 17 + worldX) * 3;
    ctx.fillStyle = "#ffae50";
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 7 + flicker * 0.25, 12 + flicker, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1a0";
    ctx.fillRect(x - 2, y - 3, 4, 8);
  }

  for (const [worldX, y, color] of room.crystals || []) {
    const x = Math.round(worldX - cameraX);
    if (x < -30 || x > 990) continue;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 13);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(x - 2, y - 8, 2, 8);
  }

  for (const [worldX, y, color] of room.mushrooms || []) {
    const x = Math.round(worldX - cameraX);
    if (x < -30 || x > 990) continue;
    ctx.fillStyle = "#b9d1cf";
    ctx.fillRect(x - 3, y - 13, 6, 14);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y - 13, 12, 8 + Math.sin(elapsed * 3 + worldX) * 1.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fff0c1";
    ctx.fillRect(x - 5, y - 15, 3, 2);
  }
}

function drawCavePlatforms(ctx, platforms, cameraX) {
  for (const platform of platforms) {
    if (platform.solid === false) continue;
    const x = Math.round(platform.x - cameraX);
    if (x + platform.w < -4 || x > 964) continue;
    if (platform.type === "moving") {
      ctx.fillStyle = "#4a5266";
      ctx.fillRect(x, platform.y, platform.w, platform.h);
      ctx.fillStyle = "#9c6a50";
      ctx.fillRect(x, platform.y, platform.w, 5);
      ctx.fillStyle = "#f3a156";
      ctx.fillRect(x + 8, platform.y + 6, platform.w - 16, 3);
      continue;
    }
    if (platform.type === "crumble" && platform.crumbleTimer > 0.25) {
      ctx.fillStyle = "#998375";
    } else {
      ctx.fillStyle = platform.y > 460 ? "#464b5a" : "#50586a";
    }
    ctx.fillRect(x, platform.y, platform.w, platform.h);
    ctx.fillStyle = platform.y > 460 ? "#777b83" : "#777d8c";
    ctx.fillRect(x, platform.y, platform.w, 5);
    ctx.fillStyle = "rgba(14,19,30,.4)";
    for (let tile = x + 17; tile < x + platform.w; tile += 36) {
      ctx.fillRect(tile, platform.y + 11, 3, Math.min(8, platform.h - 11));
    }
    if (platform.type === "crumble" && platform.crumbleTimer > 0) {
      ctx.strokeStyle = "#201c26";
      ctx.beginPath();
      ctx.moveTo(x + platform.w * 0.4, platform.y + 5);
      ctx.lineTo(x + platform.w * 0.48, platform.y + 12);
      ctx.lineTo(x + platform.w * 0.43, platform.y + 20);
      ctx.stroke();
    }
  }
}

function drawStalactites(ctx, stalactites, cameraX) {
  for (const stalactite of stalactites) {
    const x = stalactite.x - cameraX;
    if (x < -40 || x > 1000) continue;
    if (stalactite.state === "warning") {
      ctx.fillStyle = Math.sin(stalactite.timer * 24) > 0 ? "#ffb54d" : "#78444a";
      ctx.fillRect(x - 19, stalactite.startY + stalactite.h + 12, 38, 3);
    }
    const y = stalactite.state === "idle" || stalactite.state === "resetting" ? stalactite.startY : stalactite.y;
    ctx.fillStyle = stalactite.state === "impact" ? "#8f969f" : "#707a8e";
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x + 14, y);
    ctx.lineTo(x, y + stalactite.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(204,214,228,.55)";
    ctx.fillRect(x - 2, y + 5, 2, 10);
  }
}

function drawFireTraps(ctx, traps, cameraX, time) {
  for (const trap of traps) {
    const x = trap.x - cameraX;
    ctx.fillStyle = "#555361";
    ctx.fillRect(x - 5, trap.y + 12, trap.w + 10, 12);
    ctx.fillStyle = "#1b202b";
    ctx.fillRect(x, trap.y + 5, trap.w, 18);
    if (!trap.active) {
      ctx.fillStyle = "#765848";
      ctx.fillRect(x + 7, trap.y + 10, trap.w - 14, 5);
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const flameX = x + 6 + i * (trap.w - 10) / 3;
      const flameHeight = 17 + Math.sin(time * 21 + i) * 7;
      ctx.fillStyle = "#fa5b33";
      ctx.beginPath();
      ctx.moveTo(flameX, trap.y + 6);
      ctx.lineTo(flameX + 6, trap.y + 6 - flameHeight);
      ctx.lineTo(flameX + 12, trap.y + 6);
      ctx.fill();
      ctx.fillStyle = "#ffd369";
      ctx.fillRect(flameX + 5, trap.y - flameHeight * 0.55, 3, 8);
    }
  }
}

function drawFireToads(ctx, toads, cameraX) {
  for (const toad of toads) {
    if (!toad.alive) continue;
    const x = Math.round(toad.x - cameraX);
    const y = Math.round(toad.y + Math.sin(toad.anim) * 1.5);
    const winding = toad.state === "windup";
    const mouthOpen = winding ? 10 : 4 + Math.sin(toad.anim * 0.7) * 2;
    ctx.fillStyle = "#16251f";
    ctx.fillRect(x + 4, y + 30, 12, 9);
    ctx.fillRect(x + 32, y + 30, 12, 9);
    ctx.fillStyle = "#315a45";
    ctx.fillRect(x + 2, y + 15, 44, 24);
    ctx.fillRect(x + 8, y + 9, 32, 16);
    ctx.fillStyle = "#417455";
    ctx.fillRect(x + 3, y + 22, 42, 8);
    ctx.fillStyle = "#426e4e";
    ctx.fillRect(x + 8, y + 4, 13, 13);
    ctx.fillRect(x + 28, y + 4, 13, 13);
    const eyeX = toad.direction > 0 ? 14 : 11;
    ctx.fillStyle = "#ff9e38";
    ctx.fillRect(x + eyeX, y + 7, 7, 7);
    ctx.fillRect(x + eyeX + 17, y + 7, 7, 7);
    ctx.fillStyle = "#fff0a8";
    ctx.fillRect(x + eyeX + 2, y + 8, 2, 3);
    ctx.fillRect(x + eyeX + 19, y + 8, 2, 3);
    ctx.fillStyle = "#261d24";
    ctx.fillRect(x + 13, y + 24, 22, mouthOpen);
    ctx.fillStyle = "#e76b4a";
    ctx.fillRect(x + 16, y + 25 + mouthOpen * 0.45, 16, 3);
    if (winding) {
      const pulse = 0.45 + Math.sin(toad.anim * 2) * 0.2;
      ctx.fillStyle = `rgba(255,118,48,${pulse})`;
      ctx.beginPath();
      ctx.arc(x + 39, y + 29, 6 + Math.sin(toad.anim) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFireballs(ctx, fireballs, cameraX, time) {
  for (const fireball of fireballs) {
    const x = fireball.x - cameraX;
    const y = fireball.y + Math.sin(time * 19 + fireball.anim) * 2;
    const glow = ctx.createRadialGradient(x + 9, y + 8, 1, x + 9, y + 8, 22);
    glow.addColorStop(0, "rgba(255,223,105,.95)");
    glow.addColorStop(0.35, "rgba(255,99,44,.8)");
    glow.addColorStop(1, "rgba(255,63,38,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 13, y - 14, 44, 44);
    ctx.fillStyle = "#ff7138";
    ctx.beginPath();
    ctx.arc(x + 9, y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe184";
    ctx.fillRect(x + 7, y + 4, 5, 8);
  }
}

function drawParticles(ctx, particles, cameraX) {
  for (const particle of particles) {
    ctx.globalAlpha = clamp(particle.life * 2.2, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - cameraX, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawTunnels(ctx, tunnels, cameraX, elapsed) {
  for (const tunnel of tunnels) {
    const x = Math.round(tunnel.x - cameraX);
    if (x + tunnel.w < -30 || x > 990) continue;
    const glow = tunnel.secret ? "#d28cff" : "#8da0b4";
    ctx.fillStyle = "#252b3a";
    ctx.fillRect(x + 6, tunnel.y + 12, tunnel.w - 12, tunnel.h - 12);
    ctx.fillStyle = "#687182";
    ctx.fillRect(x, tunnel.y + 7, tunnel.w, 17);
    ctx.fillRect(x + 8, tunnel.y + 22, 10, tunnel.h - 22);
    ctx.fillRect(x + tunnel.w - 18, tunnel.y + 22, 10, tunnel.h - 22);
    ctx.fillStyle = glow;
    ctx.fillRect(x - 4, tunnel.y, tunnel.w + 8, 10);
    ctx.fillRect(x + 4, tunnel.y + 11, tunnel.w - 8, 4);
    ctx.fillStyle = "#111723";
    ctx.beginPath();
    ctx.ellipse(x + tunnel.w / 2, tunnel.y + 20, tunnel.w * 0.38, 12, 0, Math.PI, 0);
    ctx.fill();
    if (tunnel.secret) {
      ctx.fillStyle = `rgba(222,160,255,${0.35 + Math.sin(elapsed * 5) * 0.25})`;
      ctx.fillRect(x + tunnel.w / 2 - 2, tunnel.y - 13, 4, 4);
      ctx.fillRect(x + tunnel.w / 2 + 11, tunnel.y - 7, 3, 3);
    }
  }
}

export function drawCaveDarkness(ctx, room, runtime, player, cameraX, elapsed) {
  if (!darknessCanvas) {
    darknessCanvas = document.createElement("canvas");
    darknessCanvas.width = 960;
    darknessCanvas.height = 540;
    darknessContext = darknessCanvas.getContext("2d");
  }
  darknessContext.clearRect(0, 0, 960, 540);
  darknessContext.globalCompositeOperation = "source-over";
  darknessContext.fillStyle = "rgba(4,7,17,.91)";
  darknessContext.fillRect(0, 0, 960, 540);
  darknessContext.globalCompositeOperation = "destination-out";
  cutLight(darknessContext, player.x + player.w / 2 - cameraX, player.y + player.h / 2, 158);
  for (const [x, y] of room.torches || []) cutLight(darknessContext, x - cameraX, y + 5, 132);
  for (const [x, y] of room.crystals || []) cutLight(darknessContext, x - cameraX, y, 83);
  for (const lava of room.lava || []) cutLight(darknessContext, lava.x + lava.w / 2 - cameraX, lava.y, 104);
  for (const toad of runtime.toads) {
    if (toad.alive) {
      cutLight(darknessContext, toad.x + toad.w / 2 - cameraX, toad.y + 12, 42);
      if (toad.state === "windup") cutLight(darknessContext, toad.x + toad.w / 2 - cameraX, toad.y + 20, 86);
    }
  }
  for (const fireball of runtime.fireballs) cutLight(darknessContext, fireball.x + fireball.w / 2 - cameraX, fireball.y + fireball.h / 2, 72);
  darknessContext.globalCompositeOperation = "source-over";
  ctx.drawImage(darknessCanvas, 0, 0);

  ctx.globalCompositeOperation = "lighter";
  for (const [x, y] of room.torches || []) drawGlow(ctx, x - cameraX, y, 88, "#ff803c", 0.3);
  for (const [x, y, color] of room.crystals || []) drawGlow(ctx, x - cameraX, y, 53, color, 0.24);
  for (const lava of room.lava || []) drawGlow(ctx, lava.x + lava.w / 2 - cameraX, lava.y + 4, 72, "#ff612f", 0.27);
  for (const fireball of runtime.fireballs) drawGlow(ctx, fireball.x + fireball.w / 2 - cameraX, fireball.y + fireball.h / 2, 48, "#ff6d36", 0.44);
  for (const toad of runtime.toads) {
    if (toad.alive) drawGlow(ctx, toad.x + toad.w / 2 - cameraX, toad.y + 12, 30, "#ff922f", 0.2);
    if (toad.alive && toad.state === "windup") drawGlow(ctx, toad.x + toad.w / 2 - cameraX, toad.y + 20, 48, "#ff963d", 0.27);
  }
  drawGlow(ctx, player.x + player.w / 2 - cameraX, player.y + player.h / 2, 76, "#ffc879", 0.08 + Math.sin(elapsed * 4) * 0.015);
  ctx.globalCompositeOperation = "source-over";
}

function cutLight(ctx, x, y, radius) {
  const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
  gradient.addColorStop(0, "rgba(0,0,0,.98)");
  gradient.addColorStop(0.72, "rgba(0,0,0,.76)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlow(ctx, x, y, radius, color, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function findNearbyTunnel(room, player) {
  return (room.tunnels || []).find((tunnel) =>
    Math.abs(player.x + player.w / 2 - (tunnel.x + tunnel.w / 2)) < tunnel.w / 2 + 22 &&
    player.y < tunnel.y + tunnel.h && player.y + player.h > tunnel.y - 18);
}

export function canStompToad(player, toad, dt) {
  if (!toad.alive || !playerTouches(player, toad, 4)) return false;
  const previousBottom = player.y + player.h - player.vy * dt;
  if (player.vy > 40 && previousBottom <= toad.y + 13) {
    toad.alive = false;
    player.vy = -360;
    return true;
  }
  return false;
}
