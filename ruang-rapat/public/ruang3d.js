// Ruang rapat 3D: meja oval, anggota dewan duduk melingkar, kamera dari kursi Louis.
// Pembicara menyala + mulut bergerak mengikuti suara; anggota yang "berpikir" punya gelembung "...".
import * as THREE from './vendor/three.module.min.js';

const MEJA_A = 2.7;   // jari-jari meja (sumbu x)
const MEJA_B = 1.55;  // jari-jari meja (sumbu z)
const KURSI_A = 3.35;
const KURSI_B = 2.2;
// Sudut kursi (derajat). 90 = depan (Louis/kamera), 270 = seberang meja (moderator).
// Anggota duduk di setengah lingkaran seberang supaya semuanya menghadap Louis dan terlihat di layar.
const SUDUT_ANGGOTA = [222, 318, 182, 358, 150, 30, 245, 295];

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

export class Ruang3D {
  constructor(wadah) {
    this.wadah = wadah;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    wadah.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b1512');
    this.scene.fog = new THREE.Fog('#1b1512', 9, 18);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 50);
    this.kameraPos = new THREE.Vector3(0, 1.85, KURSI_B + 1.05);
    this.camera.position.copy(this.kameraPos);
    this.fokus = new THREE.Vector3(0, 1.15, -0.6);
    this.fokusTarget = this.fokus.clone();
    this.lihat = { yaw: 0, pitch: 0, seret: false, x: 0, y: 0 };

    this.avatar = new Map();   // id -> { grup, kepala, mulut, lampu, label, pikir, mata, posKepala }
    this.pembicara = null;
    this.berpikir = null;
    this.level = 0;            // amplitudo suara 0..1 (diisi pemutar audio)
    this.jam = new THREE.Clock();

    this.bangunRuangan();
    this.pasangKontrol();
    new ResizeObserver(() => this.ukur()).observe(wadah);
    this.ukur();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  bangunRuangan() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#ffe9cf', '#2a1d14', 0.75));
    const lampu = new THREE.PointLight('#ffd7a8', 26, 14, 1.6);
    lampu.position.set(0, 3.6, 0);
    lampu.castShadow = true;
    lampu.shadow.mapSize.set(1024, 1024);
    s.add(lampu);
    const kap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.35, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#2b211b', side: THREE.DoubleSide, roughness: 0.6 }));
    kap.position.set(0, 3.75, 0);
    s.add(kap);
    const bohlam = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color: '#fff1d6' }));
    bohlam.position.set(0, 3.62, 0);
    s.add(bohlam);

    const lantai = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.85 }));
    lantai.rotation.x = -Math.PI / 2;
    lantai.receiveShadow = true;
    s.add(lantai);
    const karpet = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ color: '#5a2f24', roughness: 1 }));
    karpet.rotation.x = -Math.PI / 2;
    karpet.scale.set(4.4, 3.2, 1);
    karpet.position.y = 0.005;
    karpet.receiveShadow = true;
    s.add(karpet);

    // dinding belakang dengan jendela kota senja
    const dinding = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshStandardMaterial({ color: '#2e231d', roughness: 0.95 }));
    dinding.position.set(0, 4, -6);
    s.add(dinding);
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 256);
    lg.addColorStop(0, '#2b3557'); lg.addColorStop(0.55, '#c9774a'); lg.addColorStop(1, '#f2c48a');
    g.fillStyle = lg; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#1a1420';
    for (let i = 0; i < 26; i++) { const w = 12 + (i * 37) % 26, h = 40 + (i * 53) % 120; g.fillRect(i * 20, 256 - h, w, h); }
    const tJendela = new THREE.CanvasTexture(c); tJendela.colorSpace = THREE.SRGBColorSpace;
    const jendela = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), new THREE.MeshBasicMaterial({ map: tJendela }));
    jendela.position.set(0, 2.8, -5.98);
    s.add(jendela);
    const kusen = new THREE.MeshStandardMaterial({ color: '#1c1511' });
    for (const x of [-3.5, -1.17, 1.17, 3.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.3, 0.06), kusen); b.position.set(x, 2.8, -5.95); s.add(b); }

    // meja oval
    const kayu = new THREE.MeshStandardMaterial({ color: '#6b4430', roughness: 0.45, metalness: 0.05 });
    const atas = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.09, 64), kayu);
    atas.scale.set(MEJA_A, 1, MEJA_B);
    atas.position.y = 0.92;
    atas.castShadow = atas.receiveShadow = true;
    s.add(atas);
    const kaki = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.88, 24), new THREE.MeshStandardMaterial({ color: '#3a2519' }));
    kaki.position.y = 0.44;
    kaki.castShadow = true;
    s.add(kaki);
    // dokumen & cangkir di meja (dekoratif)
    const kertas = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.3), new THREE.MeshStandardMaterial({ color: '#f1e9df' }));
    kertas.position.set(0.15, 0.97, KURSI_B - 1.25); kertas.rotation.y = 0.2; s.add(kertas);
    const cangkir = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 16), new THREE.MeshStandardMaterial({ color: '#efe6d7' }));
    cangkir.position.set(-0.45, 1.02, KURSI_B - 1.2); cangkir.castShadow = true; s.add(cangkir);
  }

  posisiKursi(sudut) {
    const r = (sudut * Math.PI) / 180;
    return new THREE.Vector3(KURSI_A * Math.cos(r), 0, KURSI_B * Math.sin(r));
  }

  /** list: [{id, nama, keluarga, warna}] - moderator diberi kursi kepala meja. */
  setAnggota(moderator, anggota) {
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
    const warna = new THREE.Color(a.warna);

    const kursi = new THREE.MeshStandardMaterial({ color: '#241b16', roughness: 0.7 });
    const dudukan = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.58), kursi);
    dudukan.position.set(0, 0.5, 0); dudukan.castShadow = true; grup.add(dudukan);
    const sandaran = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.08), kursi);
    sandaran.position.set(0, 0.95, -0.3); sandaran.castShadow = true; grup.add(sandaran);

    const badan = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.46, 6, 16), new THREE.MeshStandardMaterial({ color: warna, roughness: 0.6 }));
    badan.position.set(0, 0.98, -0.05); badan.castShadow = true; grup.add(badan);

    const kepala = new THREE.Group();
    kepala.position.set(0, 1.55, 0);
    const wajah = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 24), new THREE.MeshStandardMaterial({ color: '#e9cfb4', roughness: 0.7 }));
    wajah.castShadow = true; kepala.add(wajah);
    const rambut = new THREE.Mesh(new THREE.SphereGeometry(0.215, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45),
      new THREE.MeshStandardMaterial({ color: warna.clone().multiplyScalar(0.45), roughness: 0.9 }));
    rambut.rotation.x = -0.25; kepala.add(rambut);
    const mataM = new THREE.MeshBasicMaterial({ color: '#1d1612' });
    const mata = [];
    for (const x of [-0.075, 0.075]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 12), mataM); m.position.set(x, 0.03, 0.19); kepala.add(m); mata.push(m); }
    const mulut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.02), new THREE.MeshBasicMaterial({ color: '#5a2a24' }));
    mulut.position.set(0, -0.075, 0.195); kepala.add(mulut);
    grup.add(kepala);

    const lampu = new THREE.PointLight(warna, 0, 2.4, 1.5);
    lampu.position.set(0, 1.6, 0.45); grup.add(lampu);
    const cincin = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 48), new THREE.MeshBasicMaterial({ color: warna, transparent: true, opacity: 0 }));
    cincin.rotation.x = Math.PI / 2; cincin.position.y = 0.02; grup.add(cincin);

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tekstur(a.nama, a.keluarga || 'moderator', a.warna), depthTest: false, transparent: true }));
    label.scale.set(0.95, 0.3, 1); label.position.set(0, 2.08, 0); label.renderOrder = 10; grup.add(label);
    const pikir = new THREE.Sprite(new THREE.SpriteMaterial({ map: gelembungPikir(), depthTest: false, transparent: true, opacity: 0 }));
    pikir.scale.set(0.42, 0.21, 1); pikir.position.set(0.32, 1.92, 0); pikir.renderOrder = 11; grup.add(pikir);

    this.scene.add(grup);
    const posKepala = new THREE.Vector3();
    kepala.getWorldPosition(posKepala);
    this.avatar.set(a.id, { grup, kepala, mulut, lampu, cincin, pikir, mata, posKepala, fase: Math.random() * 6 });
  }

  setPembicara(id) { this.pembicara = id; }
  setBerpikir(id) { this.berpikir = id; }
  setLevel(v) { this.level = v; }

  pasangKontrol() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this.lihat.seret = true; this.lihat.x = e.clientX; this.lihat.y = e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => { this.lihat.seret = false; });
    el.addEventListener('pointermove', (e) => {
      if (!this.lihat.seret) return;
      this.lihat.yaw = Math.max(-1.1, Math.min(1.1, this.lihat.yaw - (e.clientX - this.lihat.x) * 0.004));
      this.lihat.pitch = Math.max(-0.4, Math.min(0.35, this.lihat.pitch - (e.clientY - this.lihat.y) * 0.003));
      this.lihat.x = e.clientX; this.lihat.y = e.clientY;
    });
  }

  ukur() {
    const w = this.wadah.clientWidth || 1, h = this.wadah.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 68 : 52; // layar sempit/HP: pandangan lebih lebar
    this.camera.updateProjectionMatrix();
  }

  frame() {
    const t = this.jam.getElapsedTime();
    const dt = Math.min(0.05, this.jam.getDelta() || 0.016);
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
      // napas & kedip
      a.kepala.position.y = 1.55 + Math.sin(t * 1.6 + a.fase) * 0.008 + (bicara ? Math.sin(t * 7) * 0.006 : 0);
      a.kepala.rotation.z = bicara ? Math.sin(t * 2.3 + a.fase) * 0.05 : Math.sin(t * 0.7 + a.fase) * 0.02;
      const kedip = (t + a.fase) % 4.2 < 0.12 ? 0.15 : 1;
      for (const m of a.mata) m.scale.y = kedip;
      // mulut mengikuti amplitudo suara
      const buka = bicara ? 0.4 + Math.min(1, this.level * 3.2) * 3.4 : 1;
      a.mulut.scale.y += (buka - a.mulut.scale.y) * 0.35;
      a.lampu.intensity += ((bicara ? 3.2 : 0) - a.lampu.intensity) * 0.08;
      a.cincin.material.opacity += ((bicara ? 0.85 : 0) - a.cincin.material.opacity) * 0.08;
      a.pikir.material.opacity += ((pikir ? 1 : 0) - a.pikir.material.opacity) * 0.1;
      a.pikir.position.y = 1.92 + Math.sin(t * 2.5) * 0.03;
    }
    void dt;
    this.renderer.render(this.scene, this.camera);
  }
}
