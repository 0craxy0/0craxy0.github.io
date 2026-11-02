(() => {
    const cards = [...document.querySelectorAll('[data-plan]')];
    if (!cards.length) {
        return;
    }

    const interactive = 'a, button, input, select, textarea, label';
    const enter = card => card.setAttribute('data-state', 'entered');

    function createSlot(digit, order) {
        const slot = document.createElement('span');
        const reel = document.createElement('span');
        slot.className = 'PriceDigit';
        slot.dataset.digit = digit;
        slot.style.setProperty('--DigitOrder', String(order));
        slot.style.setProperty('--DigitTarget', digit);
        reel.className = 'DigitReel';
        for (let value = 0; value <= 9; value += 1) {
            const glyph = document.createElement('span');
            glyph.textContent = String(value);
            reel.append(glyph);
        }
        slot.append(reel);
        return slot;
    }

    function buildOdometer(amount) {
        const walker = document.createTreeWalker(amount, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let order = 0;
        while (walker.nextNode()) {
            if (/\d/.test(walker.currentNode.nodeValue)) {
                textNodes.push(walker.currentNode);
            }
        }
        textNodes.forEach(node => {
            const fragment = document.createDocumentFragment();
            [...node.nodeValue].forEach(character => {
                if (/\d/.test(character)) {
                    fragment.append(createSlot(character, order));
                    order += 1;
                } else {
                    fragment.append(character);
                }
            });
            node.replaceWith(fragment);
        });
    }

    function followPlan(card, event) {
        const link = card.querySelector('a[href]');
        if (!link || event.target.closest(interactive) || String(window.getSelection()).trim()) {
            return;
        }
        if (event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey) {
            window.open(link.href, '_blank', 'noopener');
            return;
        }
        link.click();
    }

    cards.forEach(card => {
        card.addEventListener('click', event => followPlan(card, event));
        card.addEventListener('auxclick', event => {
            if (event.button === 1) {
                followPlan(card, event);
            }
        });
    });

    if (!window.Lucid) {
        cards.forEach(enter);
        return;
    }

    if (!window.Lucid.reducedMotion.matches) {
        document.querySelectorAll('[data-price]').forEach(buildOdometer);
    }

    window.Lucid.whenVisible(cards, enter, { threshold: 0.25 });
})();
