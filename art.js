// ART — tạo sprite & các lớp nền. Vẽ 1 lần vào offscreen canvas rồi tái sử dụng mỗi frame.

const SPRITE_SCALE = 2; // vẽ sprite ở 2x để sắc nét trên màn retina

const PLANET_LOOKS = [
  { light: "#ffd6a0", mid: "#e8894a", dark: "#5a1f1a", glow: "255,170,100", kind: "gas" },
  { light: "#b8f3ff", mid: "#3fa7d6", dark: "#0b2a5a", glow: "110,200,255", kind: "ocean" },
  { light: "#e6d4ff", mid: "#8e6bd6", dark: "#2a1650", glow: "180,140,255", kind: "gas" },
  { light: "#d8ffcf", mid: "#56b870", dark: "#123a2a", glow: "130,240,160", kind: "ocean" },
  { light: "#f2eee8", mid: "#a99f94", dark: "#3a3430", glow: "230,220,210", kind: "rock" },
  { light: "#ffc3d0", mid: "#e0567a", dark: "#4a1030", glow: "255,120,160", kind: "rock" },
  { light: "#fff3b0", mid: "#e0b440", dark: "#5a3a10", glow: "255,220,120", kind: "gas" },
];

function randomPlanetLook() {
  const look = PLANET_LOOKS[Math.floor(Math.random() * PLANET_LOOKS.length)];
  return { ...look, ringed: look.kind === "gas" && Math.random() < 0.45, tilt: (Math.random() - 0.5) * 0.6 };
}

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = size * SPRITE_SCALE;
  c.height = size * SPRITE_SCALE;
  const g = c.getContext("2d");
  g.scale(SPRITE_SCALE, SPRITE_SCALE);
  return { canvas: c, g };
}

function drawRing(g, R, look, front) {
  g.save();
  g.rotate(look.tilt);
  g.lineWidth = R * 0.22;
  g.strokeStyle = `rgba(${look.glow},0.55)`;
  g.beginPath();
  if (front) g.ellipse(0, 0, R * 1.75, R * 0.45, 0, 0, Math.PI);
  else g.ellipse(0, 0, R * 1.75, R * 0.45, 0, Math.PI, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1;
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  if (front) g.ellipse(0, 0, R * 1.95, R * 0.52, 0, 0, Math.PI);
  else g.ellipse(0, 0, R * 1.95, R * 0.52, 0, Math.PI, Math.PI * 2);
  g.stroke();
  g.restore();
}

function drawSurface(g, R, look) {
  if (look.kind === "gas") {
    // vân khí quyển ngang kiểu hành tinh khí
    for (let i = -4; i <= 4; i++) {
      g.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
      const y = (i / 4) * R;
      g.beginPath();
      g.ellipse(0, y + Math.sin(i * 1.7) * 2, R * 1.2, R * (0.08 + Math.random() * 0.06), 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (look.kind === "ocean") {
    // lục địa / mây trôi
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i < 3 ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.16)";
      g.beginPath();
      g.ellipse(
        (Math.random() - 0.5) * R * 1.4,
        (Math.random() - 0.5) * R * 1.4,
        R * (0.2 + Math.random() * 0.35),
        R * (0.08 + Math.random() * 0.12),
        Math.random() * Math.PI,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  } else {
    // miệng núi lửa
    for (let i = 0; i < 7; i++) {
      const cx = (Math.random() - 0.5) * R * 1.4;
      const cy = (Math.random() - 0.5) * R * 1.4;
      const cr = R * (0.08 + Math.random() * 0.18);
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.beginPath();
      g.arc(cx, cy, cr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx + 0.6, cy + 0.6, cr, Math.PI * 0.9, Math.PI * 1.9);
      g.stroke();
    }
  }
}

function createPlanetSprite(R, look) {
  const half = Math.ceil(R * 2.1 + 14);
  const { canvas: c, g } = makeCanvas(half * 2);
  g.translate(half, half);

  // quầng khí quyển
  const halo = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R + 14);
  halo.addColorStop(0, `rgba(${look.glow},0.45)`);
  halo.addColorStop(1, `rgba(${look.glow},0)`);
  g.fillStyle = halo;
  g.beginPath();
  g.arc(0, 0, R + 14, 0, Math.PI * 2);
  g.fill();

  if (look.ringed) drawRing(g, R, look, false);

  // thân hành tinh — nguồn sáng ở góc trên trái
  const body = g.createRadialGradient(-R * 0.4, -R * 0.45, R * 0.1, 0, 0, R);
  body.addColorStop(0, look.light);
  body.addColorStop(0.55, look.mid);
  body.addColorStop(1, look.dark);
  g.fillStyle = body;
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.fill();

  g.save();
  g.clip();
  drawSurface(g, R, look);
  // vùng tối (terminator)
  const shade = g.createLinearGradient(-R, -R, R, R);
  shade.addColorStop(0.45, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,10,0.55)");
  g.fillStyle = shade;
  g.fillRect(-R, -R, R * 2, R * 2);
  g.restore();

  // viền sáng
  g.strokeStyle = `rgba(${look.glow},0.7)`;
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, 0, R - 0.5, Math.PI * 1.05, Math.PI * 1.7);
  g.stroke();

  if (look.ringed) drawRing(g, R, look, true);

  return { canvas: c, half };
}

function drawSprite(ctx, sprite, x, y) {
  ctx.drawImage(sprite.canvas, x - sprite.half, y - sprite.half, sprite.half * 2, sprite.half * 2);
}

// ---------- Nền ----------
const nebulas = Array.from({ length: 5 }, (_, i) => ({
  x: Math.random() * 400,
  y: i * 300 + Math.random() * 120,
  r: 160 + Math.random() * 140,
}));

function createCloudSprite() {
  const half = 110;
  const { canvas: c, g } = makeCanvas(half * 2);
  g.translate(half, half);
  // nhiều cụm gradient mềm chồng lên nhau => mây không bị viền cứng
  for (let i = 0; i < 9; i++) {
    const x = (Math.random() - 0.5) * 120;
    const y = (Math.random() - 0.5) * 22 + Math.abs(x) * 0.12;
    const r = 30 + Math.random() * 28;
    const puff = g.createRadialGradient(x, y, 0, x, y, r);
    puff.addColorStop(0, "rgba(255,255,255,0.35)");
    puff.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = puff;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return { canvas: c, half };
}

const clouds = Array.from({ length: 7 }, (_, i) => ({
  x: Math.random() * 400,
  y: i * 150 + Math.random() * 60,
  sprite: createCloudSprite(),
}));

const starLayers = [0.04, 0.1, 0.2].map((depth, layer) =>
  Array.from({ length: 45 - layer * 10 }, () => ({
    x: Math.random() * 400,
    y: Math.random() * 700,
    size: 0.6 + layer * 0.6 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
    depth,
  })),
);
