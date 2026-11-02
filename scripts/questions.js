(() => {
    const list = document.querySelector('[data-accordion]');
    if (!list) {
        return;
    }

    const items = [...list.querySelectorAll(':scope > li')];
    const buttons = items.map(item => item.querySelector('button[aria-controls]'));

    function setState(item, open) {
        const button = item.querySelector('button[aria-controls]');
        const answer = document.getElementById(button.getAttribute('aria-controls'));
        item.setAttribute('data-state', open ? 'open' : 'closed');
        button.setAttribute('aria-expanded', String(open));
        if (answer) {
            answer.inert = !open;
        }
    }

    items.forEach((item, index) => {
        item.style.setProperty('--QuestionOrder', String(index));
        setState(item, item.getAttribute('data-state') === 'open');
    });

    buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
            const opening = items[index].getAttribute('data-state') !== 'open';
            items.forEach((item, itemIndex) => setState(item, opening && itemIndex === index));
        });

        button.addEventListener('keydown', event => {
            const targets = {
                ArrowDown: index + 1,
                ArrowUp: index - 1,
                Home: 0,
                End: buttons.length - 1
            };
            if (!Object.hasOwn(targets, event.key)) {
                return;
            }
            event.preventDefault();
            buttons[(targets[event.key] + buttons.length) % buttons.length].focus();
        });
    });
})();
