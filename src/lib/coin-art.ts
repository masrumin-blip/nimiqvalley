/**
 * Shared painter for the yellow flat-topped hexagon coin used across the
 * arcade games. Pure canvas maths so it stays sharp on any screen size.
 */
export function drawHexCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t = 0,
) {
  // Flat-topped hexagon: vertices start at 0deg, so the top edge is horizontal.
  const squash = 0.55 + 0.45 * Math.abs(Math.cos(t * 2.2));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squash, 1);
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, "#fff3a8");
  grad.addColorStop(0.45, "#ffe066");
  grad.addColorStop(1, "#f5a300");
  ctx.shadowColor = "#ffd400";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.strokeStyle = "#9a6a00";
  ctx.stroke();
  // Inner hexagon mark.
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = Math.cos(a) * r * 0.48;
    const py = Math.sin(a) * r * 0.48;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = "rgba(154,106,0,0.85)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  ctx.restore();
}
