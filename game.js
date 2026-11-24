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
  { name: "Mặt đất", top: [40, 70, 140], bottom: [120, 170, 230] },
  { name: "Tầng mây", top: [30, 50, 120], bottom: [90, 130, 210] },
  { name: "Bình lưu", top: [25, 30, 95], bottom: [70, 80, 170] },
  { name: "Quỹ đạo thấp", top: [15, 15, 60], bottom: [50, 40, 120] },
  { name: "Mặt Trăng", top: [10, 10, 35], bottom: [45, 45, 70] },
  { name: "Sao Hỏa", top: [25, 8, 20], bottom: [90, 35, 30] },
  { name: "Vành đai", top: [12, 8, 30], bottom: [60, 40, 80] },
  { name: "Sao Mộc", top: [30, 15, 10], bottom: [110, 70, 40] },
  { name: "Rìa hệ Mặt Trời", top: [5, 10, 25], bottom: [20, 60, 80] },
  { name: "Liên sao", top: [10, 0, 25], bottom: [70, 10, 90] },
  { name: "Vô tận", top: [0, 0, 0], bottom: [15, 15, 30] },
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
    hue: Math.random() * 360,
  };

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

const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  size: Math.random() * 1.6 + 0.4,
  depth: Math.random() * 0.3 + 0.05,
}));

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
        burst(node.x, node.y, rgb([255, 120, 120]), 30, 200);
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
    if (player.trail.length > 18) player.trail.shift();
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
}

function update(dt) {
  updateNodes(dt);
  updatePlayer(dt);
  updateCamera(dt);
  updateEffects(dt);
  ensureNodes();
}

// ---------- Render ----------
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, rgb(bgTop));
  grad.addColorStop(1, rgb(bgBottom));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Càng lên cao càng nhiều sao
  const starAlpha = clamp(score / 40, 0.15, 1);
  ctx.fillStyle = `rgba(255,255,255,${starAlpha})`;
  for (const s of stars) {
    const y = (((s.y - camY * s.depth) % H) + H) % H;
    ctx.fillRect(s.x, y, s.size, s.size);
  }
}

function drawMarkerLine(y, color, label) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label, 10, y - 8);
  ctx.restore();
}

function drawMarkers() {
  // Mốc zone phía trước: cho người chơi thấy "đích" kế tiếp
  for (let i = ZONE_SIZE; i < nodes.length; i += ZONE_SIZE) {
    if (i <= score) continue;
    drawMarkerLine(nodes[i].y + 60, "rgba(255,255,255,0.25)", `▲ ${zoneOf(i).name}`);
  }
  // Vạch kỷ lục — mục tiêu cần chinh phục
  if (best > 0 && nodes[best] && !newRecord) {
    drawMarkerLine(nodes[best].y + 40, "#ffd23f", `KỶ LỤC ${best}`);
  }
}

function drawNodes() {
  nodes.forEach((node, i) => {
    if (node.y - camY > H + 80 || node.y - camY < -80) return;
    const visited = i < player.node;
    const current = i === player.node;

    if (!visited) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.capture, 0, Math.PI * 2);
      ctx.stroke();
    }

    const color = node.vx !== 0 ? `hsl(${node.hue},70%,62%)` : `hsl(${node.hue},55%,58%)`;
    ctx.fillStyle = visited ? "rgba(255,255,255,0.12)" : color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.R, 0, Math.PI * 2);
    ctx.fill();

    if (node.vx !== 0 && !visited) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.R + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (current && state === "play" && player.mode === "orbit") {
      const left = 1 - node.timer / node.life;
      ctx.strokeStyle = left < 0.35 ? "#ff5c7a" : "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.R + ORBIT_GAP + 10, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      ctx.stroke();
    }
  });
}

function drawPlayer() {
  player.trail.forEach((t, i) => {
    const a = i / player.trail.length;
    ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 2 + a * 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (player.mode === "dead") return;

  // Đường ngắm mờ khi đang quay, giúp người mới hiểu hướng phóng
  if (player.mode === "orbit" && score < 5) {
    const dx = -Math.sin(player.angle) * player.dir;
    const dy = Math.cos(player.angle) * player.dir;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + dx * 140, player.y + dy * 140);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawEffects() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  for (const p of popups) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.font = `900 ${p.size}px system-ui, sans-serif`;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 56px system-ui, sans-serif";
  ctx.fillText(String(score), W / 2, 78);

  // Thanh tiến độ tới zone kế tiếp
  const progress = (score % ZONE_SIZE) / ZONE_SIZE;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(W / 2 - 80, 96, 160, 6);
  ctx.fillStyle = "#7cf7c8";
  ctx.fillRect(W / 2 - 80, 96, 160 * progress, 6);
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(zoneOf(score).name, W / 2, 122);

  ctx.textAlign = "right";
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(`BEST ${Math.max(best, score)}`, W - 14, 28);

  if (banner) {
    ctx.globalAlpha = clamp(banner.life, 0, 1);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, H * 0.42 - 40, W, 70);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText(`ZONE ${Math.floor(score / ZONE_SIZE) + 1}`, W / 2, H * 0.42 - 14);
    ctx.font = "900 28px system-ui, sans-serif";
    ctx.fillText(banner.text, W / 2, H * 0.42 + 18);
    ctx.globalAlpha = 1;
  }
}

function drawReadyScreen() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 44px system-ui, sans-serif";
  ctx.fillText("ORBIT CLIMB", W / 2, H * 0.22);
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Chạm / Space để phóng", W / 2, H * 0.22 + 40);
  ctx.fillText("Bay vào vòng hút của hành tinh phía trên", W / 2, H * 0.22 + 64);
  ctx.fillText("Nhắm trúng tâm = PERFECT", W / 2, H * 0.22 + 88);
}

function drawOverScreen() {
  ctx.fillStyle = "rgba(5,6,15,0.7)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  ctx.fillStyle = "#ff8fa3";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText(deathReason, W / 2, H * 0.28);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 88px system-ui, sans-serif";
  ctx.fillText(String(score), W / 2, H * 0.42);

  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(`Đã tới: ${zoneOf(score).name}`, W / 2, H * 0.48);
  ctx.fillText(`Combo PERFECT cao nhất: ${maxCombo}`, W / 2, H * 0.48 + 26);

  if (beatBest) {
    ctx.fillStyle = "#ffd23f";
    ctx.font = "900 24px system-ui, sans-serif";
    ctx.fillText("★ KỶ LỤC MỚI ★", W / 2, H * 0.6);
  } else if (best === score) {
    ctx.fillStyle = "#ffd23f";
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText(`Bằng kỷ lục ${best} — thêm 1 nữa thôi!`, W / 2, H * 0.6);
  } else {
    ctx.fillStyle = "#ffd23f";
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText(`Kỷ lục ${best} — chỉ còn ${best - score} nữa thôi!`, W / 2, H * 0.6);
  }

  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillText("Chạm để thử lại", W / 2, H * 0.72);
  }
}

function render() {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawBackground();

  ctx.save();
  ctx.translate(0, -camY);
  drawMarkers();
  drawNodes();
  drawPlayer();
  drawEffects();
  ctx.restore();

  if (state !== "ready") drawHud();
  ctx.restore();

  if (state === "ready") drawReadyScreen();
  if (state === "over") drawOverScreen();
}

// ---------- Setup ----------
function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const dpr = window.devicePixelRatio || 1;
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
