document.documentElement.classList.add('MotionReady');

window.setTimeout(() => {
    if (!window.Lucid) {
        document.documentElement.classList.remove('MotionReady');
    }
    document.querySelectorAll('[data-hero]:not([data-state])').forEach(hero => {
        hero.dataset.state = 'ready';
    });
}, 2500);
