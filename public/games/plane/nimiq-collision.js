(function (root) {
  "use strict";

  var SCALE = 0.7; // roket & pesawat diperkecil 30%
  var MISSILE_NOSE = 14 * SCALE;
  var MISSILE_RADIUS = 4 * SCALE;
  var PLANE_HIT_CIRCLES = [
    { x: 0, y: -16.1, r: 4.9 },
    { x: 0, y: -7, r: 6.3 },
    { x: -9.8, y: -1.4, r: 6.3 },
    { x: 9.8, y: -1.4, r: 6.3 },
    { x: 0, y: 4.9, r: 6.3 },
    { x: 0, y: 14, r: 4.9 },
  ];

  function segmentHitsCircle(ax, ay, bx, by, cx, cy, radius) {
    var abx = bx - ax;
    var aby = by - ay;
    var lengthSq = abx * abx + aby * aby;
    var t = lengthSq > 0 ? ((cx - ax) * abx + (cy - ay) * aby) / lengthSq : 0;
    t = Math.max(0, Math.min(1, t));
    var dx = ax + abx * t - cx;
    var dy = ay + aby * t - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  function missileHitsPlane(missile, plane) {
    var oldAngle = missile.pa === undefined ? missile.a : missile.pa;
    var oldX = missile.px === undefined ? missile.x : missile.px;
    var oldY = missile.py === undefined ? missile.y : missile.py;
    var ax = oldX + Math.cos(oldAngle) * MISSILE_NOSE;
    var ay = oldY + Math.sin(oldAngle) * MISSILE_NOSE;
    var bx = missile.x + Math.cos(missile.a) * MISSILE_NOSE;
    var by = missile.y + Math.sin(missile.a) * MISSILE_NOSE;
    var theta = plane.a + Math.PI / 2;
    var cos = Math.cos(theta);
    var sin = Math.sin(theta);

    for (var i = 0; i < PLANE_HIT_CIRCLES.length; i++) {
      var circle = PLANE_HIT_CIRCLES[i];
      var cx = plane.x + circle.x * cos - circle.y * sin;
      var cy = plane.y + circle.x * sin + circle.y * cos;
      if (segmentHitsCircle(ax, ay, bx, by, cx, cy, circle.r + MISSILE_RADIUS)) return true;
    }
    return false;
  }

  root.NimiqCollision = {
    missileHitsPlane: missileHitsPlane,
    segmentHitsCircle: segmentHitsCircle,
  };
})(globalThis);
