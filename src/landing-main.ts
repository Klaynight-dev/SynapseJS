import { mountDemo } from "./landing";

// ── Scroll progress bar ──
const progressBar = document.getElementById("scroll-progress")!;
function updateProgress() {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
}
window.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();

// ── Scroll reveal (with stagger) ──
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("vis");
        revealObs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document
  .querySelectorAll(".rv,.rv-left,.rv-right,.rv-scale")
  .forEach((e) => revealObs.observe(e));

// ── Counter animation ──
const countObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countObs.unobserve(e.target);
      const el = e.target as HTMLElement;
      const target = parseFloat(el.dataset.count!);
      const suffix = el.dataset.suffix || "";
      const decimals = parseInt(el.dataset.decimals || "0");
      const duration = 1200;
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const val = ease * target;
        el.textContent =
          (decimals > 0 ? val.toFixed(decimals) : String(Math.round(val))) +
          suffix;
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  },
  { threshold: 0.5 }
);
document
  .querySelectorAll<HTMLElement>("[data-count]")
  .forEach((e) => countObs.observe(e));

// ── Animated bar fills ──
const barObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      barObs.unobserve(e.target);
      const el = e.target as HTMLElement;
      requestAnimationFrame(() => {
        el.classList.remove("bar-anim");
        el.style.width = el.dataset.bar!;
      });
    });
  },
  { threshold: 0.3 }
);
document.querySelectorAll(".bar-anim").forEach((e) => barObs.observe(e));

// ── Parallax ──
const parallaxEls = document.querySelectorAll<HTMLElement>(".parallax");
let ticking = false;
function updateParallax() {
  const scrollTop = window.scrollY;
  parallaxEls.forEach((el) => {
    const speed = parseFloat(el.dataset.speed || ".2");
    const rect = el.getBoundingClientRect();
    const offset = (rect.top + scrollTop) * speed;
    el.style.transform = "translateY(" + (-offset * 0.15).toFixed(1) + "px)";
  });
  ticking = false;
}
window.addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateParallax);
    }
  },
  { passive: true }
);

// ── Nav shrink on scroll ──
const nav = document.querySelector(".nav")!;
window.addEventListener(
  "scroll",
  () => {
    nav.classList.toggle("scrolled", window.scrollY > 50);
  },
  { passive: true }
);

// ── PM Toggle ──
const cmds: Record<string, string[]> = {
  bun: ["bun install", "bun run dev", "bun run bench", "bun run bench:report"],
  pnpm: ["pnpm install", "pnpm dev", "pnpm bench", "pnpm bench:report"],
  npm: [
    "npm install",
    "npm run dev",
    "npm run bench",
    "npm run bench:report",
  ],
  yarn: ["yarn", "yarn dev", "yarn bench", "yarn bench:report"],
};
document.getElementById("pm-toggle")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".pm-btn");
  if (!btn) return;
  const pm = btn.dataset.pm!;
  document
    .querySelectorAll(".pm-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const c = cmds[pm];
  document.getElementById("cmd-install")!.textContent = c[0];
  document.getElementById("cmd-dev")!.textContent = c[1];
  document.getElementById("cmd-bench")!.textContent = c[2];
  document.getElementById("cmd-report")!.textContent = c[3];
});

// ── Synapse Demo ──
const canvas = document.getElementById("demo-canvas") as HTMLCanvasElement;

function showWebGPUNotAvailable(message?: string) {
  if (canvas && canvas.parentElement) {
    const errorDetails = message ? ` (${message})` : "";
    canvas.parentElement.innerHTML =
      `<div class="demo-nope">WebGPU non disponible dans ce navigateur${errorDetails}.<br>Utilisez Chrome 113+, Edge 113+ ou Firefox Nightly.</div>`;
  }
}

if (!navigator.gpu) {
  showWebGPUNotAvailable();
} else {
  mountDemo(canvas).catch((err) => {
    console.error("Demo mount failed:", err);
    showWebGPUNotAvailable(err instanceof Error ? err.message : String(err));
  });
}
