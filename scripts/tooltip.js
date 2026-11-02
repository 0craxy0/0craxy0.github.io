(() => {
    const tooltip = document.querySelector('.Tooltip');
    const triggers = [...document.querySelectorAll('[data-coming-soon]')];
    if (!tooltip || !triggers.length) {
        return;
    }

    const gap = 14;
    const margin = 8;
    let activeTrigger = null;
    let hideTimer = 0;

    tooltip.dataset.state = 'hidden';
    tooltip.hidden = false;

    function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
    }

    function textBounds(trigger) {
        const range = document.createRange();
        range.selectNodeContents(trigger);
        return range.getBoundingClientRect();
    }

    function place(trigger) {
        const bounds = trigger.getBoundingClientRect();
        const label = textBounds(trigger);
        const width = tooltip.offsetWidth;
        const height = tooltip.offsetHeight;
        const inline = bounds.width - label.width > width + gap * 3;
        const side = inline ? 'end' : bounds.top - height - gap >= margin ? 'top' : 'bottom';
        const center = bounds.left + bounds.width / 2;
        const left = inline ? label.right + gap : clamp(center - width / 2, margin, window.innerWidth - width - margin);
        const top = {
            end: bounds.top + (bounds.height - height) / 2,
            top: bounds.top - height - gap,
            bottom: bounds.bottom + gap
        }[side];
        tooltip.dataset.side = side;
        tooltip.style.setProperty('--TooltipLeft', `${left.toFixed(1)}px`);
        tooltip.style.setProperty('--TooltipTop', `${clamp(top, margin, window.innerHeight - height - margin).toFixed(1)}px`);
        tooltip.style.setProperty('--TooltipOrigin', `${clamp(center - left, 0, width).toFixed(1)}px`);
    }

    function hide() {
        window.clearTimeout(hideTimer);
        activeTrigger = null;
        tooltip.dataset.state = 'hidden';
    }

    function show(trigger, temporary) {
        window.clearTimeout(hideTimer);
        if (activeTrigger !== trigger || tooltip.dataset.state !== 'visible') {
            activeTrigger = trigger;
            place(trigger);
            tooltip.dataset.state = 'visible';
        }
        if (temporary) {
            hideTimer = window.setTimeout(hide, 2500);
        }
    }

    triggers.forEach(trigger => {
        trigger.addEventListener('pointerenter', event => {
            if (event.pointerType === 'mouse') {
                show(trigger, false);
            }
        });
        trigger.addEventListener('pointerleave', event => {
            if (event.pointerType === 'mouse' && activeTrigger === trigger) {
                hide();
            }
        });
        trigger.addEventListener('focus', () => {
            if (trigger.matches(':focus-visible')) {
                show(trigger, false);
            }
        });
        trigger.addEventListener('blur', () => {
            if (activeTrigger === trigger) {
                hide();
            }
        });
        trigger.addEventListener('click', () => show(trigger, true));
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && activeTrigger) {
            hide();
        }
    });

    window.addEventListener('scroll', () => {
        if (activeTrigger) {
            hide();
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (activeTrigger) {
            hide();
        }
    });
})();
