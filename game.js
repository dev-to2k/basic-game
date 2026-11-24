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

// Mỗi zone: màu nền, màu chấm halftone, và 3 màu mực dành cho hành tinh
const ZONES = [
  { bg: [47, 143, 149], tone: [246, 236, 214], planets: [CORAL, MUSTARD, PAPER] },
  { bg: [44, 116, 150], tone: [90, 180, 190], planets: [CORAL, MUSTARD, PAPER] },
  { bg: [40, 88, 140], tone: [44, 116, 150], planets: [CORAL, MUSTARD, PAPER] },
  { bg: [33, 60, 110], tone: [40, 88, 140], planets: [CORAL, MUSTARD, TEAL] },
  { bg: [27, 35, 64], tone: [33, 60, 110], planets: [PAPER, CORAL, TEAL] },
  { bg: [90, 31, 42], tone: [242, 107, 74], planets: [MUSTARD, PAPER, CORAL] },
  { bg: [51, 32, 74], tone: [229, 143, 163], planets: [MUSTARD, TEAL, PINK] },
  { bg: [74, 42, 20], tone: [242, 154, 60], planets: [PAPER, MUSTARD, CORAL] },
  { bg: [15, 59, 63], tone: [87, 184, 165], planets: [CORAL, PAPER, MUSTARD] },
  { bg: [20, 20, 42], tone: [224, 69, 123], planets: [TEAL, PINK, MUSTARD] },
  { bg: [11, 11, 15], tone: [60, 60, 70], planets: [PAPER, CORAL, MUSTARD] },
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

function zoneName(index) {
  const names = STRINGS[lang].zones;
  return names[Math.min(Math.floor(index / ZONE_SIZE), names.length - 1)];
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
    look: randomPlanetLook(zoneOf(index).planets),
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
let bgColor;
let bgTone;
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
  bgColor = ZONES[0].bg;
  bgTone = ZONES[0].tone;
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
    popup(combo > 1 ? `PERFECT x${combo}` : "PERFECT", node.x, node.y - node.capture - 10, MUSTARD, 26);
    burst(player.x, player.y, MUSTARD, 18 + combo * 2, 220);
    beep(660 + Math.min(combo, 12) * 60, 0.14, "sine", 0.16);
  } else {
    combo = 0;
    burst(player.x, player.y, PAPER, 10, 140);
    beep(440, 0.1, "sine", 0.12);
  }

  if (skipped > 0) {
    popup(t("skip", { n: skipped + 1 }), node.x, node.y + node.capture + 24, TEAL, 20);
  }

  if (best > 0 && score > best && !newRecord) {
    newRecord = true;
    popup(t("newRecord"), W / 2, camY + H * 0.3, CORAL, 36);
    burst(W / 2, camY + H * 0.3, CORAL, 40, 300);
    beep(880, 0.3, "square", 0.08);
  }

  if (Math.floor(score / ZONE_SIZE) > Math.floor(prevScore / ZONE_SIZE)) {
    banner = { text: zoneName(score), life: 2.2 };
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
  burst(player.x, player.y, CORAL, 40, 260);
  beep(160, 0.4, "sawtooth", 0.12);
  if (score > best) {
    beatBest = true;
    best = score;
    saveBest(best);
  }
}

function handleInput(point) {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audio = null;
    }
  }

  if (state === "ready" && point && isOnLangButton(point)) {
    setLang(lang === "en" ? "vi" : "en");
    return;
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
        burst(node.x, node.y, node.look.fill, 40, 220);
        die("collapse");
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
      die("lost");
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
  bgColor = lerpColor(bgColor, zone.bg, Math.min(1, dt * 1.5));
  bgTone = lerpColor(bgTone, zone.tone, Math.min(1, dt * 1.5));
}

function update(dt) {
  updateNodes(dt);
  updatePlayer(dt);
  updateCamera(dt);
  updateEffects(dt);
  ensureNodes();
}

// ---------- Render ----------
// Luật của phong cách tranh in: mực phẳng, không gradient mềm, không glow, góc vuông.
const DISPLAY = '"Anton", Impact, "Arial Narrow", sans-serif';
const TEXT = '"Barlow Condensed", "Arial Narrow", sans-serif';
let toneCache = { key: "", canvas: null };

// Chữ in 2 lớp: lớp bóng lệch + lớp màu
function printText(text, x, y, color, shadow = INK, offset = 2) {
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + offset, y + offset);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function setFont(family, weight, size, spacing = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = `${spacing}px`;
}

// Dải chấm halftone ở nửa dưới màn hình thay cho gradient trời. Cache lại vì chỉ đổi khi chuyển zone.
function toneLayer() {
  const key = rgb(bgTone);
  if (toneCache.key === key) return toneCache.canvas;
  const c = toneCache.canvas || document.createElement("canvas");
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext("2d");
  g.scale(2, 2);
  g.fillStyle = key;
  g.beginPath();
  const step = 12;
  const from = H * 0.5;
  let row = 0;
  for (let y = from; y < H + step; y += step * 0.5) {
    const shift = row % 2 === 0 ? 0 : step * 0.5;
    const r = ((y - from) / (H - from)) * step * 0.24;
    row++;
    if (r < 0.4) continue;
    for (let x = shift; x < W + step; x += step) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  g.fill();
  toneCache = { key, canvas: c };
  return c;
}

function drawBackground() {
  ctx.fillStyle = rgb(bgColor);
  ctx.fillRect(0, 0, W, H);

  // thiên thể lớn phía xa, trôi rất chậm
  const farY = ((((260 - camY * 0.03) % 1300) + 1300) % 1300) - 200;
  // pha màu giữa nền và tone để nó lùi ra sau, không bao giờ trùng màu mực của hành tinh
  ctx.fillStyle = rgb(lerpColor(bgColor, bgTone, 0.3));
  ctx.beginPath();
  ctx.arc(320, farY, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(toneLayer(), 0, 0, W, H);

  // sao: càng lên cao càng hiện nhiều (hiện/ẩn hẳn, không mờ dần)
  const space = clamp(score / 20, 0, 1);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  for (const layer of starLayers) {
    for (const s of layer) {
      if (s.order > 0.12 + space * 0.88) continue;
      const y = (((s.y - camY * s.depth) % H) + H) % H;
      if (s.sparkle) {
        const big = Math.sin(time * 2 + s.phase) > 0;
        starPath(ctx, s.x, y, s.size * (big ? 2.4 : 1.6));
      } else {
        ctx.moveTo(s.x + s.size * 0.6, y);
        ctx.arc(s.x, y, s.size * 0.6, 0, Math.PI * 2);
      }
    }
  }
  ctx.fill();

  // mây chỉ có ở tầng thấp
  const cloudAlpha = clamp(1 - score / 14, 0, 1);
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
  if (camY + H < top - 60) return;
  ctx.fillStyle = MUSTARD;
  ctx.beginPath();
  ctx.arc(W / 2 - 150, top - 30 + 700, 700, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(W / 2 + 40, top + 1500, 1500, 0, Math.PI * 2);
  ctx.fill();
}

function drawMarkerLine(y, label, strong) {
  const color = strong ? MUSTARD : PAPER;
  ctx.strokeStyle = color;
  ctx.lineWidth = strong ? 3 : 2;
  ctx.setLineDash(strong ? [] : [2, 8]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  ctx.setLineDash([]);

  setFont(TEXT, 700, 13, 1.5);
  const w = ctx.measureText(label).width + 18;
  ctx.fillStyle = INK;
  ctx.fillRect(W / 2 - w / 2 + 3, y - 11 + 3, w, 22);
  ctx.fillStyle = color;
  ctx.fillRect(W / 2 - w / 2, y - 11, w, 22);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, y + 1);
  ctx.textBaseline = "alphabetic";
}

function drawMarkers() {
  // Mốc zone phía trước: cho người chơi thấy "đích" kế tiếp
  for (let i = ZONE_SIZE; i < nodes.length; i += ZONE_SIZE) {
    if (i <= score) continue;
    drawMarkerLine(nodes[i].y + 70, `ZONE ${i / ZONE_SIZE + 1} · ${zoneName(i).toUpperCase()}`, false);
  }
  // Vạch kỷ lục — mục tiêu cần chinh phục
  if (best > 0 && nodes[best] && !newRecord) {
    drawMarkerLine(nodes[best].y + 50, t("bestLine", { n: best }), true);
  }
}

function drawCaptureField(node, isTarget, index) {
  ctx.globalAlpha = isTarget ? 0.14 : 0.07;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.capture, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = PAPER;
  ctx.lineWidth = isTarget ? 2.5 : 1.5;
  ctx.setLineDash(isTarget ? [9, 6] : [2, 6]);
  ctx.lineDashOffset = time * 12 * (index % 2 === 0 ? 1 : -1);
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.capture, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMotionStreak(node) {
  const back = node.vx > 0 ? -1 : 1;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  for (let k = -1; k <= 1; k++) {
    const sx = node.x + back * (node.R + 8);
    const sy = node.y + k * node.R * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + back * (14 - Math.abs(k) * 5), sy);
    ctx.stroke();
  }
}

function drawTimer(node, x, y, danger) {
  const r = node.R + ORBIT_GAP + 9;
  const start = -Math.PI / 2;
  // sắp sụp: nhấp nháy 2 màu mực thay vì phát sáng
  const blink = danger > 0.65 && Math.floor(time * 10) % 2 === 0;
  ctx.strokeStyle = blink ? CORAL : PAPER;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, start, start + (1 - danger) * Math.PI * 2);
  ctx.stroke();
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

    if (ticking) drawTimer(node, x, y, danger);
  });
}

function cometColor() {
  if (combo >= 3) return MUSTARD;
  return PAPER;
}

function drawPlayer() {
  const color = cometColor();
  const trail = player.trail;

  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  for (let i = 1; i < trail.length; i++) {
    ctx.lineWidth = (i / trail.length) * 9;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  ctx.lineCap = "butt";

  if (player.mode === "dead") return;

  // Chấm ngắm khi đang quay, giúp người mới hiểu hướng phóng
  if (player.mode === "orbit" && score < 5) {
    const dx = -Math.sin(player.angle) * player.dir;
    const dy = Math.cos(player.angle) * player.dir;
    ctx.fillStyle = PAPER;
    for (let k = 1; k <= 8; k++) {
      ctx.beginPath();
      ctx.arc(player.x + dx * k * 16, player.y + dy * k * 16, 2.6 - k * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(player.x + MISPRINT, player.y + MISPRINT, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawEffects() {
  // mảnh vụn co nhỏ dần chứ không mờ dần
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, p.life) * 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  for (const p of popups) {
    const age = 1 - p.life;
    const scale = 1 + Math.max(0, 0.4 - age * 3);
    ctx.save();
    ctx.globalAlpha = clamp(p.life * 3, 0, 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.06);
    ctx.scale(scale, scale);
    setFont(DISPLAY, 400, p.size, 1);
    printText(p.text, 0, 0, p.color);
    ctx.restore();
  }
}

function drawHud() {
  ctx.textAlign = "center";
  setFont(DISPLAY, 400, 66);
  printText(String(score), W / 2, 84, PAPER, INK, 3);

  // Thanh tiến độ tới zone kế tiếp
  const bw = 150;
  const bx = W / 2 - bw / 2;
  const by = 98;
  const progress = (score % ZONE_SIZE) / ZONE_SIZE;
  ctx.fillStyle = INK;
  ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = MUSTARD;
  ctx.fillRect(bx, by, bw * progress, 8);
  setFont(TEXT, 700, 14, 2);
  printText(zoneName(score).toUpperCase(), W / 2, by + 28, PAPER, INK, 1.5);

  ctx.textAlign = "right";
  setFont(DISPLAY, 400, 18, 1);
  printText(`★ ${Math.max(best, score)}`, W - 16, 34, MUSTARD);

  if (combo >= 2) {
    ctx.textAlign = "center";
    setFont(DISPLAY, 400, 18, 1);
    printText(`COMBO x${combo}`, W / 2, by + 54, MUSTARD);
  }

  if (banner) {
    const cy = H * 0.4;
    ctx.globalAlpha = clamp(banner.life * 2, 0, 1);
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.fillRect(0, cy - 44 + 6, W, 88);
    ctx.fillStyle = MUSTARD;
    ctx.fillRect(0, cy - 44, W, 88);
    ctx.fillStyle = INK;
    setFont(TEXT, 700, 14, 2);
    ctx.fillText(t("zoneUnlocked", { n: Math.floor(score / ZONE_SIZE) + 1 }), W / 2, cy - 18);
    setFont(DISPLAY, 400, 38, 1);
    ctx.fillText(banner.text.toUpperCase(), W / 2, cy + 26);
    ctx.globalAlpha = 1;
  }
}

function drawTapHint(text, y) {
  const bob = Math.sin(time * 4) * 2;
  setFont(DISPLAY, 400, 20, 1.5);
  const w = ctx.measureText(text).width + 48;
  ctx.fillStyle = INK;
  ctx.fillRect(W / 2 - w / 2 + 5, y - 23 + 5, w, 46);
  ctx.fillStyle = PAPER;
  ctx.fillRect(W / 2 - w / 2, y - 23 + bob, w, 46);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y + 2 + bob);
  ctx.textBaseline = "alphabetic";
}

const LANG_BUTTON = { x: W - 92, y: 16, w: 76, h: 28 };

function drawLangToggle() {
  const b = LANG_BUTTON;
  const half = b.w / 2;
  ctx.fillStyle = INK;
  ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  ctx.fillStyle = PAPER;
  ctx.fillRect(lang === "en" ? b.x : b.x + half, b.y, half, b.h);
  setFont(TEXT, 700, 15, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = lang === "en" ? INK : PAPER;
  ctx.fillText("EN", b.x + half / 2, b.y + b.h / 2 + 1);
  ctx.fillStyle = lang === "vi" ? INK : PAPER;
  ctx.fillText("VI", b.x + half + half / 2, b.y + b.h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function isOnLangButton(point) {
  const b = LANG_BUTTON;
  // nới vùng chạm thêm 8px cho dễ bấm trên điện thoại
  return point.x > b.x - 8 && point.x < b.x + b.w + 8 && point.y > b.y - 8 && point.y < b.y + b.h + 8;
}

function drawReadyScreen() {
  ctx.textAlign = "center";
  setFont(DISPLAY, 400, 80, 2);
  printText("ORBIT", W / 2, H * 0.2, PAPER, CORAL, 4);
  printText("CLIMB", W / 2, H * 0.2 + 78, PAPER, CORAL, 4);

  setFont(TEXT, 600, 18, 0.5);
  printText(t("howto1"), W / 2, H * 0.2 + 116, PAPER, INK, 1.5);
  printText(t("howto2"), W / 2, H * 0.2 + 140, PAPER, INK, 1.5);

  if (best > 0) {
    setFont(DISPLAY, 400, 20, 1);
    printText(t("bestReady", { n: best }), W / 2, H * 0.2 + 178, MUSTARD);
  }
  drawTapHint(t("tapLaunch"), H * 0.9);
  drawLangToggle();
}

function drawStat(label, value, cx, y) {
  ctx.fillStyle = INK;
  setFont(TEXT, 700, 12, 2);
  ctx.fillText(label, cx, y);
  setFont(DISPLAY, 400, 20, 0.5);
  ctx.fillText(value, cx, y + 26);
}

// Màn kết thúc là một tấm "vé hành trình" bằng giấy, đặt hơi nghiêng
function drawOverScreen() {
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";

  const cw = W - 68;
  const ch = 356;
  const top = -ch / 2;
  ctx.save();
  ctx.translate(W / 2, H * 0.44);
  ctx.rotate(-0.035);

  ctx.fillStyle = INK;
  ctx.fillRect(-cw / 2 + 7, top + 7, cw, ch);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-cw / 2, top, cw, ch);
  ctx.fillStyle = CORAL;
  ctx.fillRect(-cw / 2, top, cw, 44);

  ctx.fillStyle = PAPER;
  setFont(TEXT, 700, 17, 0.5);
  ctx.fillText(t(deathReason), 0, top + 29);

  ctx.fillStyle = INK;
  setFont(TEXT, 700, 13, 3);
  ctx.fillText(t("height"), 0, top + 76);
  setFont(DISPLAY, 400, 112);
  printText(String(score), 0, top + 186, INK, CORAL, 5);

  // đường răng cưa xé vé
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(-cw / 2 + 18, top + 212);
  ctx.lineTo(cw / 2 - 18, top + 212);
  ctx.stroke();
  ctx.setLineDash([]);

  drawStat(t("statZone"), zoneName(score).toUpperCase(), -cw / 4, top + 240);
  drawStat(t("statCombo"), `x${maxCombo}`, cw / 4, top + 240);

  let recordText = t("recordGap", { best, gap: best - score });
  if (!beatBest && best === score) recordText = t("recordTie", { best });
  if (best === 0) recordText = t("recordFirst");

  if (beatBest) {
    // con dấu đóng lệch
    ctx.rotate(0.09);
    setFont(DISPLAY, 400, 24, 2);
    const stamp = t("recordNew");
    const sw = ctx.measureText(stamp).width + 28;
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 3;
    ctx.strokeRect(-sw / 2, top + 296, sw, 42);
    ctx.fillStyle = CORAL;
    ctx.fillText(stamp, 0, top + 327);
  } else {
    ctx.fillStyle = INK;
    setFont(TEXT, 700, 17, 0.5);
    ctx.fillText(recordText, 0, top + 322);
  }
  ctx.restore();

  drawTapHint(t("tapRetry"), H * 0.44 + ch / 2 + 70);
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

  if (state !== "ready") drawHud();
  ctx.restore();

  if (shake > 8) {
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (state === "ready") drawReadyScreen();
  if (state === "over") drawOverScreen();

  ctx.letterSpacing = "0px";
  ctx.drawImage(grain, 0, 0, W, H);
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
  // đổi toạ độ màn hình về toạ độ logic W x H của game
  const rect = canvas.getBoundingClientRect();
  handleInput({
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  });
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
