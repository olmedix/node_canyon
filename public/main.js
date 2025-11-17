const ws = new WebSocket("wss://node-canyon.onrender.com/ws");


let distanciaCm = 0;
const MAX_CM_DEPTH = 40;
const MIN_CM_DEPTH = 5;
const Z_FAR = 0;
const Z_NEAR = -6;

const cannon = document.getElementById("cannon");
const basket = document.getElementById("basket");

ws.onopen = () => console.log("✅ Conectado\n");
ws.onmessage = (e) => {
  const { distancia, time } = JSON.parse(e.data);
  distanciaCm = distancia;
  console.log(`Distancia: ${distanciaCm} cm`);
};

ws.onclose = () => console.log("❌ Cerrado\n");

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// ========== MOVER CESTA SEGÚN DISTANCIA ========== //
function moveBasket() {
  let d_clamped = clamp(distanciaCm, MIN_CM_DEPTH, MAX_CM_DEPTH); // para rangos fuera de los establecidos
  let t = (d_clamped - MIN_CM_DEPTH) / (MAX_CM_DEPTH - MIN_CM_DEPTH); // convierte rango entre 0 y 1

  let Z_target = Z_NEAR + (Z_FAR - Z_NEAR) * t;

  basket.object3D.position.z = Z_target; // Aplicar la posición al objeto 3D

  requestAnimationFrame(moveBasket);
}
requestAnimationFrame(moveBasket);

// ========== LANZAR BALA DE CAÑON ========== //

AFRAME.registerComponent("cannon-shot", {
  schema: {
    zNear: { type: "number", default: -6 },
    zFar: { type: "number", default: -1 },
    speedZ: { type: "number", default: 2 }, // m/s hacia Z
    up: { type: "number", default: 12 }, // m/s hacia arriba
    cooldown: { type: "number", default: 4000 }, // ms entre disparos
    auto: { type: "boolean", default: true },
    groundY: { type: "number", default: 0 },
    gravity: { type: "number", default: -9.8 },
  },

  init() {
    this._ready = false;

    // en init(), antes de empezar a disparar:
    this.origin = this.origin || new CANNON.Vec3(0, 1.2, -10); // usa tu origin

    // Esperar a que el cuerpo físico exista
    this.el.addEventListener("body-loaded", () => {
      this._ready = true;

      this._timer = setInterval(() => this.fire(), this.data.cooldown);
      // Disparo inicial inmediato
      this.fire();
    });
  },

  remove() {
    if (this._timer) clearInterval(this._timer);
  },

  fire() {
    if (!this._ready || !this.el.body) return;

    const body = this.el.body;
    const origin = this.origin; // <- SIEMPRE este origen

    // Permitir puntuar en este nuevo disparo
    if (window.__resetShotScoreFlag) window.__resetShotScoreFlag();

    // --- Z objetivo aleatorio dentro del rango ---
    const zMin = Math.min(this.data.zNear, this.data.zFar);
    const zMax = Math.max(this.data.zNear, this.data.zFar);
    const zTarget = zMin + (zMax - zMin) * Math.random(); // [-6..0] por ejemplo

    const dz = zTarget - origin.z;
    const speedZ = Math.max(0.001, this.data.speedZ);
    const signZ = dz >= 0 ? 1 : -1;
    const vZ = signZ * speedZ;
    const T = Math.abs(dz) / speedZ; // tiempo para llegar al zTarget

    // --- vy para que aterrice en groundY justo al tiempo T ---
    const g = this.data.gravity; // -9.8
    const y0 = origin.y;
    const yG = this.data.groundY;
    let vy = (yG - y0 - 0.5 * g * T * T) / Math.max(0.001, T);
    vy += this.data.up; // “up” eleva la parábola

    // --- RESET duro al ORIGIN (SIEMPRE) ---
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.position.copy(origin);
    body.quaternion.setFromEuler(0, 0, 0);

    // (opcional, solo para mantener render 100% sincronizado)
    this.el.object3D.position.set(origin.x, origin.y, origin.z);
    this.el.object3D.rotation.set(0, 0, 0);

    // --- Disparo ---
    body.velocity.set(0, vy, vZ);
    body.wakeUp && body.wakeUp();
  },
});

// ========== DETECTAR COLISIONES PARA PUNTUAR ========== //
AFRAME.registerComponent("aabb-hit", {
  schema: { target: { type: "selector" } },
  init() {
    this._hit = false;
    this.boxA = new THREE.Box3();
    this.boxB = new THREE.Box3();
  },
  tick() {
    const targetEl = this.data.target;
    if (!targetEl) return;
    const a = this.el.object3D;
    const b = targetEl.object3D;
    if (!a || !b) return;

    // AABB de ambos objetos (incluye hijos)
    this.boxA.setFromObject(a);
    this.boxB.setFromObject(b);

    // ¿Intersecan?
    if (this.boxA.intersectsBox(this.boxB)) {
      if (!this._hit) {
        const SCORE = document.getElementById("scoreText");
        let current = parseInt(SCORE.getAttribute("value")) || 0;
        SCORE.setAttribute("value", current + 1);
        this._hit = true; // evita spameo mientras siguen tocándose
      }
    } else {
      this._hit = false; // se “arma” de nuevo para el siguiente contacto
    }
  },
});




