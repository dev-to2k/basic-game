// ART — phong cách tranh in retro: mực phẳng, bóng halftone, hạt giấy, lệch mực.
// Sprite vẽ 1 lần vào offscreen canvas rồi tái sử dụng mỗi frame.

const SPRITE_SCALE = 2; // vẽ sprite ở 2x để sắc nét trên màn retina

// Bảng mực cố định — mọi thứ trong game chỉ dùng các màu này
const PAPER = "#f6ecd6";
const INK = "#1b2340";
const CORAL = "#f26b4a";
const MUSTARD = "#f2b632";
const TEAL = "#57b8a5";
const PINK = "#e58fa3";

const MISPRINT = 1.5; // độ lệch giữa lớp màu và lớp bóng (px)
const PLANET_KINDS = ["bands", "craters", "plain"];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomPlanetLook(palette) {
  const fill = pick(palette);
  const detail = pick(palette.filter((c) => c !== fill));
  const kind = pick(PLANET_KINDS);
  return { fill, detail, kind, ringed: kind !== "craters" && Math.random() < 0.35, tilt: -0.25 - Math.random() * 0.3 };
}

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = size * SPRITE_SCALE;
  c.height = size * SPRITE_SCALE;
  const g = c.getContext("2d");
  g.scale(SPRITE_SCALE, SPRITE_SCALE);
  return { canvas: c, g };
}

// Lưới chấm so le 45° — chấm to dần theo hướng khuất sáng (trên-trái -> dưới-phải)
function drawHalftoneShade(g, R, color) {
  const step = Math.max(3, R * 0.22);
  g.fillStyle = color;
  g.beginPath();
  let row = 0;
  for (let y = -R; y <= R; y += step * 0.5) {
    const shift = row % 2 === 0 ? 0 : step * 0.5;
    for (let x = -R + shift; x <= R; x += step) {
      const depth = (x + y) / (R * 1.41); // -1 (sáng) .. 1 (tối)
      const r = Math.min(1, Math.max(0, (depth + 0.15) / 0.9)) * step * 0.48;
      if (r < 0.35) continue;
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, Math.PI * 2);
    }
    row++;
  }
  g.fill();
}

function drawRing(g, R, look, front) {
  g.save();
  g.rotate(look.tilt);
  g.strokeStyle = look.detail;
  g.lineWidth = Math.max(2.5, R * 0.16);
  g.beginPath();
  if (front) g.ellipse(0, 0, R * 1.7, R * 0.42, 0, 0, Math.PI);
  else g.ellipse(0, 0, R * 1.7, R * 0.42, 0, Math.PI, Math.PI * 2);
  g.stroke();
  g.restore();
}

function drawSurface(g, R, look) {
  g.fillStyle = look.detail;
  if (look.kind === "bands") {
    g.save();
    g.rotate(look.tilt * 0.5);
    g.fillRect(-R, -R * 0.55, R * 2, R * 0.2);
    g.fillRect(-R, -R * 0.1, R * 2, R * 0.34);
    g.fillRect(-R, R * 0.5, R * 2, R * 0.12);
    g.restore();
  } else if (look.kind === "craters") {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * R * 0.65;
      g.beginPath();
      g.arc(Math.cos(a) * d, Math.sin(a) * d, R * (0.1 + Math.random() * 0.14), 0, Math.PI * 2);
      g.fill();
    }
  }
}

function createPlanetSprite(R, look) {
  const half = Math.ceil(R * 1.9 + 8);
  const { canvas: c, g } = makeCanvas(half * 2);
  g.translate(half, half);

  if (look.ringed) drawRing(g, R, look, false);

  // lớp màu: in lệch nhẹ so với lớp bóng
  g.save();
  g.translate(-MISPRINT, -MISPRINT);
  g.fillStyle = look.fill;
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.fill();
  g.clip();
  drawSurface(g, R, look);
  g.restore();

  // lớp bóng halftone bằng mực tối
  g.save();
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.clip();
  drawHalftoneShade(g, R, INK);
  g.restore();

  // vệt sáng phẳng
  g.strokeStyle = PAPER;
  g.lineWidth = Math.max(1.5, R * 0.1);
  g.lineCap = "round";
  g.beginPath();
  g.arc(-MISPRINT, -MISPRINT, R * 0.68, Math.PI * 1.12, Math.PI * 1.42);
  g.stroke();

  if (look.ringed) drawRing(g, R, look, true);

  return { canvas: c, half };
}

function drawSprite(ctx, sprite, x, y) {
  ctx.drawImage(sprite.canvas, x - sprite.half, y - sprite.half, sprite.half * 2, sprite.half * 2);
}

// Ngôi sao 4 cánh kiểu poster
function starPath(g, x, y, r) {
  const w = r * 0.28;
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x + w, y - w, x + r, y);
  g.quadraticCurveTo(x + w, y + w, x, y + r);
  g.quadraticCurveTo(x - w, y + w, x - r, y);
  g.quadraticCurveTo(x - w, y - w, x, y - r);
}

// Mây phẳng đáy bằng
function createCloudSprite() {
  const half = 80;
  const { canvas: c, g } = makeCanvas(half * 2);
  g.translate(half, half);
  const w = 46 + Math.random() * 20;
  g.fillStyle = PAPER;
  g.beginPath();
  g.arc(-w * 0.55, 0, 13, 0, Math.PI * 2);
  g.arc(-w * 0.1, -9, 19, 0, Math.PI * 2);
  g.arc(w * 0.45, -2, 15, 0, Math.PI * 2);
  g.rect(-w * 0.55, 0, w, 13);
  g.arc(-w * 0.55, 6.5, 6.5, 0, Math.PI * 2);
  g.arc(w * 0.45, 6.5, 6.5, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, half };
}

// Hạt giấy: nhiễu tĩnh phủ lên toàn màn hình
function createGrain(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const light = Math.random() < 0.5;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.random() * 20;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------- Nền ----------
const clouds = Array.from({ length: 6 }, (_, i) => ({
  x: Math.random() * 400,
  y: i * 175 + Math.random() * 70,
  sprite: createCloudSprite(),
}));

const starLayers = [0.04, 0.1, 0.2].map((depth, layer) =>
  Array.from({ length: 34 - layer * 10 }, () => ({
    x: Math.random() * 400,
    y: Math.random() * 700,
    size: 1 + layer * 1.6 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
    sparkle: layer > 0 && Math.random() < 0.6,
    order: Math.random(), // sao có order nhỏ hiện trước khi lên cao
    depth,
  })),
);

const grain = createGrain(400, 700);
