export function createEnemies(definitions) {
  return definitions.map((enemy) => ({ ...enemy, w: 30, h: 26, direction: 1, alive: true, anim: 0 }));
}

export function updateEnemies(enemies, dt, platforms) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.speed * enemy.direction * dt;
    enemy.anim += dt * 8;
    if (enemy.x <= enemy.min || enemy.x + enemy.w >= enemy.max) enemy.direction *= -1;
    const ground = platforms.find((platform) =>
      enemy.x + enemy.w > platform.x && enemy.x < platform.x + platform.w &&
      enemy.y + enemy.h <= platform.y + 2 && enemy.y + enemy.h >= platform.y - 5);
    if (!ground) enemy.y = Math.min(enemy.y + 600 * dt, 432);
    else enemy.y = ground.y - enemy.h;
  }
}

export function drawEnemies(ctx, enemies, cameraX) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const x = Math.round(enemy.x - cameraX);
    const y = Math.round(enemy.y + Math.sin(enemy.anim) * 1.5);
    ctx.fillStyle = "#c65359";
    ctx.fillRect(x + 4, y + 8, 22, 15);
    ctx.fillRect(x + 1, y + 13, 28, 8);
    ctx.fillStyle = "#f08078";
    ctx.fillRect(x + 7, y + 5, 16, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 8, y + 11, 5, 6);
    ctx.fillRect(x + 18, y + 11, 5, 6);
    ctx.fillStyle = "#27374c";
    ctx.fillRect(x + (enemy.direction > 0 ? 11 : 9), y + 13, 2, 3);
    ctx.fillRect(x + (enemy.direction > 0 ? 21 : 19), y + 13, 2, 3);
    ctx.fillStyle = "#663d49";
    ctx.fillRect(x + 5, y + 22, 8, 4);
    ctx.fillRect(x + 18, y + 22, 8, 4);
  }
}
