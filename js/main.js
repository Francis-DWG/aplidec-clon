// Mobile Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
}

if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    });
}

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (mobileMenu && mobileMenu.classList.contains('active')) {
        if (!mobileMenu.contains(e.target) && !menuToggle.contains(e.target)) {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
});

// Cookie Banner
const cookieBanner = document.getElementById('cookieBanner');
const cookieAccept = document.getElementById('cookieAccept');
const cookieReject = document.getElementById('cookieReject');
const cookieConfig = document.getElementById('cookieConfig');

// Check if cookie consent was already given
const cookieConsent = localStorage.getItem('cookieConsent');

if (!cookieConsent && cookieBanner) {
    setTimeout(() => {
        cookieBanner.classList.add('active');
    }, 1000);
}

if (cookieAccept) {
    cookieAccept.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'accepted');
        cookieBanner.classList.remove('active');
    });
}

if (cookieReject) {
    cookieReject.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'rejected');
        cookieBanner.classList.remove('active');
    });
}

if (cookieConfig) {
    cookieConfig.addEventListener('click', () => {
        alert('Configuración de cookies:\n\n' +
              'Técnicas o necesarias: Siempre activas\n' +
              'Analíticas: ' + (cookieConsent === 'accepted' ? 'Activas' : 'Inactivas') + '\n' +
              'Publicidad: Inactivas\n' +
              'Preferencias: Inactivas');
    });
}

// Header scroll effect
const header = document.getElementById('header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.15)';
    } else {
        header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    }
    
    lastScroll = currentScroll;
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Active nav link highlighting
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-desktop a, .nav-mobile a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        link.classList.add('active');
    } else {
        link.classList.remove('active');
    }
});

// Form handling
const contactForm = document.querySelector('.contact-form form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Simple validation
        const nombre = contactForm.querySelector('[name="nombre"]');
        const email = contactForm.querySelector('[name="email"]');
        const telefono = contactForm.querySelector('[name="telefono"]');
        const mensaje = contactForm.querySelector('[name="mensaje"]');

        let isValid = true;

        [nombre, email, telefono, mensaje].forEach(field => {
            if (field && !field.value.trim()) {
                field.style.borderColor = '#e74c3c';
                isValid = false;
            } else if (field) {
                field.style.borderColor = '';
            }
        });

        if (!isValid) {
            alert('Por favor, complete todos los campos obligatorios.');
            return;
        }

        // Simulate sending
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Enviando...';
        submitBtn.disabled = true;

        setTimeout(() => {
            alert('¡Gracias por contactar con nosotros! Le responderemos a la mayor brevedad posible.');
            contactForm.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1500);
    });
}

// Back to top button
const backToTop = document.getElementById('backToTop');
if (backToTop) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 400) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Scroll reveal animations
const revealElements = document.querySelectorAll('.reveal');
if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    revealElements.forEach(el => revealObserver.observe(el));
} else {
    // Fallback: show all if IntersectionObserver not supported
    revealElements.forEach(el => el.classList.add('revealed'));
}

// Interactive paint splatter particles in hero (index only)
(function initPaintParticles() {
    const canvas = document.getElementById('paintCanvas');
    const hero = document.querySelector('.hero');
    if (!canvas || !hero) return;

    // Desactivado con movimiento reducido, punteros táctiles o pantallas pequeñas
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.innerWidth < 768) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const MAX_PARTICLES = 300;
    const MOUSE_THROTTLE_MS = 40;
    const AUTO_SPLATTER_MS = 2000;
    const GRAVITY = 0.05;

    // Colores corporativos con variación de tono (hsl: [hBase, hVar, s, l, lVar])
    const PALETTE = [
        { h: 204, hVar: 12, s: 93, l: 72, lVar: 8 },  // azul corporativo #74c1fb
        { h: 5,   hVar: 10, s: 77, l: 60, lVar: 8 },  // rojo coral #e8574a
        { h: 33,  hVar: 10, s: 87, l: 59, lVar: 8 }   // naranja dorado #f2a33c
    ];

    const particles = [];
    let dpr = 1;
    let lastMouseTime = 0;
    let lastAutoTime = 0;
    let rafId = null;
    let heroVisible = true;

    function randomColor() {
        const c = PALETTE[(Math.random() * PALETTE.length) | 0];
        const h = c.h + (Math.random() * 2 - 1) * c.hVar;
        const l = c.l + (Math.random() * 2 - 1) * c.lVar;
        return 'hsl(' + h.toFixed(0) + ', ' + c.s + '%, ' + l.toFixed(0) + '%)';
    }

    function addParticle(x, y, big) {
        if (particles.length >= MAX_PARTICLES) particles.shift();
        const angle = Math.random() * Math.PI * 2;
        const speed = big ? 0.5 + Math.random() * 2 : 1 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (big ? 0.5 : 1.5),
            size: big ? 4 + Math.random() * 8 : 1 + Math.random() * 3,
            flatten: big ? 0.35 + Math.random() * 0.3 : 0.8 + Math.random() * 0.2,
            rotation: Math.random() * Math.PI,
            color: randomColor(),
            alpha: 0.5 + Math.random() * 0.4,
            decay: 0.008 + Math.random() * 0.012
        });
    }

    function splatter(x, y) {
        addParticle(x, y, true);
        const droplets = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < droplets; i++) {
            addParticle(x + (Math.random() * 2 - 1) * 10, y + (Math.random() * 2 - 1) * 10, false);
        }
    }

    function resizeCanvas() {
        const rect = hero.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 150);
    });

    hero.addEventListener('mousemove', (e) => {
        const now = performance.now();
        if (now - lastMouseTime < MOUSE_THROTTLE_MS) return;
        lastMouseTime = now;
        const rect = hero.getBoundingClientRect();
        splatter(e.clientX - rect.left, e.clientY - rect.top);
    });

    function frame(now) {
        rafId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (now - lastAutoTime >= AUTO_SPLATTER_MS) {
            lastAutoTime = now;
            const rect = hero.getBoundingClientRect();
            splatter(Math.random() * rect.width, Math.random() * rect.height);
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += GRAVITY;
            p.vx *= 0.98;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * p.flatten, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        rafId = requestAnimationFrame(frame);
    }

    function startLoop() {
        if (rafId === null && heroVisible && !document.hidden) {
            rafId = requestAnimationFrame(frame);
        }
    }

    function stopLoop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopLoop();
        else startLoop();
    });

    if ('IntersectionObserver' in window) {
        const heroObserver = new IntersectionObserver((entries) => {
            heroVisible = entries[0].isIntersecting;
            if (heroVisible) startLoop();
            else stopLoop();
        });
        heroObserver.observe(hero);
    }

    resizeCanvas();
    startLoop();
})();
