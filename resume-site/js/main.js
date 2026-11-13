/* ==========================================================================
   رزومه تعاملی یاسین عربی — اسکریپت اصلی
   ماژول‌ها: SpaceCanvas (ذرات سه‌بعدی) / Tilt (کارت‌های سه‌بعدی) /
   Cube3D (مکعب قابل چرخش) / Bizcard (کارت ویزیت) / Reveal / Nav / Taglines
   بدون هیچ وابستگی خارجی — ES5-compatible syntax
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- ابزارهای کمکی ---------- */
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;
  var clamp = function (value, min, max) { return Math.min(Math.max(value, min), max); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ==========================================================================
     ماژول SpaceCanvas — پس‌زمینه ذرات با عمق سه‌بعدی
     ========================================================================== */
  var SpaceCanvas = {
    canvas: null,
    ctx: null,
    particles: [],
    width: 0,
    height: 0,
    dpr: 1,
    rafId: null,
    mouse: { x: 0, y: 0, active: false },

    COLORS: ["34, 211, 238", "167, 139, 250", "244, 114, 182", "148, 163, 216"],

    init: function () {
      this.canvas = document.getElementById("spaceCanvas");
      if (!this.canvas || prefersReducedMotion) return;
      this.ctx = this.canvas.getContext("2d");
      this.resize();
      this.spawn();
      window.addEventListener("resize", this.onResize.bind(this));
      window.addEventListener("pointermove", this.onPointerMove.bind(this), { passive: true });
      window.addEventListener("pointerleave", this.onPointerLeave.bind(this));
      this.rafId = requestAnimationFrame(this.tick.bind(this));
    },

    resize: function () {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = this.width + "px";
      this.canvas.style.height = this.height + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    onResize: function () {
      this.resize();
      this.spawn();
    },

    onPointerMove: function (e) {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    },

    onPointerLeave: function () {
      this.mouse.active = false;
    },

    spawn: function () {
      var count = Math.round(clamp((this.width * this.height) / 14000, 36, 110));
      this.particles = [];
      for (var i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          z: Math.random() * 0.8 + 0.2,          /* عمق: 0 دور تا 1 نزدیک */
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          size: Math.random() * 1.8 + 0.6,
          color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
          twinkle: Math.random() * Math.PI * 2
        });
      }
    },

    tick: function () {
      var ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      /* اتصال نقطه‌های نزدیک — حس شبکه سه‌بعدی */
      ctx.lineWidth = 1;
      for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        for (var j = i + 1; j < this.particles.length; j++) {
          var q = this.particles[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var dist = dx * dx + dy * dy;
          var maxDist = 130 * 130;
          if (dist < maxDist) {
            var alpha = (1 - Math.sqrt(dist) / 130) * 0.32 * Math.min(p.z, q.z);
            ctx.strokeStyle = "rgba(103, 133, 222, " + alpha.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      for (var k = 0; k < this.particles.length; k++) {
        var pt = this.particles[k];
        pt.x += pt.vx * pt.z;
        pt.y += pt.vy * pt.z;
        pt.twinkle += 0.02;

        /* واکنش آرام به ماوس — با عمق متناسب */
        if (this.mouse.active) {
          var mdx = this.mouse.x - pt.x, mdy = this.mouse.y - pt.y;
          var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 170 && mdist > 0.001) {
            var force = (1 - mdist / 170) * 0.045 * pt.z;
            pt.x -= (mdx / mdist) * force * 10;
            pt.y -= (mdy / mdist) * force * 10;
          }
        }

        if (pt.x < -20) pt.x = this.width + 20;
        else if (pt.x > this.width + 20) pt.x = -20;
        if (pt.y < -20) pt.y = this.height + 20;
        else if (pt.y > this.height + 20) pt.y = -20;

        var glow = 0.4 + Math.sin(pt.twinkle) * 0.25;
        var radius = pt.size * pt.z;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + pt.color + ", " + (glow * pt.z).toFixed(3) + ")";
        ctx.fill();
      }

      this.rafId = requestAnimationFrame(this.tick.bind(this));
    }
  };

  /* ==========================================================================
     ماژول Tilt — افکت سه‌بعدی کارت‌ها بر اساس موقعیت ماوس
     ========================================================================== */
  var Tilt = {
    MAX_TILT: 10,   /* حداکثر درجه چرخش */

    init: function () {
      if (prefersReducedMotion || isTouch) return;
      var cards = document.querySelectorAll("[data-tilt]");
      for (var i = 0; i < cards.length; i++) {
        this.bind(cards[i]);
      }
    },

    bind: function (card) {
      card.addEventListener("pointerenter", function () {
        card.classList.add("is-tilting");
      });
      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;    /* 0 تا 1 */
        var py = (e.clientY - rect.top) / rect.height;
        var rx = (0.5 - py) * Tilt.MAX_TILT;              /* چرخش افقی */
        var ry = (px - 0.5) * Tilt.MAX_TILT;              /* چرخش عمودی */
        card.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-4px)";
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.transform = "";
      });
    }
  };

  /* ==========================================================================
     ماژول Cube3D — مکعب قابل چرخش با درگ (ماوس و لمس)
     ========================================================================== */
  var Cube3D = {
    cube: null,
    stage: null,
    rotX: -18,
    rotY: 0,
    velocityX: 0,
    velocityY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    autoSpin: true,
    rafId: null,

    init: function () {
      this.cube = document.getElementById("heroCube");
      this.stage = document.getElementById("cubeStage");
      if (!this.cube || !this.stage) return;

      if (!prefersReducedMotion) {
        this.cube.classList.add("is-auto");
        this.autoSpin = true;
      }

      this.bindDrag();
      this.rafId = requestAnimationFrame(this.tick.bind(this));
    },

    bindDrag: function () {
      var self = this;
      var start = function (x, y) {
        self.dragging = true;
        self.lastX = x;
        self.lastY = y;
        self.autoSpin = false;
        self.cube.classList.remove("is-auto");
        self.cube.style.transition = "none";
      };
      var move = function (x, y) {
        if (!self.dragging) return;
        var dx = x - self.lastX;
        var dy = y - self.lastY;
        self.lastX = x;
        self.lastY = y;
        self.rotY += dx * 0.4;
        self.rotX = clamp(self.rotX - dy * 0.4, -80, 80);
        self.velocityX = -dy * 0.4;
        self.velocityY = dx * 0.4;
      };
      var end = function () {
        if (!self.dragging) return;
        self.dragging = false;
        setTimeout(function () {
          if (!self.dragging) self.autoSpin = true;
        }, 2200);
      };

      this.stage.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        start(e.clientX, e.clientY);
        self.stage.setPointerCapture(e.pointerId);
      });
      this.stage.addEventListener("pointermove", function (e) {
        move(e.clientX, e.clientY);
      });
      this.stage.addEventListener("pointerup", end);
      this.stage.addEventListener("pointercancel", end);
      /* برای لمس: جلوگیری از اسکرول هنگام چرخش مکعب */
      this.stage.style.touchAction = "none";
    },

    tick: function () {
      if (!this.dragging) {
        if (this.autoSpin && !prefersReducedMotion) {
          this.rotY += 0.18;
        } else if (Math.abs(this.velocityX) + Math.abs(this.velocityY) > 0.02) {
          /* اینرسی بعد از رها کردن درگ */
          this.rotY += this.velocityY;
          this.rotX = clamp(this.rotX + this.velocityX, -80, 80);
          this.velocityX *= 0.95;
          this.velocityY *= 0.95;
        }
      }
      this.cube.style.transform =
        "rotateX(" + this.rotX.toFixed(2) + "deg) rotateY(" + this.rotY.toFixed(2) + "deg)";
      this.rafId = requestAnimationFrame(this.tick.bind(this));
    }
  };

  /* ==========================================================================
     ماژول Bizcard — کارت ویزیت با چرخش flip سه‌بعدی
     ========================================================================== */
  var Bizcard = {
    init: function () {
      var card = document.querySelector("[data-tilt-flip]");
      if (!card) return;
      var flipped = false;

      var flip = function (state) {
        flipped = state;
        card.classList.toggle("is-flipped", flipped);
        card.setAttribute("aria-pressed", flipped ? "true" : "false");
      };

      if (isTouch || prefersReducedMotion) {
        /* لمس: کلیک برای flip */
        card.addEventListener("click", function () {
          flip(!flipped);
        });
      } else {
        card.addEventListener("pointerenter", function () { flip(true); });
        card.addEventListener("pointerleave", function () { flip(false); });
      }
    }
  };

  /* ==========================================================================
     ماژول Reveal — انیمیشن ورود بخش‌ها هنگام اسکرول
     ========================================================================== */
  var Reveal = {
    init: function () {
      var items = document.querySelectorAll(".reveal");
      if (!("IntersectionObserver" in window) || prefersReducedMotion) {
        for (var i = 0; i < items.length; i++) items[i].classList.add("is-visible");
        return;
      }
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      for (var j = 0; j < items.length; j++) observer.observe(items[j]);
    }
  };

  /* ==========================================================================
     ماژول Nav — هدر، منوی موبایل، لینک فعال و نوار پیشرفت
     ========================================================================== */
  var Nav = {
    init: function () {
      this.bindToggle();
      this.bindHeaderShadow();
      this.bindScrollProgress();
      this.bindActiveLink();
      this.bindSmoothClose();
    },

    bindToggle: function () {
      var toggle = document.getElementById("navToggle");
      var nav = document.getElementById("mainNav");
      if (!toggle || !nav) return;
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    },

    bindSmoothClose: function () {
      /* بعد از کلیک روی لینک منوی موبایل، منو بسته شود */
      var nav = document.getElementById("mainNav");
      var toggle = document.getElementById("navToggle");
      if (!nav || !toggle) return;
      nav.addEventListener("click", function (e) {
        if (e.target.closest(".nav-link") && window.innerWidth <= 860) {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    },

    bindHeaderShadow: function () {
      var header = document.querySelector(".site-header");
      if (!header) return;
      var onScroll = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 10);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    },

    bindScrollProgress: function () {
      var bar = document.getElementById("scrollProgressBar");
      if (!bar) return;
      var onScroll = function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - doc.clientHeight;
        var ratio = max > 0 ? window.scrollY / max : 0;
        bar.style.width = (ratio * 100).toFixed(2) + "%";
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    },

    bindActiveLink: function () {
      var links = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
      var sections = [];
      links.forEach(function (link) {
        var section = document.querySelector(link.getAttribute("href"));
        if (section) sections.push({ link: link, section: section });
      });
      if (!sections.length || !("IntersectionObserver" in window)) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            sections.forEach(function (s) { s.link.classList.remove("is-active"); });
            var match = sections.filter(function (s) { return s.section === entry.target; })[0];
            if (match) match.link.classList.add("is-active");
          }
        });
      }, { rootMargin: "-42% 0px -52% 0px" });
      sections.forEach(function (s) { observer.observe(s.section); });
    }
  };

  /* ==========================================================================
     ماژول Taglines — چرخش شعارهای قهرمان
     ========================================================================== */
  var Taglines = {
    init: function () {
      var lines = document.querySelectorAll(".tagline");
      if (lines.length < 2 || prefersReducedMotion) return;
      var index = 0;
      setInterval(function () {
        lines[index].classList.remove("is-active");
        index = (index + 1) % lines.length;
        lines[index].classList.add("is-active");
      }, 3400);
    }
  };

  /* ---------- راه‌اندازی ---------- */
  function boot() {
    SpaceCanvas.init();
    Tilt.init();
    Cube3D.init();
    Bizcard.init();
    Reveal.init();
    Nav.init();
    Taglines.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
