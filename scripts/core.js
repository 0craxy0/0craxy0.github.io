(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

    const easing = {
        linear: progress => progress,
        outCubic: progress => 1 - Math.pow(1 - progress, 3),
        outQuart: progress => 1 - Math.pow(1 - progress, 4),
        outQuint: progress => 1 - Math.pow(1 - progress, 5),
        outExpo: progress => (progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress)),
        inOutCubic: progress => (progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2),
        outBack: progress => {
            const overshoot = 1.4;
            const shifted = progress - 1;
            return 1 + (overshoot + 1) * Math.pow(shifted, 3) + overshoot * Math.pow(shifted, 2);
        }
    };

    function tween({ from = 0, to = 1, duration = 600, delay = 0, ease = easing.outCubic, onUpdate, onComplete } = {}) {
        let frame = 0;
        let cancelled = false;

        if (reducedMotion.matches || duration <= 0) {
            onUpdate?.(to, 1);
            onComplete?.();
            return { cancel() {} };
        }

        const startTime = performance.now() + delay;
        const step = now => {
            if (cancelled) {
                return;
            }
            const progress = Math.min(1, Math.max(0, now - startTime) / duration);
            onUpdate?.(from + (to - from) * ease(progress), progress);
            if (progress < 1) {
                frame = requestAnimationFrame(step);
            } else {
                onComplete?.();
            }
        };
        frame = requestAnimationFrame(step);

        return {
            cancel() {
                cancelled = true;
                cancelAnimationFrame(frame);
            }
        };
    }

    function toList(targets) {
        if (typeof targets === 'string') {
            return [...document.querySelectorAll(targets)];
        }
        if (targets instanceof Element) {
            return [targets];
        }
        return [...targets];
    }

    function whenVisible(targets, callback, { threshold = 0.2, rootMargin = '0px 0px -8% 0px', once = true } = {}) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    return;
                }
                callback(entry.target, entry);
                if (once) {
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold, rootMargin });
        toList(targets).forEach(element => observer.observe(element));
        return observer;
    }

    function formatNumber(value, decimals) {
        return value.toFixed(decimals);
    }

    function countUp(element, { duration = 1600, delay = 0, ease = easing.outQuart } = {}) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) {
            if (/\d/.test(walker.currentNode.nodeValue)) {
                textNodes.push({ node: walker.currentNode, original: walker.currentNode.nodeValue });
            }
        }
        if (!textNodes.length) {
            return { cancel() {} };
        }
        if (!element.hasAttribute('aria-label') && !element.closest('[aria-hidden="true"]')) {
            element.setAttribute('aria-label', element.textContent.replace(/\s+/g, ' ').trim());
        }
        const render = progress => {
            textNodes.forEach(({ node, original }) => {
                node.nodeValue = original.replace(/\d+(?:\.\d+)?/g, match => {
                    const decimals = match.includes('.') ? match.split('.')[1].length : 0;
                    const target = Number(match);
                    const smoothDecimals = decimals === 0 && target < 10 && progress < 1 ? 1 : decimals;
                    return formatNumber(target * progress, smoothDecimals);
                });
            });
        };
        render(0);
        return tween({
            duration,
            delay,
            ease,
            onUpdate: render,
            onComplete: () => textNodes.forEach(({ node, original }) => {
                node.nodeValue = original;
            })
        });
    }

    function assignRevealOrder(scope = document) {
        scope.querySelectorAll('[data-reveal-group]').forEach(group => {
            const members = [...group.querySelectorAll('[data-reveal]')].filter(item => item.parentElement.closest('[data-reveal-group]') === group);
            members.forEach((item, index) => item.style.setProperty('--RevealOrder', String(index)));
        });
    }

    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.setAttribute('data-revealed', '');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    function reveal(scope = document) {
        assignRevealOrder(scope);
        scope.querySelectorAll('[data-reveal]:not([data-revealed])').forEach(element => revealObserver.observe(element));
    }

    function prepareCounters(scope = document) {
        scope.querySelectorAll('[data-count]').forEach(element => {
            whenVisible(element, target => countUp(target, {
                duration: Number(target.dataset.countDuration) || 1600,
                delay: Number(target.dataset.countDelay) || 0
            }), { threshold: 0.4 });
        });
    }

    window.Lucid = {
        root,
        easing,
        tween,
        whenVisible,
        countUp,
        reveal,
        reducedMotion,
        finePointer
    };

    reveal();
    prepareCounters();
})();
