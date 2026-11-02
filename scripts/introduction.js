(() => {
    const section = document.querySelector('[data-statement]');
    if (!section || !window.Lucid || Lucid.reducedMotion.matches) {
        return;
    }

    const paragraphs = [...section.querySelectorAll('.Statement')];
    if (!paragraphs.length) {
        return;
    }

    const softness = 5;
    const words = [];

    paragraphs.forEach(paragraph => {
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }
        textNodes.forEach(node => {
            const fragment = document.createDocumentFragment();
            node.nodeValue.split(/(\s+)/).forEach(part => {
                if (!part) {
                    return;
                }
                if (/^\s+$/.test(part)) {
                    fragment.append(part);
                    return;
                }
                const word = document.createElement('span');
                word.className = 'StatementWord';
                word.textContent = part;
                word.style.setProperty('--WordIndex', String(words.length));
                words.push(word);
                fragment.append(word);
            });
            node.replaceWith(fragment);
        });
    });

    let target = 0;
    let current = 0;
    let frame = 0;
    let active = false;

    function measure() {
        const top = paragraphs[0].getBoundingClientRect().top;
        const bottom = paragraphs[paragraphs.length - 1].getBoundingClientRect().bottom;
        const viewport = window.innerHeight;
        const start = viewport * 0.9;
        const finish = viewport * 0.72;
        const travel = start - finish + (bottom - top);
        const progress = Math.min(1, Math.max(0, (start - top) / travel));
        target = progress * (words.length + softness);
    }

    function paint() {
        current += (target - current) * 0.12;
        if (Math.abs(target - current) < 0.02) {
            current = target;
        }
        section.style.setProperty('--Reading', current.toFixed(2));
        frame = current === target ? 0 : requestAnimationFrame(paint);
    }

    function update() {
        measure();
        if (!frame) {
            frame = requestAnimationFrame(paint);
        }
    }

    function updateWhileActive() {
        if (active) {
            update();
        }
    }

    measure();
    current = target;
    section.style.setProperty('--Reading', current.toFixed(2));

    new IntersectionObserver(entries => {
        active = entries.some(entry => entry.isIntersecting);
        update();
    }, { rootMargin: '25% 0px' }).observe(section);

    window.addEventListener('scroll', updateWhileActive, { passive: true });
    window.addEventListener('resize', updateWhileActive, { passive: true });
})();
