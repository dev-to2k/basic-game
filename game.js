// ORBIT CLIMB — one-tap game: quay quanh hành tinh, chạm để phóng, leo càng cao càng tốt.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------- Config ----------
const W = 400;
const H = 700;
const FLY_SPEED = 430;
const ORBIT_GAP = 16;
const ZONE_SIZE = 10;
const BEST_KEY = "orbit-climb-best";

const ZONES = [
  { name: "Mặt đất", top: [40, 70, 140], bottom: [120, 170, 230], nebula: [90, 160, 255] },
  { name: "Tầng mây", top: [30, 50, 120], bottom: [90, 130, 210], nebula: [120, 140, 255] },
  { name: "Bình lưu", top: [25, 30, 95], bottom: [70, 80, 170], nebula: [140, 110, 255] },
  { name: "Quỹ đạo thấp", top: [15, 15, 60], bottom: [50, 40, 120], nebula: [90, 80, 220] },
  { name: "Mặt Trăng", top: [10, 10, 35], bottom: [45, 45, 70], nebula: [160, 160, 200] },
  { name: "Sao Hỏa", top: [25, 8, 20], bottom: [90, 35, 30], nebula: [255, 110, 70] },
  { name: "Vành đai", top: [12, 8, 30], bottom: [60, 40, 80], nebula: [200, 90, 255] },
  { name: "Sao Mộc", top: [30, 15, 10], bottom: [110, 70, 40], nebula: [255, 160, 80] },
  { name: "Rìa hệ Mặt Trời", top: [5, 10, 25], bottom: [20, 60, 80], nebula: [60, 220, 220] },
  { name: "Liên sao", top: [10, 0, 25], bottom: [70, 10, 90], nebula: [255, 60, 200] },
  { name: "Vô tận", top: [0, 0, 0], bottom: [15, 15, 30], nebula: [120, 120, 255] },
];

// ---------- Helpers ----------
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgb(c, alpha = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
}

function zoneOf(index) {
  return ZONES[Math.min(Math.floor(index / ZONE_SIZE), ZONES.length - 1)];
}

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (e) {
    // storage không khả dụng (private mode) — bỏ qua
  }
}

// ---------- Sound (WebAudio beep, không cần file) ----------
let audio = null;

function beep(freq, duration, type = "sine", volume = 0.15) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

// ---------- World generation ----------
function makeNode(index, prev) {
  const level = Math.min(index, 100);
  const R = Math.max(11, 24 - level * 0.13);
  const node = {
    x: W / 2,
    y: 0,
    R,
    capture: R + Math.max(20, 46 - level * 0.3),
    spin: 2.4 + level * 0.03,
    life: Math.max(1.6, 4.5 - level * 0.035),
    timer: 0,
    vx: 0,
    look: randomPlanetLook(),
  };
  node.sprite = createPlanetSprite(R, node.look);

  if (prev) {
    const gap = 160 + Math.min(level, 60) * 1.6 + Math.random() * 50;
    node.y = prev.y - gap;
    node.x = clamp(prev.x + (Math.random() * 2 - 1) * 170, 60, W - 60);
  }

  const movingChance = Math.min(0.55, (index - 12) * 0.025);
  if (index > 12 && Math.random() < movingChance) {
    const dirSign = Math.random() < 0.5 ? -1 : 1;
    node.vx = (50 + level * 1.2) * dirSign;
  }

  return node;
}

function ensureNodes() {
  while (nodes[nodes.length - 1].y > camY - H) {
    const prev = nodes[nodes.length - 1];
    nodes.push(makeNode(nodes.length, prev));
  }
}

// ---------- Game state ----------
let nodes;
let player;
let camY;
let score;
let best = loadBest();
let combo;
let maxCombo;
let state; // "ready" | "play" | "over"
let particles;
let popups;
let shake;
let deathReason;
let overAt;
let newRecord;
let beatBest;
let banner;
let bgTop;
let bgBottom;
let bgNebula;
let time = 0;

function resetGame() {
  nodes = [makeNode(0, null)];
  player = {
    mode: "orbit",
    node: 0,
    angle: Math.PI,
    dir: 1,
    r: nodes[0].R + ORBIT_GAP,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    trail: [],
  };
  camY = -H * 0.68;
  score = 0;
  combo = 0;
  maxCombo = 0;
  state = "ready";
  particles = [];
  popups = [];
  shake = 0;
  deathReason = "";
  newRecord = false;
  beatBest = false;
  banner = null;
  bgTop = ZONES[0].top;
  bgBottom = ZONES[0].bottom;
  bgNebula = ZONES[0].nebula;
  ensureNodes();
}

// ---------- Effects ----------
function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
  }
}

function popup(text, x, y, color, size = 22) {
  // Giữ chữ trong màn hình khi hành tinh nằm sát mép
  popups.push({ text, x: clamp(x, 90, W - 90), y, color, size, life: 1 });
}

// ---------- Actions ----------
function launch() {
  const node = nodes[player.node];
  const speed = FLY_SPEED;
  player.vx = -Math.sin(player.angle) * player.dir * speed + node.vx;
  player.vy = Math.cos(player.angle) * player.dir * speed;
  player.mode = "fly";
  beep(520, 0.08, "triangle", 0.1);
}

function capture(index) {
  const node = nodes[index];
  const dx = node.x - player.x;
  const dy = node.y - player.y;
  const speed = Math.hypot(player.vx, player.vy);

  // Khoảng cách vuông góc từ tâm hành tinh tới đường bay => nhắm càng trúng tâm càng "PERFECT"
  const aimError = Math.abs(player.vx * dy - player.vy * dx) / speed;
  const perfect = aimError < node.R * 0.9;

  // Chiều quay giữ theo quán tính của viên bi
  const angularMomentum = -dx * player.vy + dy * player.vx;
  player.dir = angularMomentum >= 0 ? 1 : -1;
  player.angle = Math.atan2(-dy, -dx);
  player.r = Math.hypot(dx, dy);
  player.mode = "orbit";

  const skipped = index - player.node - 1;
  const prevScore = score;
  player.node = index;
  score = index;

  if (perfect) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    popup(combo > 1 ? `PERFECT x${combo}` : "PERFECT", node.x, node.y - node.capture - 10, "#ffe066");
    burst(player.x, player.y, "#ffe066", 18 + combo * 2, 220);
    beep(660 + Math.min(combo, 12) * 60, 0.14, "sine", 0.16);
  } else {
    combo = 0;
    burst(player.x, player.y, "#ffffff", 10, 140);
    beep(440, 0.1, "sine", 0.12);
  }

  if (skipped > 0) {
    popup(`NHẢY CÓC +${skipped + 1}`, node.x, node.y + node.capture + 24, "#7cf7c8", 18);
  }

  if (best > 0 && score > best && !newRecord) {
    newRecord = true;
    popup("KỶ LỤC MỚI!", W / 2, camY + H * 0.3, "#ff7ab8", 30);
    burst(W / 2, camY + H * 0.3, "#ff7ab8", 40, 300);
    beep(880, 0.3, "square", 0.08);
  }

  if (Math.floor(score / ZONE_SIZE) > Math.floor(prevScore / ZONE_SIZE)) {
    banner = { text: zoneOf(score).name, life: 2.2 };
    beep(990, 0.25, "triangle", 0.12);
  }
}

function die(reason) {
  state = "over";
  player.mode = "dead";
  deathReason = reason;
  overAt = performance.now();
  shake = 14;
  combo = 0;
  burst(player.x, player.y, "#ff5c7a", 40, 260);
  beep(160, 0.4, "sawtooth", 0.12);
  if (score > best) {
    beatBest = true;
    best = score;
    saveBest(best);
  }
}

function handleInput() {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audio = null;
    }
  }

  if (state === "ready") {
    state = "play";
    launch();
    return;
  }
  if (state === "play" && player.mode === "orbit") {
    launch();
    return;
  }
  // Chặn tap vô tình ngay sau khi chết
  if (state === "over" && performance.now() - overAt > 450) {
    resetGame();
  }
}

// ---------- Update ----------
function updateNodes(dt) {
  for (const node of nodes) {
    if (node.vx === 0) continue;
    node.x += node.vx * dt;
    if (node.x < 50 || node.x > W - 50) {
      node.vx *= -1;
      node.x = clamp(node.x, 50, W - 50);
    }
  }
}

function updatePlayer(dt) {
  if (player.mode === "orbit") {
    const node = nodes[player.node];
    player.angle += player.dir * node.spin * dt;
    player.r = lerp(player.r, node.R + ORBIT_GAP, Math.min(1, dt * 8));
    player.x = node.x + Math.cos(player.angle) * player.r;
    player.y = node.y + Math.sin(player.angle) * player.r;

    if (state === "play") {
      node.timer += dt;
      if (node.timer >= node.life) {
        burst(node.x, node.y, `rgb(${node.look.glow})`, 40, 220);
        die("Hành tinh sụp đổ — phóng nhanh hơn!");
      }
    }
  } else if (player.mode === "fly") {
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    for (let i = player.node + 1; i < nodes.length; i++) {
      const node = nodes[i];
      if (Math.hypot(node.x - player.x, node.y - player.y) < node.capture) {
        capture(i);
        break;
      }
    }

    const outOfView =
      player.x < -20 || player.x > W + 20 || player.y > camY + H + 20 || player.y < camY - 40;
    if (player.mode === "fly" && outOfView) {
      die("Lạc vào khoảng không...");
    }
  }

  if (player.mode !== "dead") {
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 26) player.trail.shift();
  }
}

function updateCamera(dt) {
  const target = nodes[player.node].y - H * 0.68;
  camY = lerp(camY, target, Math.min(1, dt * 3));
}

function updateEffects(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt * 1.4;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const p of popups) {
    p.y -= 40 * dt;
    p.life -= dt * 0.9;
  }
  popups = popups.filter((p) => p.life > 0);

  if (banner) {
    banner.life -= dt;
    if (banner.life <= 0) banner = null;
  }

  shake = Math.max(0, shake - dt * 40);

  const zone = zoneOf(score);
  bgTop = lerpColor(bgTop, zone.top, Math.min(1, dt * 1.5));
  bgBottom = lerpColor(bgBottom, zone.bottom, Math.min(1, dt * 1.5));
  bgNebula = lerpColor(bgNebula, zone.nebula, Math.min(1, dt * 1.5));
}

function update(dt) {
  updateNodes(dt);
  updatePlayer(dt);
  updateCamera(dt);
  updateEffects(dt);
  ensureNodes();
}

// ---------- Render ----------
const FONT = '"Baloo 2", system-ui, sans-serif';
let vignette = null;

function pill(x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, rgb(bgTop));
  grad.addColorStop(1, rgb(bgBottom));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const space = clamp(score / 20, 0, 1);
  ctx.globalCompositeOperation = "lighter";

  // tinh vân trôi chậm phía xa
  for (const n of nebulas) {
    const y = ((((n.y - camY * 0.06) % 1500) + 1500) % 1500) - 400;
    const g = ctx.createRadialGradient(n.x, y, 0, n.x, y, n.r);
    g.addColorStop(0, rgb(bgNebula, 0.08 + space * 0.2));
    g.addColorStop(1, rgb(bgNebula, 0));
    ctx.fillStyle = g;
    ctx.fillRect(n.x - n.r, y - n.r, n.r * 2, n.r * 2);
  }

  // 3 lớp sao parallax, lấp lánh
  const starAlpha = 0.12 + space * 0.88;
  for (const layer of starLayers) {
    for (const s of layer) {
      const y = (((s.y - camY * s.depth) % H) + H) % H;
      const twinkle = 0.55 + 0.45 * Math.sin(time * 2.5 + s.phase);
      ctx.fillStyle = `rgba(255,255,255,${starAlpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";

  // mây chỉ có ở tầng thấp, tan dần khi leo lên
  const cloudAlpha = clamp(1 - score / 14, 0, 1) * 0.5;
  if (cloudAlpha > 0) {
    ctx.globalAlpha = cloudAlpha;
    for (const c of clouds) {
      const y = ((((c.y - camY * 0.35) % 1050) + 1050) % 1050) - 150;
      drawSprite(ctx, c.sprite, c.x, y);
    }
    ctx.globalAlpha = 1;
  }
}

function drawGround() {
  const top = 170;
  if (camY + H < top - 30) return;
  const R = 1500;
  ctx.save();
  ctx.shadowColor = "rgba(140,220,255,0.9)";
  ctx.shadowBlur = 30;
  const g = ctx.createLinearGradient(0, top, 0, top + 260);
  g.addColorStop(0, "#3fae84");
  g.addColorStop(0.15, "#1d6b5a");
  g.addColorStop(1, "#071a22");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(W / 2, top + R, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(190,240,255,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, top + R, R, Math.PI * 1.4, Math.PI * 1.6);
  ctx.stroke();
}

function drawMarkerLine(y, color, label, strong) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.strokeStyle = g;
  ctx.lineWidth = strong ? 2.5 : 1.5;
  if (strong) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }
  ctx.setLineDash(strong ? [] : [6, 8]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  ctx.restore();

  ctx.font = `700 12px ${FONT}`;
  const w = ctx.measureText(label).width + 20;
  pill(W / 2 - w / 2, y - 11, w, 22, strong ? color : "rgba(10,12,30,0.65)");
  ctx.fillStyle = strong ? "#2a1a00" : "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, y + 1);
  ctx.textBaseline = "alphabetic";
}

function drawMarkers() {
  // Mốc zone phía trước: cho người chơi thấy "đích" kế tiếp
  for (let i = ZONE_SIZE; i < nodes.length; i += ZONE_SIZE) {
    if (i <= score) continue;
    drawMarkerLine(nodes[i].y + 70, "rgba(255,255,255,0.35)", `ZONE ${i / ZONE_SIZE + 1} · ${zoneOf(i).name}`, false);
  }
  // Vạch kỷ lục — mục tiêu cần chinh phục
  if (best > 0 && nodes[best] && !newRecord) {
    drawMarkerLine(nodes[best].y + 50, "#ffd23f", `★ KỶ LỤC ${best}`, true);
  }
}

function drawCaptureField(node, isTarget, index) {
  const glow = node.look.glow;
  const pulse = isTarget ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
  const g = ctx.createRadialGradient(node.x, node.y, node.R, node.x, node.y, node.capture);
  g.addColorStop(0, `rgba(${glow},0)`);
  g.addColorStop(0.7, `rgba(${glow},0.05)`);
  g.addColorStop(1, `rgba(${glow},${0.14 + pulse * 0.1})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.capture, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${glow},${isTarget ? 0.85 : 0.4})`;
  ctx.lineWidth = isTarget ? 2 : 1.5;
  ctx.setLineDash([3, 7]);
  ctx.lineDashOffset = time * 14 * (index % 2 === 0 ? 1 : -1);
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.capture, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMotionStreak(node) {
  const back = node.vx > 0 ? -1 : 1;
  ctx.strokeStyle = `rgba(${node.look.glow},0.5)`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let k = -1; k <= 1; k++) {
    const sx = node.x + back * (node.R + 8);
    const sy = node.y + k * node.R * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + back * (14 - Math.abs(k) * 5), sy);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

function drawTimer(node, x, y, danger) {
  const r = node.R + ORBIT_GAP + 9;
  const start = -Math.PI / 2;
  const left = 1 - danger;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  const color = danger > 0.65 ? "#ff4d6d" : "#ffffff";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r, start, start + left * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawNodes() {
  nodes.forEach((node, i) => {
    if (node.y - camY > H + 120 || node.y - camY < -120) return;
    const visited = i < player.node;
    const current = i === player.node;
    const ticking = current && state === "play" && player.mode === "orbit";
    const danger = ticking ? node.timer / node.life : 0;

    let x = node.x;
    let y = node.y;
    if (danger > 0.65) {
      const k = (danger - 0.65) * 8;
      x += (Math.random() - 0.5) * k;
      y += (Math.random() - 0.5) * k;
    }

    if (!visited) drawCaptureField(node, i === player.node + 1, i);
    if (!visited && node.vx !== 0) drawMotionStreak(node);

    ctx.globalAlpha = visited ? 0.3 : 1;
    drawSprite(ctx, node.sprite, x, y);
    ctx.globalAlpha = 1;

    if (danger > 0.65) {
      ctx.fillStyle = `rgba(255,50,80,${(danger - 0.65) * 1.4})`;
      ctx.beginPath();
      ctx.arc(x, y, node.R, 0, Math.PI * 2);
      ctx.fill();
    }
    if (ticking) drawTimer(node, x, y, danger);
  });
}

function cometColor() {
  if (combo >= 3) return "255,205,90";
  return "130,225,255";
}

function drawPlayer() {
  const color = cometColor();
  const trail = player.trail;

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 1; i < trail.length; i++) {
    const t = i / trail.length;
    ctx.strokeStyle = `rgba(${color},${t * 0.55})`;
    ctx.lineWidth = t * 10;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  ctx.lineCap = "butt";

  if (player.mode === "dead") {
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  // Chấm ngắm mờ khi đang quay, giúp người mới hiểu hướng phóng
  if (player.mode === "orbit" && score < 5) {
    const dx = -Math.sin(player.angle) * player.dir;
    const dy = Math.cos(player.angle) * player.dir;
    for (let k = 1; k <= 9; k++) {
      ctx.fillStyle = `rgba(255,255,255,${0.45 - k * 0.045})`;
      ctx.beginPath();
      ctx.arc(player.x + dx * k * 16, player.y + dy * k * 16, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const glow = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 22);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.25, `rgba(${color},0.7)`);
  glow.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEffects() {
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.8 + p.life * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const p of popups) {
    const age = 1 - p.life;
    const scale = 1 + Math.max(0, 0.4 - age * 3);
    ctx.save();
    ctx.globalAlpha = clamp(p.life * 1.5, 0, 1);
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.font = `800 ${p.size}px ${FONT}`;
    ctx.strokeStyle = "rgba(10,10,30,0.55)";
    ctx.lineWidth = 5;
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
}

function drawVignette() {
  if (!vignette) {
    vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,10,0.5)");
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawHud() {
  ctx.textAlign = "center";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(String(score), W / 2, 82);
  ctx.restore();

  // Thanh tiến độ tới zone kế tiếp, tên zone nằm trong thanh
  const bw = 180;
  const bx = W / 2 - bw / 2;
  const by = 96;
  const progress = (score % ZONE_SIZE) / ZONE_SIZE;
  pill(bx, by, bw, 24, "rgba(5,8,25,0.45)");
  if (progress > 0) {
    const fill = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fill.addColorStop(0, "rgba(90,240,200,0.55)");
    fill.addColorStop(1, "rgba(120,170,255,0.55)");
    pill(bx, by, Math.max(24, bw * progress), 24, fill);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 13px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(zoneOf(score).name, W / 2, by + 13);

  // Best
  ctx.font = `800 14px ${FONT}`;
  const bestText = `★ ${Math.max(best, score)}`;
  const tw = ctx.measureText(bestText).width + 22;
  pill(W - tw - 12, 14, tw, 26, "rgba(5,8,25,0.45)");
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(bestText, W - 12 - tw / 2, 28);

  if (combo >= 2) {
    ctx.font = `800 15px ${FONT}`;
    ctx.fillStyle = "#ffd23f";
    ctx.fillText(`COMBO x${combo}`, W / 2, by + 42);
  }
  ctx.textBaseline = "alphabetic";

  if (banner) {
    const a = clamp(banner.life, 0, 1);
    const cy = H * 0.4;
    ctx.globalAlpha = a;
    const band = ctx.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, "rgba(5,8,25,0)");
    band.addColorStop(0.5, "rgba(5,8,25,0.6)");
    band.addColorStop(1, "rgba(5,8,25,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, cy - 46, W, 82);
    ctx.fillStyle = "#7cf7c8";
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(`ZONE ${Math.floor(score / ZONE_SIZE) + 1} ĐÃ MỞ KHÓA`, W / 2, cy - 18);
    ctx.save();
    ctx.shadowColor = "rgba(124,247,200,0.8)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(banner.text, W / 2, cy + 20);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawTitle(text, y, size) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y - size, 0, y);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#9fe8ff");
  ctx.shadowColor = "rgba(120,220,255,0.9)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = g;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

function drawTapHint(text, y) {
  const a = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.font = `800 15px ${FONT}`;
  const w = ctx.measureText(text).width + 44;
  ctx.globalAlpha = a;
  pill(W / 2 - w / 2, y - 22, w, 44, "rgba(255,255,255,0.14)");
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(W / 2 - w / 2, y - 22, w, 44, 22);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y + 1);
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}

function drawReadyScreen() {
  const shade = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  shade.addColorStop(0, "rgba(5,8,25,0.55)");
  shade.addColorStop(1, "rgba(5,8,25,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H * 0.5);

  ctx.textAlign = "center";
  drawTitle("ORBIT", H * 0.14, 68);
  drawTitle("CLIMB", H * 0.14 + 60, 68);

  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Phóng khỏi quỹ đạo, lọt vào vùng hút kế tiếp", W / 2, H * 0.14 + 100);
  ctx.fillText("Nhắm trúng tâm để ăn PERFECT", W / 2, H * 0.14 + 122);

  if (best > 0) {
    ctx.font = `800 16px ${FONT}`;
    ctx.fillStyle = "#ffd23f";
    ctx.fillText(`★ Kỷ lục: ${best}`, W / 2, H * 0.14 + 156);
  }
  drawTapHint("CHẠM ĐỂ PHÓNG", H * 0.9);
}

function drawStat(label, value, cx, y) {
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText(label, cx, y);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 17px ${FONT}`;
  ctx.fillText(value, cx, y + 22);
}

function drawOverScreen() {
  ctx.fillStyle = "rgba(5,6,20,0.65)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  const cx = 30;
  const cy = H * 0.2;
  const cw = W - 60;
  const ch = 330;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "rgba(22,24,52,0.94)";
  ctx.beginPath();
  ctx.roundRect(cx, cy, cw, ch, 24);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx, cy, cw, ch, 24);
  ctx.stroke();

  ctx.fillStyle = "#ff8fa3";
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(deathReason, W / 2, cy + 40);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText("ĐỘ CAO CHINH PHỤC", W / 2, cy + 78);
  drawTitle(String(score), cy + 160, 92);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(cx + 24, cy + 190, cw - 48, 1);
  drawStat("ZONE", zoneOf(score).name, W / 2 - 75, cy + 222);
  drawStat("COMBO MAX", `x${maxCombo}`, W / 2 + 75, cy + 222);

  let recordText = `Kỷ lục ${best}, chỉ còn ${best - score} nữa thôi!`;
  if (beatBest) recordText = "★ KỶ LỤC MỚI ★";
  if (!beatBest && best === score) recordText = `Bằng kỷ lục ${best}, thêm 1 nữa thôi!`;
  const recordW = Math.min(cw - 30, ctx.measureText(recordText).width + 60);
  ctx.font = `800 15px ${FONT}`;
  pill(W / 2 - recordW / 2, cy + 272, recordW, 34, beatBest ? "#ffd23f" : "rgba(255,210,63,0.14)");
  ctx.fillStyle = beatBest ? "#2a1a00" : "#ffd23f";
  ctx.textBaseline = "middle";
  ctx.fillText(recordText, W / 2, cy + 290);
  ctx.textBaseline = "alphabetic";

  drawTapHint("CHẠM ĐỂ CHƠI LẠI", cy + ch + 60);
}

function render() {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawBackground();

  ctx.save();
  ctx.translate(0, -camY);
  drawGround();
  drawMarkers();
  drawNodes();
  drawPlayer();
  drawEffects();
  ctx.restore();

  drawVignette();
  if (state !== "ready") drawHud();
  ctx.restore();

  if (shake > 0) {
    ctx.fillStyle = `rgba(255,80,110,${(shake / 14) * 0.25})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (state === "ready") drawReadyScreen();
  if (state === "over") drawOverScreen();
}

// ---------- Setup ----------
function resize() {
  // đo theo body để chừa vùng tai thỏ / thanh home trên điện thoại
  const scale = Math.min(document.body.clientWidth / W, document.body.clientHeight / H);
  // DPR 3 tốn gấp ~2.25 lần pixel so với 2 mà mắt gần như không phân biệt được
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  time += dt;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleInput();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") {
    e.preventDefault();
    if (!e.repeat) handleInput();
  }
});

window.addEventListener("resize", resize);

resize();
resetGame();
requestAnimationFrame(loop);
