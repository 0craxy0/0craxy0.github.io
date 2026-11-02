(() => {
    const hero = document.querySelector('[data-hero]');
    if (!hero) {
        return;
    }

    const sky = hero.querySelector('.SceneSky');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const speeds = { far: 0.22, middle: 0.16, near: 0.1 };
    const layers = [...hero.querySelectorAll('[data-parallax]')].map(element => ({
        element,
        speed: speeds[element.dataset.parallax] || 0
    }));

    let started = false;
    let visible = true;
    let frame = 0;
    let heroHeight = hero.offsetHeight;

    function start() {
        if (started) {
            return;
        }
        started = true;
        requestAnimationFrame(() => {
            hero.dataset.state = 'ready';
        });
    }

    const skyReady = sky ? sky.decode().catch(() => {}) : Promise.resolve();
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.all([skyReady, fontsReady]).then(start, start);
    window.setTimeout(start, 1200);

    function paint() {
        frame = 0;
        const travel = reducedMotion.matches ? 0 : Math.min(Math.max(window.scrollY, 0), heroHeight);
        layers.forEach(({ element, speed }) => {
            element.style.transform = travel ? `translate3d(0, ${(travel * speed).toFixed(2)}px, 0)` : '';
        });
    }

    function requestPaint() {
        if (!frame && visible) {
            frame = requestAnimationFrame(paint);
        }
    }

    new IntersectionObserver(entries => {
        visible = entries[entries.length - 1].isIntersecting;
        requestPaint();
    }).observe(hero);

    window.addEventListener('scroll', requestPaint, { passive: true });
    window.addEventListener('resize', () => {
        heroHeight = hero.offsetHeight;
        requestPaint();
    }, { passive: true });
    reducedMotion.addEventListener('change', requestPaint);
    requestPaint();
})();
