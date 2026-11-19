// Ruang rapat 3D: meja oval, anggota dewan duduk melingkar, kamera dari kursi Louis.
// Logo pembicara menyala dan berdenyut mengikuti suara; anggota yang "berpikir" punya gelembung "...".
import * as THREE from './vendor/three.module.min.js';

const MEJA_A = 2.7;   // jari-jari meja (sumbu x)
const MEJA_B = 1.55;  // jari-jari meja (sumbu z)
const KURSI_A = 3.35;
const KURSI_B = 2.2;
// Sudut kursi (derajat). 90 = depan (Louis/kamera), 270 = seberang meja (moderator).
// Anggota duduk di setengah lingkaran seberang supaya semuanya menghadap Louis dan terlihat di layar.
const SUDUT_ANGGOTA = [234, 306, 205, 335, 182, 358, 160, 20];

function tekstur(teks, sub, warna) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,16,13,0.78)';
  g.beginPath(); g.roundRect(8, 8, 496, 144, 40); g.fill();
  g.fillStyle = warna; g.fillRect(28, 44, 14, 72);
  g.fillStyle = '#fffaf2'; g.font = '600 56px Inter, Segoe UI, sans-serif'; g.fillText(teks, 62, 82);
  g.fillStyle = '#cbbdb0'; g.font = '32px Inter, Segoe UI, sans-serif'; g.fillText(sub, 62, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gelembungPikir() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,250,242,0.95)';
  g.beginPath(); g.roundRect(8, 8, 240, 100, 50); g.fill();
  g.fillStyle = '#5c4f44';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(78 + i * 50, 58, 13, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gelembungTangan() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,250,242,0.96)';
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.font = '68px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('✋', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function infoLogo(a) {
  const model = `${a.model || ''} ${a.keluarga || ''}`.toLowerCase();
  if (/gemini|gemma/.test(model)) return { kunci: 'gemini', nama: 'Gemini', warna: '#4f7cff' };
  if (/deepseek/.test(model)) return { kunci: 'deepseek', nama: 'DeepSeek', warna: '#2687e8' };
  if (/claude|anthropic/.test(model)) return { kunci: 'claude', nama: 'Claude', warna: '#cf7756' };
  if (/mistral/.test(model)) return { kunci: 'mistral', nama: 'Mistral', warna: '#f28d36' };
  if (/qwen/.test(model)) return { kunci: 'qwen', nama: 'Qwen', warna: '#7459d9' };
  if (/llama|meta/.test(model)) return { kunci: 'llama', nama: 'Llama', warna: '#1682b5' };
  if (/grok|xai/.test(model)) return { kunci: 'grok', nama: 'Grok', warna: '#a4d653' };
  if (/glm/.test(model)) return { kunci: 'glm', nama: 'GLM', warna: '#6a68de' };
  if (/agnes/.test(model)) return { kunci: 'agnes', nama: 'Agnes', warna: '#a76bd2' };
  if (/kiro/.test(model)) return { kunci: 'kiro', nama: 'Kiro', warna: '#7b4dff' };
  if (/gpt|openai/.test(model)) return { kunci: 'gpt', nama: 'GPT', warna: '#16a681' };
  const nama = (a.keluarga || a.model?.split('/')[0] || 'Model').slice(0, 12);
  return { kunci: 'lain', nama, warna: a.warna || '#b8612f' };
}

// Logo resmi (opsional) dari public/logo/<kunci>.(svg|png|webp): digambar di atas cakram putih berbingkai warna merek.
function teksturLogoResmi(info, img) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fffdf8'; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.fill();
  g.strokeStyle = info.warna; g.lineWidth = 9; g.beginPath(); g.arc(128, 128, 111, 0, Math.PI * 2); g.stroke();
  const maks = 150;
  const w0 = img.naturalWidth || maks, h0 = img.naturalHeight || maks;
  const k = Math.min(maks / w0, maks / h0);
  g.drawImage(img, 128 - (w0 * k) / 2, 128 - (h0 * k) / 2, w0 * k, h0 * k);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function teksturLogo(info) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const warna = new THREE.Color(info.warna);
  const terang = `#${warna.clone().lerp(new THREE.Color('#ffffff'), 0.18).getHexString()}`;
  const gelap = `#${warna.clone().multiplyScalar(0.68).getHexString()}`;
  const grad = g.createRadialGradient(88, 66, 12, 128, 128, 128);
  grad.addColorStop(0, terang); grad.addColorStop(1, gelap);
  g.fillStyle = grad; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.76)'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  g.save(); g.translate(128, 122); g.strokeStyle = '#fffdf8'; g.fillStyle = '#fffdf8';
  g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
  if (info.kunci === 'gemini') {
    g.beginPath(); g.moveTo(0, -68); g.bezierCurveTo(8, -20, 20, -8, 68, 0); g.bezierCurveTo(20, 8, 8, 20, 0, 68); g.bezierCurveTo(-8, 20, -20, 8, -68, 0); g.bezierCurveTo(-20, -8, -8, -20, 0, -68); g.fill();
  } else if (info.kunci === 'deepseek') {
    g.beginPath(); g.moveTo(-67, 13); g.quadraticCurveTo(-44, -39, 12, -34); g.quadraticCurveTo(45, -31, 54, 4); g.quadraticCurveTo(72, 2, 79, -14); g.quadraticCurveTo(91, 12, 67, 27); g.quadraticCurveTo(47, 57, 4, 46); g.lineTo(-26, 34); g.lineTo(-54, 48); g.lineTo(-49, 20); g.closePath(); g.fill();
    g.fillStyle = gelap; g.beginPath(); g.arc(27, -8, 5, 0, Math.PI * 2); g.fill();
  } else if (info.kunci === 'gpt') {
    for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.ellipse(0, -24, 20, 36, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
    g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.stroke();
  } else if (info.kunci === 'claude') {
    for (let i = 0; i < 12; i++) { g.save(); g.rotate(i * Math.PI / 6); g.beginPath(); g.moveTo(0, -65); g.lineTo(0, -27); g.stroke(); g.restore(); }
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
  } else if (info.kunci === 'mistral') {
    for (let i = 0; i < 4; i++) { g.fillRect(-55, -48 + i * 28, 110 - i * 15, 13); }
  } else if (info.kunci === 'qwen') {
    g.beginPath(); g.moveTo(-58, -44); g.lineTo(40, -44); g.lineTo(58, -24); g.lineTo(-20, 45); g.lineTo(-58, 45); g.lineTo(20, -14); g.closePath(); g.fill();
  } else if (info.kunci === 'llama') {
    g.beginPath(); g.moveTo(-58, -18); g.quadraticCurveTo(-34, -64, 0, -29); g.quadraticCurveTo(34, -64, 58, -18); g.lineTo(43, 41); g.quadraticCurveTo(0, 64, -43, 41); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(-34, 0); g.lineTo(34, 0); g.moveTo(-25, 22); g.lineTo(25, 22); g.stroke();
  } else if (info.kunci === 'grok') {
    g.beginPath(); g.arc(0, 0, 48, -Math.PI * 0.78, Math.PI * 0.78); g.stroke();
    g.beginPath(); g.moveTo(-42, 45); g.lineTo(44, -48); g.stroke();
  } else if (info.kunci === 'glm') {
    g.beginPath(); for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3 - Math.PI / 6; const x = Math.cos(t) * 57, y = Math.sin(t) * 57; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(-29, -24); g.lineTo(28, -24); g.lineTo(-24, 27); g.lineTo(31, 27); g.stroke();
  } else {
    g.font = '700 92px Inter, Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(info.nama.slice(0, 1).toUpperCase(), 0, 4);
  }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function teksturKanvas(w, h, gambar) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  gambar(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class Ruang3D {
  constructor(wadah) {
    this.wadah = wadah;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    wadah.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b1512');
    this.scene.fog = new THREE.Fog('#1b1512', 11, 22);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 50);
    this.kameraPos = new THREE.Vector3(0, 1.85, KURSI_B + 1.05);
    this.camera.position.copy(this.kameraPos);
    this.fokus = new THREE.Vector3(0, 1.15, -0.6);
    this.fokusTarget = this.fokus.clone();
    this.lihat = { yaw: 0, pitch: 0, seret: false, x: 0, y: 0 };

    this.avatar = new Map();    // id -> { grup, lencana, lampu, cincin, pikir, posKepala }
    this.logoResmi = new Map(); // kunci keluarga -> HTMLImageElement
    this.terakhir = null;       // argumen setAnggota terakhir, untuk menggambar ulang setelah logo dimuat
    this.pembicara = null;
    this.berpikir = null;
    this.level = 0;             // amplitudo suara 0..1 (diisi pemutar audio)
    this.jam = new THREE.Clock();

    this.bangunRuangan();
    this.pasangKontrol();
    this.muatLogoResmi();
    new ResizeObserver(() => this.ukur()).observe(wadah);
    this.ukur();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  kotak(w, h, d, mat, x, y, z, bayang = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = bayang; m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  bangunRuangan() {
    const s = this.scene;
    const kotak = this.kotak.bind(this);

    // ---- cahaya: hangat dan lembut; lampu gantung cincin di atas meja, cahaya senja dari jendela ----
    s.add(new THREE.HemisphereLight('#ffe9cf', '#24180f', 0.6));
    const utama = new THREE.PointLight('#ffd7a8', 24, 14, 1.6);
    utama.position.set(0, 3.4, 0);
    utama.castShadow = true;
    utama.shadow.mapSize.set(1024, 1024);
    utama.shadow.bias = -0.0008;
    s.add(utama);
    const senja = new THREE.DirectionalLight('#f3c79a', 0.55);
    senja.position.set(0, 3.5, -6);
    s.add(senja);

    // ---- lantai parket dan karpet berbingkai ----
    const parket = teksturKanvas(512, 512, (g) => {
      g.fillStyle = '#3d2a1f'; g.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 32) {
        for (let x = -64; x < 512; x += 128) {
          const o = (y / 32) % 2 ? 64 : 0;
          const v = 40 + ((x * 7 + y * 13) % 30 + 30) % 30;
          g.fillStyle = `rgb(${v + 38},${v + 12},${v - 8})`;
          g.fillRect(x + o, y, 126, 30);
        }
      }
      g.globalAlpha = 0.08; g.fillStyle = '#000';
      for (let i = 0; i < 400; i++) g.fillRect((i * 97) % 512, (i * 61) % 512, 40, 1);
    });
    parket.wrapS = parket.wrapT = THREE.RepeatWrapping;
    parket.repeat.set(6, 5);
    const lantai = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), new THREE.MeshStandardMaterial({ map: parket, roughness: 0.55, metalness: 0.05 }));
    lantai.rotation.x = -Math.PI / 2; lantai.position.z = 0.5; lantai.receiveShadow = true; s.add(lantai);
    const karpet = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ color: '#5b2e25', roughness: 1 }));
    karpet.rotation.x = -Math.PI / 2; karpet.scale.set(4.5, 3.3, 1); karpet.position.y = 0.006; karpet.receiveShadow = true; s.add(karpet);
    const tepiKarpet = new THREE.Mesh(new THREE.RingGeometry(0.93, 0.97, 64), new THREE.MeshStandardMaterial({ color: '#c49a5e', roughness: 0.9 }));
    tepiKarpet.rotation.x = -Math.PI / 2; tepiKarpet.scale.set(4.5, 3.3, 1); tepiKarpet.position.y = 0.008; s.add(tepiKarpet);

    // ---- dinding ----
    const dindingM = new THREE.MeshStandardMaterial({ color: '#2f241e', roughness: 0.95 });
    const belakang = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), dindingM);
    belakang.position.set(0, 2.5, -6); belakang.receiveShadow = true; s.add(belakang);
    for (const sx of [-1, 1]) {
      const sisi = new THREE.Mesh(new THREE.PlaneGeometry(13, 5), dindingM);
      sisi.rotation.y = -sx * Math.PI / 2; sisi.position.set(sx * 7.5, 2.5, 0.5); sisi.receiveShadow = true; s.add(sisi);
    }

    // jendela besar: langit senja, matahari, dua lapis gedung dengan jendela menyala
    const langit = teksturKanvas(1024, 400, (g) => {
      const lg = g.createLinearGradient(0, 0, 0, 400);
      lg.addColorStop(0, '#26304f'); lg.addColorStop(0.5, '#b8694a'); lg.addColorStop(0.8, '#efb57c'); lg.addColorStop(1, '#f6d3a1');
      g.fillStyle = lg; g.fillRect(0, 0, 1024, 400);
      g.fillStyle = 'rgba(255,236,200,.9)'; g.beginPath(); g.arc(700, 300, 38, 0, Math.PI * 2); g.fill();
      for (let lapis = 0; lapis < 2; lapis++) {
        for (let i = 0; i < 44; i++) {
          const w = 16 + (i * 37 + lapis * 11) % 34;
          const h = (lapis ? 60 : 110) + (i * 53 + lapis * 29) % (lapis ? 150 : 120);
          const x = i * 24 + lapis * 9;
          g.fillStyle = lapis ? '#171221' : '#3a2c3c';
          g.fillRect(x, 400 - h, w, h);
          if (lapis) {
            g.fillStyle = 'rgba(255,214,150,.55)';
            for (let j = 0; j < 6; j++) g.fillRect(x + 4 + (j % 2) * 7, 400 - h + 12 + j * 18, 3, 5);
          }
        }
      }
    });
    const jendela = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.3), new THREE.MeshBasicMaterial({ map: langit }));
    jendela.position.set(0, 2.45, -5.97); s.add(jendela);
    const kusen = new THREE.MeshStandardMaterial({ color: '#16110e', roughness: 0.4, metalness: 0.4 });
    for (const x of [-3.8, -1.9, 0, 1.9, 3.8]) kotak(0.07, 3.4, 0.08, kusen, x, 2.45, -5.93, false);
    for (const y of [0.78, 4.12]) kotak(7.7, 0.08, 0.1, kusen, 0, y, -5.93, false);

    // pilar batu di kiri-kanan jendela, dengan lampu dinding
    const batu = new THREE.MeshStandardMaterial({ color: '#d8cbb8', roughness: 0.7 });
    for (const x of [-4.4, 4.4]) {
      kotak(0.5, 4.6, 0.4, batu, x, 2.3, -5.75);
      kotak(0.62, 0.14, 0.5, batu, x, 0.07, -5.75);
      kotak(0.62, 0.14, 0.5, batu, x, 4.55, -5.75);
      const kap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.22, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: '#e9c48c', emissive: '#ffcf8a', emissiveIntensity: 1.1, side: THREE.DoubleSide }));
      kap.position.set(x, 2.6, -5.48); s.add(kap);
      const l = new THREE.PointLight('#ffc98a', 3, 4, 1.8); l.position.set(x, 2.6, -5.3); s.add(l);
    }

    // panel kayu bilah: dinding belakang di luar jendela dan kedua dinding samping
    const bilah = new THREE.MeshStandardMaterial({ color: '#6a4632', roughness: 0.6 });
    for (let x = 4.85; x < 7.4; x += 0.16) {
      kotak(0.07, 4.4, 0.06, bilah, x, 2.3, -5.94, false);
      kotak(0.07, 4.4, 0.06, bilah, -x, 2.3, -5.94, false);
    }
    for (const sx of [-1, 1]) {
      for (let z = -5.6; z < 1.2; z += 0.16) kotak(0.06, 4.4, 0.07, bilah, sx * 7.46, 2.3, z, false);
    }

    // rak buku di dinding samping
    const rakM = new THREE.MeshStandardMaterial({ color: '#3b2619', roughness: 0.6 });
    const warnaBuku = ['#7b3b2c', '#2f4f5f', '#a07a3a', '#4d3a5c', '#3d5a40', '#c8b48f', '#8a4f2f'].map((w) => new THREE.MeshStandardMaterial({ color: w, roughness: 0.8 }));
    for (const sx of [-1, 1]) {
      const x = sx * 7.2;
      // rak terbuka: panel belakang, dua sisi, atap, dan papan-papan rak
      kotak(0.04, 3.2, 2.6, rakM, sx * 7.4, 1.6, -2.4, false);
      for (const z of [-3.7, -1.1]) kotak(0.45, 3.2, 0.05, rakM, x, 1.6, z);
      kotak(0.45, 0.06, 2.65, rakM, x, 3.2, -2.4);
      for (let lv = 0; lv < 5; lv++) {
        const y = 0.35 + lv * 0.62;
        kotak(0.42, 0.04, 2.55, rakM, x, y, -2.4, false);
        let z = -3.6;
        let i = lv * 3 + (sx > 0 ? 1 : 0);
        while (z < -1.25) {
          const tebal = 0.05 + ((i * 7) % 5) * 0.012;
          const tinggi = 0.36 + ((i * 11) % 4) * 0.045;
          kotak(0.26, tinggi, tebal, warnaBuku[i % warnaBuku.length], x - sx * 0.06, y + 0.02 + tinggi / 2, z + tebal / 2, false);
          z += tebal + 0.006; i++;
          if (i % 9 === 0) z += 0.18; // celah kecil di rak
        }
      }
    }

    // ---- plafon berkaset dengan downlight ----
    const plafon = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), new THREE.MeshStandardMaterial({ color: '#2a201a', roughness: 1 }));
    plafon.rotation.x = Math.PI / 2; plafon.position.set(0, 4.7, 0.5); s.add(plafon);
    const balok = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.8 });
    for (let x = -6; x <= 6; x += 3) kotak(0.12, 0.18, 13, balok, x, 4.6, 0.5, false);
    for (let z = -5; z <= 5.4; z += 2.6) kotak(15, 0.18, 0.12, balok, 0, 4.6, z, false);
    const downM = new THREE.MeshBasicMaterial({ color: '#ffe8c4' });
    for (const x of [-4.5, -1.5, 1.5, 4.5]) for (const z of [-3.7, -1.1, 1.5]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), downM);
      d.rotation.x = Math.PI / 2; d.position.set(x, 4.5, z); s.add(d);
    }

    // lampu gantung: dua cincin oval bercahaya di atas meja
    const cincinM = new THREE.MeshStandardMaterial({ color: '#d9b27a', emissive: '#ffd59a', emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.6 });
    const cincin = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 12, 96), cincinM);
    cincin.rotation.x = Math.PI / 2; cincin.scale.set(1.9, 1.05, 1); cincin.position.set(0, 3.45, 0); s.add(cincin);
    const cincin2 = cincin.clone(); cincin2.scale.set(1.45, 0.78, 1); cincin2.position.y = 3.6; s.add(cincin2);
    const kabelM = new THREE.MeshBasicMaterial({ color: '#1a1410' });
    for (const [x, z] of [[-1.9, 0], [1.9, 0], [0, -1.05], [0, 1.05]]) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4), kabelM);
      k.position.set(x, 4.05, z); s.add(k);
    }

    // ---- meja oval walnut: inlay batu terang dan tepi kuningan ----
    const kayu = new THREE.MeshStandardMaterial({ color: '#5e3a28', roughness: 0.38, metalness: 0.05 });
    const atas = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.09, 96), kayu);
    atas.scale.set(MEJA_A, 1, MEJA_B); atas.position.y = 0.92; atas.castShadow = atas.receiveShadow = true; s.add(atas);
    const inlay = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.006, 96), new THREE.MeshStandardMaterial({ color: '#7d6a58', roughness: 0.3, metalness: 0.15 }));
    inlay.scale.set(MEJA_A * 0.5, 1, MEJA_B * 0.36); inlay.position.y = 0.966; inlay.receiveShadow = true; s.add(inlay);
    const tepi = new THREE.Mesh(new THREE.TorusGeometry(1, 0.014, 6, 128), new THREE.MeshStandardMaterial({ color: '#c9a35c', roughness: 0.3, metalness: 0.85 }));
    tepi.rotation.x = Math.PI / 2; tepi.scale.set(MEJA_A, MEJA_B, 1); tepi.position.y = 0.92; s.add(tepi);
    const kakiM = new THREE.MeshStandardMaterial({ color: '#2c1d14', roughness: 0.5 });
    for (const x of [-1.3, 1.3]) {
      const kaki = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 0.88, 24), kakiM);
      kaki.scale.set(1, 1, 1.6); kaki.position.set(x, 0.44, 0); kaki.castShadow = true; s.add(kaki);
    }

    // dekorasi meja: dokumen, cangkir, mikrofon konferensi
    const kertas = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.3), new THREE.MeshStandardMaterial({ color: '#f1e9df' }));
    kertas.position.set(0.15, 0.97, KURSI_B - 1.25); kertas.rotation.y = 0.2; s.add(kertas);
    const cangkir = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 16), new THREE.MeshStandardMaterial({ color: '#efe6d7' }));
    cangkir.position.set(-0.45, 1.02, KURSI_B - 1.2); cangkir.castShadow = true; s.add(cangkir);
    const mik = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 32), new THREE.MeshStandardMaterial({ color: '#1f1a17', roughness: 0.4, metalness: 0.5 }));
    mik.position.set(0, 0.99, 0); s.add(mik);
    this.lampuMik = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 6, 48), new THREE.MeshBasicMaterial({ color: '#7fd1ff', transparent: true, opacity: 0.5 }));
    this.lampuMik.rotation.x = Math.PI / 2; this.lampuMik.position.set(0, 1.012, 0); s.add(this.lampuMik);

    // ---- tanaman besar di sudut ----
    const potM = new THREE.MeshStandardMaterial({ color: '#c9b9a4', roughness: 0.6 });
    const daunM = new THREE.MeshStandardMaterial({ color: '#4f7353', roughness: 0.85 });
    for (const x of [-5.6, 5.6]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.62, 20), potM);
      pot.position.set(x, 0.31, -4.9); pot.castShadow = pot.receiveShadow = true; s.add(pot);
      for (let i = 0; i < 9; i++) {
        const daun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), daunM);
        const a = i * 0.7;
        daun.scale.set(0.7, 2.2, 0.35);
        daun.position.set(x + Math.cos(a) * 0.24, 0.95 + (i % 3) * 0.22, -4.9 + Math.sin(a) * 0.22);
        daun.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
        daun.castShadow = true; s.add(daun);
      }
    }
  }

  async muatLogoResmi() {
    try {
      const d = await fetch('/api/logo').then((r) => r.json());
      await Promise.all((d.logo || []).map((f) => new Promise((ok) => {
        const img = new Image();
        img.onload = () => { this.logoResmi.set(f.replace(/\.\w+$/, ''), img); ok(); };
        img.onerror = () => ok();
        img.src = `logo/${f}`;
      })));
      if (this.logoResmi.size && this.terakhir) this.setAnggota(...this.terakhir);
    } catch { /* tanpa logo resmi: pakai logo gambar sendiri */ }
  }

  posisiKursi(sudut) {
    const r = (sudut * Math.PI) / 180;
    return new THREE.Vector3(KURSI_A * Math.cos(r), 0, KURSI_B * Math.sin(r));
  }

  /** list: [{id, nama, keluarga, warna}] - moderator diberi kursi kepala meja. */
  setAnggota(moderator, anggota) {
    this.terakhir = [moderator, anggota];
    for (const a of this.avatar.values()) this.scene.remove(a.grup);
    this.avatar.clear();
    const semua = [{ ...moderator, sudut: 270 }, ...anggota.map((a, i) => ({ ...a, sudut: SUDUT_ANGGOTA[i % SUDUT_ANGGOTA.length] }))];
    for (const a of semua) this.tambahAvatar(a);
  }

  tambahAvatar(a) {
    const grup = new THREE.Group();
    const pos = this.posisiKursi(a.sudut);
    grup.position.copy(pos);
    grup.lookAt(0, 0, 0);
    const logo = infoLogo(a);

    // Kursi eksekutif: dudukan & sandaran kulit, garis warna merek, sandaran tangan, kaki bintang krom.
    const kulit = new THREE.MeshStandardMaterial({ color: '#2a1f19', roughness: 0.55, side: THREE.DoubleSide });
    const krom = new THREE.MeshStandardMaterial({ color: '#b9b2aa', roughness: 0.25, metalness: 0.9 });
    const aksen = new THREE.MeshStandardMaterial({ color: logo.warna, roughness: 0.5, emissive: logo.warna, emissiveIntensity: 0.12, side: THREE.DoubleSide });
    const dudukan = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.31, 0.11, 28), kulit);
    dudukan.scale.set(1, 1, 0.92); dudukan.position.set(0, 0.52, 0); dudukan.castShadow = true; grup.add(dudukan);
    // sandaran melengkung di sisi belakang kursi (menjauhi meja = -z lokal)
    const busur = Math.PI * 0.64;
    const awal = Math.PI - busur / 2;
    const sandaran = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.8, 28, 1, true, awal, busur), kulit);
    sandaran.position.set(0, 0.98, 0.04); sandaran.castShadow = true; grup.add(sandaran);
    const garis = new THREE.Mesh(new THREE.CylinderGeometry(0.366, 0.366, 0.05, 28, 1, true, awal, busur), aksen);
    garis.position.set(0, 1.36, 0.04); grup.add(garis);
    for (const sx of [-1, 1]) {
      const tangan = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.42), aksen);
      tangan.position.set(sx * 0.33, 0.75, 0.02); grup.add(tangan);
      const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), krom);
      tiang.position.set(sx * 0.33, 0.64, 0.02); grup.add(tiang);
    }
    const poros = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.42, 12), krom);
    poros.position.set(0, 0.26, 0); grup.add(poros);
    for (let i = 0; i < 5; i++) {
      const kaki = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.32), krom);
      kaki.position.set(Math.sin(i * 1.2566) * 0.15, 0.05, Math.cos(i * 1.2566) * 0.15);
      kaki.rotation.y = i * 1.2566; grup.add(kaki);
    }

    // Lencana mengambang memakai logo keluarga model (resmi bila tersedia di public/logo/), bukan figur manusia.
    const peta = this.logoResmi.has(logo.kunci) ? teksturLogoResmi(logo, this.logoResmi.get(logo.kunci)) : teksturLogo(logo);
    const lencana = new THREE.Sprite(new THREE.SpriteMaterial({ map: peta, depthTest: false, transparent: true }));
    lencana.scale.set(0.76, 0.76, 1); lencana.position.set(0, 1.62, 0.12); lencana.renderOrder = 10; grup.add(lencana);
    const cincin = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.025, 8, 48), new THREE.MeshBasicMaterial({ color: logo.warna, transparent: true, opacity: 0.35 }));
    cincin.position.set(0, 1.62, 0.08); cincin.renderOrder = 9; grup.add(cincin);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tekstur(a.nama, logo.nama, logo.warna), depthTest: false, transparent: true }));
    label.scale.set(0.95, 0.3, 1); label.position.set(0, 2.19, 0); label.renderOrder = 10; grup.add(label);
    const pikir = new THREE.Sprite(new THREE.SpriteMaterial({ map: gelembungPikir(), depthTest: false, transparent: true, opacity: 0 }));
    pikir.scale.set(0.42, 0.21, 1); pikir.position.set(0.34, 2.1, 0); pikir.renderOrder = 11; grup.add(pikir);
    const tangan = new THREE.Sprite(new THREE.SpriteMaterial({ map: gelembungTangan(), depthTest: false, transparent: true, opacity: 0 }));
    tangan.scale.set(0.3, 0.3, 1); tangan.position.set(-0.42, 2.1, 0); tangan.renderOrder = 11; grup.add(tangan);
    const lampu = new THREE.PointLight(logo.warna, 0, 2.6, 1.5);
    lampu.position.set(0, 1.62, 0.38); grup.add(lampu);

    this.scene.add(grup);
    const posLogo = new THREE.Vector3(0, 1.62, 0.12);
    grup.localToWorld(posLogo);
    this.avatar.set(a.id, { grup, lencana, lampu, cincin, pikir, tangan, posKepala: posLogo, fase: Math.random() * 6 });
  }

  setTangan(ids) { this.tangan = new Set(ids); }
  setPembicara(id) { this.pembicara = id; }
  setBerpikir(id) { this.berpikir = id; }
  setLevel(v) { this.level = v; }

  pasangKontrol() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.lihat.seret = true; this.lihat.x = e.clientX; this.lihat.y = e.clientY;
      this.awalKlik = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointerup', (e) => {
      this.lihat.seret = false;
      // klik (bukan seret) pada lencana anggota = menunjuk dia untuk bicara
      const a = this.awalKlik;
      if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 6) {
        const id = this.anggotaDi(e.clientX, e.clientY);
        if (id) this.onKlik?.(id);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (this.lihat.seret) return;
      el.style.cursor = this.anggotaDi(e.clientX, e.clientY) ? 'pointer' : '';
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.lihat.seret) return;
      this.lihat.yaw = Math.max(-1.1, Math.min(1.1, this.lihat.yaw - (e.clientX - this.lihat.x) * 0.004));
      this.lihat.pitch = Math.max(-0.4, Math.min(0.35, this.lihat.pitch - (e.clientY - this.lihat.y) * 0.003));
      this.lihat.x = e.clientX; this.lihat.y = e.clientY;
    });
  }

  /** id anggota yang lencananya ada di titik layar ini, atau null. */
  anggotaDi(x, y) {
    const kotakEl = this.renderer.domElement.getBoundingClientRect();
    const titik = new THREE.Vector2(((x - kotakEl.left) / kotakEl.width) * 2 - 1, -((y - kotakEl.top) / kotakEl.height) * 2 + 1);
    this.raycaster ||= new THREE.Raycaster();
    this.raycaster.setFromCamera(titik, this.camera);
    const peta = new Map([...this.avatar].map(([id, a]) => [a.lencana, id]));
    const kena = this.raycaster.intersectObjects([...peta.keys()], false)[0];
    return kena ? peta.get(kena.object) : null;
  }

  ukur() {
    const w = this.wadah.clientWidth || 1, h = this.wadah.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Pastikan empat anggota pertama + Moderator masuk layar: butuh sudut pandang horizontal sekitar ±42°.
    // Layar lebar cukup 52°, layar sempit/tegak dilebarkan sampai 85°.
    const fovPerlu = (2 * Math.atan(Math.tan((42 * Math.PI) / 180) / (w / h)) * 180) / Math.PI;
    this.camera.fov = Math.max(52, Math.min(85, fovPerlu));
    this.camera.updateProjectionMatrix();
  }

  frame() {
    const t = this.jam.getElapsedTime();
    // kamera menoleh pelan ke pembicara; seret mouse untuk melihat sekeliling (kembali pelan saat dilepas)
    const target = this.avatar.get(this.pembicara)?.posKepala;
    this.fokusTarget.set(0, 1.15, -0.6);
    if (target) this.fokusTarget.lerp(target, 0.75);
    this.fokus.lerp(this.fokusTarget, 0.04);
    if (!this.lihat.seret) { this.lihat.yaw *= 0.985; this.lihat.pitch *= 0.985; }
    const arah = this.fokus.clone().sub(this.kameraPos);
    arah.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.lihat.yaw);
    arah.y += this.lihat.pitch * arah.length();
    this.camera.position.copy(this.kameraPos);
    this.camera.lookAt(this.kameraPos.clone().add(arah));

    for (const [id, a] of this.avatar) {
      const bicara = id === this.pembicara;
      const pikir = id === this.berpikir && !bicara;
      // Lencana bernapas halus, lalu membesar dan bercahaya mengikuti amplitudo suara.
      const pulse = bicara ? 1 + Math.sin(t * 7 + a.fase) * 0.045 + Math.min(1, this.level * 3) * 0.16 : 1 + Math.sin(t * 1.7 + a.fase) * 0.018;
      const skala = 0.76 * pulse;
      a.lencana.scale.set(skala, skala, 1);
      a.lampu.intensity += ((bicara ? 2.5 + Math.min(1, this.level * 3) * 2 : 0.15) - a.lampu.intensity) * 0.1;
      a.cincin.material.opacity += ((bicara ? 0.9 : 0.24) - a.cincin.material.opacity) * 0.1;
      a.cincin.scale.setScalar(pulse);
      a.pikir.material.opacity += ((pikir ? 1 : 0) - a.pikir.material.opacity) * 0.1;
      a.pikir.position.y = 2.06 + Math.sin(t * 2.5) * 0.03;
      // tangan terangkat: ingin bicara (disembunyikan saat dia sendiri sedang bicara)
      const angkat = this.tangan?.has(id) && !bicara;
      a.tangan.material.opacity += ((angkat ? 1 : 0) - a.tangan.material.opacity) * 0.12;
      a.tangan.position.y = 2.1 + (angkat ? Math.abs(Math.sin(t * 3 + a.fase)) * 0.05 : 0);
    }
    // lampu mikrofon di tengah meja menyala saat ada yang bicara
    this.lampuMik.material.opacity += ((this.pembicara ? 0.35 + Math.min(1, this.level * 3) * 0.65 : 0.25) - this.lampuMik.material.opacity) * 0.15;
    this.renderer.render(this.scene, this.camera);
  }
}
