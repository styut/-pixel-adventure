export function createCoins(points) {
  return points.map(([x, y], index) => ({ x, y, w: 18, h: 22, phase: index * 0.8, collected: false }));
}

export function drawCoins(ctx, coins, cameraX, time) {
  for (const coin of coins) {
    if (coin.collected) continue;
    const spin = Math.abs(Math.cos(time * 5 + coin.phase));
    const width = Math.max(5, Math.round(16 * spin));
    const x = Math.round(coin.x + 9 - width / 2 - cameraX);
    const bob = coin.emerging ? 0 : Math.sin(time * 4 + coin.phase) * 3;
    const y = Math.round(coin.y + bob);
    ctx.fillStyle = "#d99028";
    ctx.fillRect(x - 1, y + 2, width + 2, 18);
    ctx.fillStyle = "#ffd254";
    ctx.fillRect(x, y, width, 18);
    if (width > 9) {
      ctx.fillStyle = "#fff0a5";
      ctx.fillRect(x + 3, y + 3, 2, 5);
      ctx.fillRect(x + 3, y + 11, 2, 3);
    }
  }
}
