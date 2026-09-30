/**
 * Shared painter for the plain yellow flat-topped hexagon coin used across the
 * arcade games. Same silhouette as the Nimiq logo: solid yellow, flat top and
 * bottom edges, no inner markings.
 */
export function drawHexCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t = 0,
) {
  // Gentle float so the coin reads as alive without spinning or squashing.
  const bob = Math.sin(t * 2.2) * r * 0.06;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    // Vertices at 0deg, 60deg, ... put flat edges on the top and the bottom.
    const a = (Math.PI / 3) * i;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#f6c244";
  ctx.shadowColor = "#ffd400";
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}
