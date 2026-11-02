(() => {
    const gallery = document.querySelector('[data-gallery]');
    if (!gallery) {
        return;
    }

    const stage = gallery.querySelector('[data-gallery-stage]');
    const cards = [...stage.querySelectorAll('[data-gallery-card]')];
    const tabs = [...gallery.querySelectorAll('[role="tab"]')];
    const previousButton = gallery.querySelector('[data-gallery-previous]');
    const nextButton = gallery.querySelector('[data-gallery-next]');
    const hero = gallery.closest('[data-hero]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const count = cards.length;
    const stiffness = 80;
    const damping = 17.5;
    const restingPitch = 9;
    const holds = new Set(document.hidden ? ['intro', 'offscreen', 'hidden'] : ['intro', 'offscreen']);

    let position = 0;
    let velocity = 0;
    let target = 0;
    let activeIndex = 0;
    let pitch = restingPitch;
    let pitchTarget = restingPitch;
    let frame = 0;
    let lastFrame = 0;
    let drag = null;
    let suppressClick = false;
    let lastWheel = 0;
    let autoplay = !reducedMotion.matches;

    function wrapIndex(value) {
        return ((value % count) + count) % count;
    }

    function shortest(delta) {
        const wrapped = wrapIndex(delta);
        return wrapped > count / 2 ? wrapped - count : wrapped;
    }

    function paint() {
        cards.forEach((card, index) => {
            const offset = shortest(index - position);
            const shown = offset > -0.75 && offset < 2.4;
            card.style.setProperty('--Offset', offset.toFixed(4));
            if (card.inert === shown) {
                card.inert = !shown;
            }
        });
        stage.style.setProperty('--Pitch', `${pitch.toFixed(3)}deg`);
    }

    function normalize() {
        const shift = Math.floor(target / count) * count;
        if (shift) {
            target -= shift;
            position -= shift;
        }
    }

    function tick(now) {
        const elapsed = Math.min(0.05, Math.max(0, now - lastFrame) / 1000);
        lastFrame = now;
        if (!drag || !drag.active) {
            let remaining = elapsed;
            while (remaining > 0) {
                const slice = Math.min(remaining, 1 / 240);
                velocity += (stiffness * (target - position) - damping * velocity) * slice;
                position += velocity * slice;
                remaining -= slice;
            }
            if (Math.abs(target - position) < 0.0005 && Math.abs(velocity) < 0.005) {
                position = target;
                velocity = 0;
            }
        }
        pitch += (pitchTarget - pitch) * (1 - Math.exp(-elapsed * 9));
        if (Math.abs(pitchTarget - pitch) < 0.01) {
            pitch = pitchTarget;
        }
        paint();
        const moving = Boolean(drag && drag.active) || position !== target || pitch !== pitchTarget;
        if (moving) {
            frame = requestAnimationFrame(tick);
        } else {
            frame = 0;
            normalize();
        }
    }

    function request() {
        if (!frame) {
            lastFrame = performance.now();
            frame = requestAnimationFrame(tick);
        }
    }

    function select(index) {
        activeIndex = index;
        tabs.forEach((tab, tabIndex) => {
            const selected = tabIndex === index;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        cards.forEach((card, cardIndex) => {
            if (cardIndex === index) {
                card.removeAttribute('aria-hidden');
                card.tabIndex = 0;
            } else {
                card.setAttribute('aria-hidden', 'true');
                card.removeAttribute('tabindex');
            }
        });
    }

    function settleInstantly() {
        position = target;
        velocity = 0;
        paint();
    }

    function go(index) {
        const destination = wrapIndex(index);
        if (destination === activeIndex) {
            return;
        }
        target += shortest(destination - activeIndex);
        select(destination);
        if (reducedMotion.matches) {
            settleInstantly();
            return;
        }
        request();
    }

    function refresh() {
        gallery.dataset.playing = String(autoplay && holds.size === 0);
        stage.setAttribute('aria-live', autoplay ? 'off' : 'polite');
    }

    function hold(reason, active) {
        if (active) {
            holds.add(reason);
        } else {
            holds.delete(reason);
        }
        refresh();
    }

    function updatePitch(snap = false) {
        if (reducedMotion.matches) {
            pitchTarget = restingPitch;
        } else {
            const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.6)));
            pitchTarget = restingPitch * (1 - progress);
        }
        if (snap) {
            pitch = pitchTarget;
        }
        request();
    }

    previousButton.addEventListener('click', () => go(activeIndex - 1));
    nextButton.addEventListener('click', () => go(activeIndex + 1));
    tabs.forEach((tab, index) => tab.addEventListener('click', () => go(index)));

    gallery.addEventListener('animationend', event => {
        if (event.animationName === 'GalleryProgress' && autoplay) {
            go(activeIndex + 1);
        }
    });

    gallery.addEventListener('keydown', event => {
        const fromTab = event.target.closest('[role="tab"]');
        const fromCard = event.target.closest('[data-gallery-card]');
        if (!fromTab && !fromCard) {
            return;
        }
        const steps = { ArrowRight: 1, ArrowLeft: -1 };
        let destination = null;
        if (event.key in steps) {
            destination = activeIndex + steps[event.key];
        } else if (fromTab && event.key === 'Home') {
            destination = 0;
        } else if (fromTab && event.key === 'End') {
            destination = count - 1;
        }
        if (destination === null) {
            return;
        }
        event.preventDefault();
        go(destination);
        (fromTab ? tabs : cards)[activeIndex].focus({ preventScroll: true });
    });

    stage.addEventListener('click', event => {
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        const card = event.target.closest('[data-gallery-card]');
        const index = card ? cards.indexOf(card) : activeIndex;
        go(index === activeIndex ? activeIndex + 1 : index);
    });

    stage.addEventListener('pointerdown', event => {
        suppressClick = false;
        if (event.button !== 0 || !event.isPrimary) {
            return;
        }
        drag = {
            id: event.pointerId,
            originX: event.clientX,
            originY: event.clientY,
            lastX: event.clientX,
            lastTime: event.timeStamp,
            origin: position,
            speed: 0,
            active: false,
            scale: Math.max(120, stage.offsetWidth * 0.55)
        };
    });

    stage.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        if (!drag.active) {
            const travelX = event.clientX - drag.originX;
            const travelY = event.clientY - drag.originY;
            if (Math.abs(travelY) > 12 && Math.abs(travelY) > Math.abs(travelX)) {
                drag = null;
                return;
            }
            if (Math.abs(travelX) < 8) {
                return;
            }
            drag.active = true;
            drag.originX = event.clientX;
            drag.origin = position;
            velocity = 0;
            stage.setPointerCapture(event.pointerId);
            stage.dataset.dragging = 'true';
            hold('drag', true);
        }
        const elapsed = (event.timeStamp - drag.lastTime) / 1000;
        if (elapsed > 0) {
            const instant = -(event.clientX - drag.lastX) / drag.scale / elapsed;
            drag.speed = drag.speed * 0.6 + instant * 0.4;
        }
        drag.lastX = event.clientX;
        drag.lastTime = event.timeStamp;
        position = drag.origin - (event.clientX - drag.originX) / drag.scale;
        request();
    });

    function release(event) {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        const finished = drag;
        drag = null;
        if (!finished.active) {
            return;
        }
        suppressClick = true;
        delete stage.dataset.dragging;
        const fresh = event.timeStamp - finished.lastTime < 120;
        const flick = fresh && Math.abs(finished.speed) > 0.8;
        if (flick) {
            target = finished.speed > 0 ? Math.ceil(position - 0.15) : Math.floor(position + 0.15);
        } else {
            target = Math.round(position);
        }
        velocity = fresh ? Math.max(-4, Math.min(4, finished.speed)) : 0;
        select(wrapIndex(target));
        hold('drag', false);
        if (reducedMotion.matches) {
            settleInstantly();
            return;
        }
        request();
    }

    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    stage.addEventListener('wheel', event => {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 4) {
            return;
        }
        event.preventDefault();
        const now = performance.now();
        const fresh = now - lastWheel > 240;
        lastWheel = now;
        if (fresh) {
            go(activeIndex + Math.sign(event.deltaX));
        }
    }, { passive: false });

    gallery.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse') {
            hold('hover', true);
        }
    });

    gallery.addEventListener('pointerleave', event => {
        if (event.pointerType === 'mouse') {
            hold('hover', false);
        }
    });

    gallery.addEventListener('focusin', event => {
        hold('focus', event.target.matches(':focus-visible'));
    });

    gallery.addEventListener('focusout', event => {
        if (!gallery.contains(event.relatedTarget)) {
            hold('focus', false);
        }
    });

    document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));

    new IntersectionObserver(entries => {
        hold('offscreen', !entries[entries.length - 1].isIntersecting);
        updatePitch(true);
    }, { threshold: 0.3 }).observe(stage);

    window.addEventListener('scroll', () => {
        if (!holds.has('offscreen')) {
            updatePitch();
        }
    }, { passive: true });

    reducedMotion.addEventListener('change', () => {
        autoplay = !reducedMotion.matches;
        settleInstantly();
        updatePitch(true);
        refresh();
    });

    function releaseIntro() {
        window.setTimeout(() => hold('intro', false), 1800);
    }

    if (!hero || hero.dataset.state === 'ready') {
        releaseIntro();
    } else {
        const observer = new MutationObserver(() => {
            if (hero.dataset.state === 'ready') {
                observer.disconnect();
                releaseIntro();
            }
        });
        observer.observe(hero, { attributes: true, attributeFilter: ['data-state'] });
    }

    select(0);
    updatePitch(true);
    paint();
    refresh();
})();
