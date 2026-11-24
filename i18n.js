// I18N — chữ hiển thị trong game. Thêm ngôn ngữ mới = thêm 1 key vào STRINGS.

const LANG_KEY = "orbit-climb-lang";

const STRINGS = {
  en: {
    zones: [
      "Ground",
      "Clouds",
      "Stratosphere",
      "Low Orbit",
      "The Moon",
      "Mars",
      "Asteroid Belt",
      "Jupiter",
      "Solar Edge",
      "Interstellar",
      "Infinity",
    ],
    skip: "SKIP +{n}",
    newRecord: "NEW RECORD!",
    collapse: "Planet collapsed. Launch sooner!",
    lost: "Lost in the void...",
    bestLine: "★ BEST {n}",
    zoneUnlocked: "ZONE {n} UNLOCKED",
    howto1: "Launch off your orbit into the next gravity ring",
    howto2: "Aim for the center to score PERFECT",
    bestReady: "★ Best: {n}",
    tapLaunch: "TAP TO LAUNCH",
    height: "HEIGHT CONQUERED",
    statZone: "ZONE",
    statCombo: "MAX COMBO",
    recordGap: "Best {best}, only {gap} to go!",
    recordTie: "Tied your best {best}, 1 more!",
    recordNew: "★ NEW RECORD ★",
    recordFirst: "Reach a planet to set your first record!",
    tapRetry: "TAP TO RETRY",
  },
  vi: {
    zones: [
      "Mặt đất",
      "Tầng mây",
      "Bình lưu",
      "Quỹ đạo thấp",
      "Mặt Trăng",
      "Sao Hỏa",
      "Vành đai",
      "Sao Mộc",
      "Rìa hệ Mặt Trời",
      "Liên sao",
      "Vô tận",
    ],
    skip: "NHẢY CÓC +{n}",
    newRecord: "KỶ LỤC MỚI!",
    collapse: "Hành tinh sụp đổ, phóng nhanh hơn!",
    lost: "Lạc vào khoảng không...",
    bestLine: "★ KỶ LỤC {n}",
    zoneUnlocked: "ZONE {n} ĐÃ MỞ KHÓA",
    howto1: "Phóng khỏi quỹ đạo, lọt vào vùng hút kế tiếp",
    howto2: "Nhắm trúng tâm để ăn PERFECT",
    bestReady: "★ Kỷ lục: {n}",
    tapLaunch: "CHẠM ĐỂ PHÓNG",
    height: "ĐỘ CAO CHINH PHỤC",
    statZone: "ZONE",
    statCombo: "COMBO MAX",
    recordGap: "Kỷ lục {best}, chỉ còn {gap} nữa thôi!",
    recordTie: "Bằng kỷ lục {best}, thêm 1 nữa thôi!",
    recordNew: "★ KỶ LỤC MỚI ★",
    recordFirst: "Chạm được 1 hành tinh là có kỷ lục!",
    tapRetry: "CHẠM ĐỂ CHƠI LẠI",
  },
};

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch (e) {
    // storage không khả dụng — dùng ngôn ngữ trình duyệt
  }
  const browserLang = (navigator.language || "en").toLowerCase();
  if (browserLang.startsWith("vi")) return "vi";
  return "en";
}

let lang = detectLang();
document.documentElement.lang = lang;

function setLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    // không lưu được thì lần sau tự nhận diện lại
  }
}

function t(key, vars = {}) {
  let text = STRINGS[lang][key];
  for (const name in vars) {
    text = text.replace(`{${name}}`, vars[name]);
  }
  return text;
}
