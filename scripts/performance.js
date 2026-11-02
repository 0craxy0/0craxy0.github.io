(() => {
    const core = window.Lucid;
    const section = document.querySelector('.Performance');

    if (!core || !section) {
        return;
    }

    const { tween, easing, whenVisible, reducedMotion } = core;
    const sampleCount = 61;
    const frameCeiling = 80;
    const loadCeiling = 32;
    const legendOrder = ['aether', 'volt', 'synapse', 'potassium'];
    const paintOrder = ['volt', 'synapse', 'potassium', 'aether'];
    const products = {
        aether: { name: 'Aether', token: '--SeriesAether', low: 60, high: 70, seed: 17 },
        volt: { name: 'Volt', token: '--SeriesVolt', low: 2, high: 10, seed: 31 },
        synapse: { name: 'Synapse Z', token: '--SeriesSynapse', low: 12, high: 24, seed: 71 },
        potassium: { name: 'Potassium', token: '--SeriesPotassium', low: 16, high: 28, seed: 53 }
    };

    const motionAllowed = () => !reducedMotion.matches;
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    const fixed = value => value.toFixed(2);

    function createSeries({ seed, low, high }) {
        let state = seed;
        const random = () => {
            state = (state * 16807) % 2147483647;
            return state / 2147483647;
        };
        for (let step = 0; step < 12; step += 1) {
            random();
        }
        const phase = random() * Math.PI * 2;
        const swell = random() * Math.PI * 2;
        let wander = 0;
        const raw = Array.from({ length: sampleCount }, (entry, index) => {
            wander = wander * 0.68 + (random() - 0.5);
            return Math.sin(index * 0.26 + phase) * 0.45 + Math.sin(index * 0.083 + swell) * 0.7 + wander * 0.8;
        });
        const smooth = raw.map((value, index) => (raw[Math.max(0, index - 1)] + value * 2 + raw[Math.min(sampleCount - 1, index + 1)]) / 4);
        const minimum = Math.min(...smooth);
        const maximum = Math.max(...smooth);
        return smooth.map(value => low + ((value - minimum) / (maximum - minimum)) * (high - low));
    }

    function sampleAt(values, index) {
        const last = values.length - 1;
        if (index < 0) {
            return 2 * values[0] - values[1];
        }
        if (index > last) {
            return 2 * values[last] - values[last - 1];
        }
        return values[index];
    }

    function curveAt(values, position) {
        const index = clamp(Math.floor(position), 0, values.length - 2);
        const progress = clamp(position - index, 0, 1);
        const before = sampleAt(values, index - 1);
        const start = values[index];
        const end = values[index + 1];
        const after = sampleAt(values, index + 2);
        return 0.5 * (2 * start + (end - before) * progress + (2 * before - 5 * start + 4 * end - after) * progress ** 2 + (3 * start - before - 3 * end + after) * progress ** 3);
    }

    function seriesMarkup(key) {
        const emphasis = key === 'aether' ? 'selected' : 'rest';
        return `<g class="ChartSeries" data-product="${key}" data-emphasis="${emphasis}"><path class="SeriesLine" pathLength="1"></path><text class="SeriesValue"></text></g>`;
    }

    function tooltipRowMarkup(key) {
        return `<li class="TooltipRow" data-product="${key}"><span>${products[key].name}</span><span class="TooltipValue"></span></li>`;
    }

    function chartMarkup() {
        return [
            '<svg class="ChartCanvas" aria-hidden="true" focusable="false">',
            '<defs><linearGradient id="FrameGradient" x1="0" x2="0" y1="0" y2="1">',
            '<stop class="AreaStop" offset="0" stop-opacity="0.11"></stop>',
            '<stop class="AreaStop" offset="1" stop-opacity="0.03"></stop>',
            '</linearGradient></defs>',
            '<g class="ChartGrid"></g>',
            '<path class="ChartArea" fill="url(#FrameGradient)"></path>',
            paintOrder.map(seriesMarkup).join(''),
            '<g class="ChartCursor"><line class="CursorLine" x1="0" x2="0"></line></g>',
            '</svg>'
        ].join('');
    }

    function tooltipMarkup() {
        return [
            '<div class="ChartTooltip" aria-hidden="true"><p class="TooltipTime"></p><ul class="TooltipList">',
            legendOrder.map(tooltipRowMarkup).join(''),
            '</ul></div>'
        ].join('');
    }

    function setupFrames(card) {
        const figure = card.querySelector('[data-frame-chart]');
        const legend = card.querySelector('[data-legend]');
        const buttons = [...legend.querySelectorAll('[data-product]')];
        const valueNode = card.querySelector('[data-figure-value]');
        const lowNode = card.querySelector('[data-figure-low]');
        const highNode = card.querySelector('[data-figure-high]');
        const subject = card.querySelector('[data-figure-subject]');
        const series = Object.fromEntries(legendOrder.map(key => [key, createSeries(products[key])]));
        const geometry = { width: 0, height: 0, left: 30, right: 0, top: 10, bottom: 0 };

        figure.insertAdjacentHTML('afterbegin', chartMarkup());
        figure.insertAdjacentHTML('beforeend', tooltipMarkup());

        const svg = figure.querySelector('.ChartCanvas');
        const grid = svg.querySelector('.ChartGrid');
        const area = svg.querySelector('.ChartArea');
        const cursor = svg.querySelector('.ChartCursor');
        const cursorLine = svg.querySelector('.CursorLine');
        const groups = new Map([...svg.querySelectorAll('.ChartSeries')].map(group => [group.dataset.product, group]));
        const tooltip = figure.querySelector('.ChartTooltip');
        const tooltipTime = tooltip.querySelector('.TooltipTime');
        const tooltipRows = new Map([...tooltip.querySelectorAll('.TooltipRow')].map(row => [row.dataset.product, row]));
        const tooltipValues = new Map([...tooltipRows].map(([key, row]) => [key, row.querySelector('.TooltipValue')]));
        const pointer = { target: 0, current: 0, tooltip: 0, width: 0, frame: 0, time: 0, visible: false };

        let selected = 'aether';
        let mode = 'rest';
        let areaValues = [...series.aether];
        let areaMotion = null;
        let figureMotion = null;
        let figureLow = products.aether.low;
        let figureHigh = products.aether.high;

        legendOrder.forEach((key, index) => groups.get(key).style.setProperty('--SeriesOrder', String(index)));

        const xAt = index => geometry.left + (index / (sampleCount - 1)) * (geometry.right - geometry.left);
        const yAt = value => geometry.bottom - (value / frameCeiling) * (geometry.bottom - geometry.top);
        const positionAt = left => clamp(((left - geometry.left) / (geometry.right - geometry.left)) * (sampleCount - 1), 0, sampleCount - 1);

        function curvePath(values) {
            const step = xAt(1) - xAt(0);
            const segments = [`M${fixed(xAt(0))} ${fixed(yAt(values[0]))}`];
            for (let index = 0; index < values.length - 1; index += 1) {
                const before = sampleAt(values, index - 1);
                const start = values[index];
                const end = values[index + 1];
                const after = sampleAt(values, index + 2);
                const controls = [xAt(index) + step / 3, yAt(start + (end - before) / 6), xAt(index + 1) - step / 3, yAt(end - (after - start) / 6)];
                segments.push(`C${controls.map(fixed).join(' ')} ${fixed(xAt(index + 1))} ${fixed(yAt(end))}`);
            }
            return segments.join(' ');
        }

        function areaPath(values) {
            return `${curvePath(values)} L${fixed(geometry.right)} ${fixed(geometry.bottom)} L${fixed(geometry.left)} ${fixed(geometry.bottom)} Z`;
        }

        function gridMarkup() {
            const rules = [0, 20, 40, 60, 80].map(value => {
                const top = fixed(yAt(value));
                return `<line class="ChartRule" data-value="${value}" x1="${geometry.left}" x2="${fixed(geometry.right)}" y1="${top}" y2="${top}"></line><text class="ChartAxis" x="${geometry.left - 10}" y="${fixed(yAt(value) + 4)}" text-anchor="end">${value}</text>`;
            });
            const labelTop = fixed(geometry.height - 3);
            const middle = fixed((geometry.left + geometry.right) / 2);
            rules.push(`<text class="ChartAxis" x="${geometry.left}" y="${labelTop}">0s</text>`);
            rules.push(`<text class="ChartAxis" x="${middle}" y="${labelTop}" text-anchor="middle">30s</text>`);
            rules.push(`<text class="ChartAxis" x="${fixed(geometry.right)}" y="${labelTop}" text-anchor="end">60s</text>`);
            return rules.join('');
        }

        function render() {
            geometry.width = Math.max(figure.clientWidth, 240);
            geometry.height = Math.max(figure.clientHeight, 160);
            geometry.right = geometry.width - 28;
            geometry.bottom = geometry.height - 23;
            svg.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`);
            grid.innerHTML = gridMarkup();
            const ends = paintOrder.map(key => ({ key, top: yAt(series[key][sampleCount - 1]) })).sort((first, second) => first.top - second.top);
            ends.forEach((entry, index) => {
                if (index > 0) {
                    entry.top = Math.max(entry.top, ends[index - 1].top + 13);
                }
            });
            ends.forEach(({ key, top }) => {
                const group = groups.get(key);
                const last = series[key][sampleCount - 1];
                const label = group.querySelector('.SeriesValue');
                group.querySelector('.SeriesLine').setAttribute('d', curvePath(series[key]));
                label.setAttribute('x', fixed(geometry.right + 7));
                label.setAttribute('y', fixed(top + 4));
                label.textContent = String(Math.round(last));
            });
            area.setAttribute('d', areaPath(areaValues));
            cursorLine.setAttribute('y1', fixed(geometry.top));
            cursorLine.setAttribute('y2', fixed(geometry.bottom));
            pointer.width = tooltip.offsetWidth;
            if (pointer.visible) {
                pointer.target = clamp(pointer.target, geometry.left, geometry.right);
                pointer.current = clamp(pointer.current, geometry.left, geometry.right);
                paintCursor();
            }
        }

        function paintFigure() {
            lowNode.textContent = String(Math.round(figureLow));
            highNode.textContent = String(Math.round(figureHigh));
        }

        function animateFigure(low, high, { duration, delay = 0, ease }) {
            const startLow = figureLow;
            const startHigh = figureHigh;
            figureMotion?.cancel();
            figureMotion = tween({
                duration,
                delay,
                ease,
                onUpdate: amount => {
                    figureLow = startLow + (low - startLow) * amount;
                    figureHigh = startHigh + (high - startHigh) * amount;
                    paintFigure();
                }
            });
        }

        function morphArea(target) {
            const origin = [...areaValues];
            const spread = 0.5;
            areaMotion?.cancel();
            areaMotion = tween({
                duration: 780,
                ease: easing.linear,
                onUpdate: progress => {
                    areaValues = origin.map((value, index) => {
                        const local = clamp(progress * (1 + spread) - (index / (sampleCount - 1)) * spread, 0, 1);
                        return value + (target[index] - value) * easing.inOutCubic(local);
                    });
                    area.setAttribute('d', areaPath(areaValues));
                }
            });
        }

        function swapSubject(key) {
            const outgoing = [...subject.children].filter(node => !node.hasAttribute('data-leaving'));
            const incoming = document.createElement('span');
            incoming.className = 'SubjectName';
            incoming.dataset.product = key;
            incoming.textContent = products[key].name;
            subject.append(incoming);
            outgoing.forEach(node => {
                node.setAttribute('data-leaving', '');
                node.setAttribute('aria-hidden', 'true');
                if (!motionAllowed()) {
                    node.remove();
                    return;
                }
                const exit = node.animate({ opacity: 0, translate: '0 -0.375rem', filter: 'blur(0.125rem)' }, { duration: 280, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' });
                exit.onfinish = () => node.remove();
            });
            if (motionAllowed()) {
                incoming.animate([
                    { opacity: 0, translate: '0 0.375rem', filter: 'blur(0.125rem)' },
                    { opacity: 1, translate: '0 0', filter: 'blur(0)' }
                ], { duration: 520, delay: 90, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
            }
        }

        function placeIndicator() {
            const button = buttons.find(item => item.dataset.product === selected);
            legend.style.setProperty('--IndicatorTop', `${button.offsetTop}px`);
            legend.style.setProperty('--IndicatorLeft', `${button.offsetLeft}px`);
            legend.style.setProperty('--IndicatorRight', `${legend.clientWidth - button.offsetLeft - button.offsetWidth}px`);
            legend.style.setProperty('--IndicatorBottom', `${legend.clientHeight - button.offsetTop - button.offsetHeight}px`);
        }

        function applyEmphasis() {
            legendOrder.forEach(key => {
                let emphasis = mode === 'focus' ? 'muted' : 'rest';
                if (key === selected) {
                    emphasis = 'selected';
                }
                groups.get(key).dataset.emphasis = emphasis;
                tooltipRows.get(key).dataset.emphasis = emphasis;
            });
            buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.product === selected)));
            placeIndicator();
        }

        function select(key, nextMode) {
            if (key === selected && nextMode === mode) {
                return;
            }
            const changed = key !== selected;
            selected = key;
            mode = nextMode;
            applyEmphasis();
            if (!changed) {
                return;
            }
            figure.style.setProperty('--AreaColor', `var(${products[key].token})`);
            morphArea(series[key]);
            animateFigure(products[key].low, products[key].high, { duration: 640, ease: easing.inOutCubic });
            swapSubject(key);
        }

        function tooltipTarget(left) {
            const gap = 14;
            const right = left + gap;
            if (right + pointer.width <= geometry.width) {
                return right;
            }
            return Math.max(0, left - gap - pointer.width);
        }

        function paintCursor() {
            const position = positionAt(pointer.current);
            cursor.setAttribute('transform', `translate(${fixed(pointer.current)} 0)`);
            legendOrder.forEach(key => {
                const text = `${Math.round(curveAt(series[key], position))} FPS`;
                if (tooltipValues.get(key).textContent !== text) {
                    tooltipValues.get(key).textContent = text;
                }
            });
            const time = `${Math.round(position)}s`;
            if (tooltipTime.textContent !== time) {
                tooltipTime.textContent = time;
            }
            tooltip.style.setProperty('--TooltipLeft', `${pointer.tooltip.toFixed(1)}px`);
        }

        function stepCursor(now) {
            const elapsed = pointer.time ? Math.min(64, now - pointer.time) : 16;
            const follow = motionAllowed() ? 1 - Math.pow(0.72, elapsed / 16.7) : 1;
            const glide = motionAllowed() ? 1 - Math.pow(0.8, elapsed / 16.7) : 1;
            pointer.frame = 0;
            pointer.time = now;
            pointer.current += (pointer.target - pointer.current) * follow;
            if (Math.abs(pointer.target - pointer.current) < 0.15) {
                pointer.current = pointer.target;
            }
            const destination = tooltipTarget(pointer.current);
            pointer.tooltip += (destination - pointer.tooltip) * glide;
            if (Math.abs(destination - pointer.tooltip) < 0.15) {
                pointer.tooltip = destination;
            }
            paintCursor();
            if (pointer.current !== pointer.target || pointer.tooltip !== destination) {
                pointer.frame = requestAnimationFrame(stepCursor);
            } else {
                pointer.time = 0;
            }
        }

        function moveCursor(left) {
            pointer.target = clamp(left, geometry.left, geometry.right);
            if (!pointer.visible) {
                pointer.visible = true;
                pointer.width = tooltip.offsetWidth;
                pointer.current = pointer.target;
                pointer.tooltip = tooltipTarget(pointer.current);
                paintCursor();
                figure.dataset.cursor = 'on';
            }
            if (!pointer.frame) {
                pointer.frame = requestAnimationFrame(stepCursor);
            }
        }

        function hideCursor() {
            pointer.visible = false;
            figure.dataset.cursor = 'off';
        }

        function nearestTo(left, top) {
            const position = positionAt(left);
            const ranked = legendOrder
                .map(key => ({ key, distance: Math.abs(yAt(curveAt(series[key], position)) - top) }))
                .sort((first, second) => first.distance - second.distance);
            const current = ranked.find(entry => entry.key === selected);
            if (mode === 'focus' && current.distance - ranked[0].distance < 10) {
                return selected;
            }
            return ranked[0].key;
        }

        function trackPointer(event) {
            const bounds = svg.getBoundingClientRect();
            const left = ((event.clientX - bounds.left) / bounds.width) * geometry.width;
            const top = ((event.clientY - bounds.top) / bounds.height) * geometry.height;
            moveCursor(left);
            select(nearestTo(left, top), 'focus');
        }

        figure.addEventListener('pointermove', trackPointer);
        figure.addEventListener('pointerdown', trackPointer);
        figure.addEventListener('pointerleave', hideCursor);
        figure.addEventListener('pointercancel', hideCursor);

        card.addEventListener('pointerleave', event => {
            if (event.pointerType === 'mouse' && !legend.querySelector(':focus-visible')) {
                select('aether', 'rest');
            }
        });

        document.addEventListener('pointerdown', event => {
            if (mode === 'focus' && !card.contains(event.target)) {
                select('aether', 'rest');
            }
        });

        buttons.forEach(button => {
            const key = button.dataset.product;
            button.addEventListener('pointerenter', event => {
                if (event.pointerType === 'mouse') {
                    select(key, 'focus');
                }
            });
            button.addEventListener('focus', () => select(key, 'focus'));
            button.addEventListener('click', () => select(key, 'focus'));
        });

        legend.addEventListener('focusout', event => {
            if (!legend.contains(event.relatedTarget) && !card.matches(':hover')) {
                select('aether', 'rest');
            }
        });

        render();
        placeIndicator();
        requestAnimationFrame(() => legend.setAttribute('data-ready', ''));
        new ResizeObserver(() => {
            render();
            placeIndicator();
        }).observe(figure);

        if (motionAllowed()) {
            figureLow = 0;
            figureHigh = 0;
            paintFigure();
        }

        whenVisible(valueNode, () => {
            if (selected === 'aether' && mode === 'rest') {
                animateFigure(products.aether.low, products.aether.high, { duration: 1500, delay: 120, ease: easing.outQuint });
            }
        }, { threshold: 1 });

        whenVisible(figure, () => {
            card.dataset.state = 'drawn';
        }, { threshold: 0.45 });
    }

    function setupLoading(card) {
        const list = card.querySelector('[data-load-list]');
        const rows = [...list.querySelectorAll('[data-seconds]')];
        const aetherRow = rows.find(row => row.dataset.product === 'aether');
        const rivals = rows.filter(row => row !== aetherRow);
        const aetherSeconds = Number(aetherRow.dataset.seconds);
        const track = aetherRow.querySelector('.LoadTrack');
        const headline = card.querySelector('[data-load-figure]');
        const headlineNumber = headline.querySelector('[data-figure-number]');
        const status = card.querySelector('[data-load-status]');
        const hint = card.querySelector('[data-load-hint]');
        const readouts = rows.map(row => ({ node: row.querySelector('.LoadValue'), seconds: Number(row.dataset.seconds) }));
        const easeOut = getComputedStyle(section).getPropertyValue('--EaseOut').trim() || 'cubic-bezier(0.22, 1, 0.36, 1)';
        const pointer = { hovered: null, focused: null, tapped: null, type: 'mouse' };
        const leaveGrace = 80;
        let activeRow = null;
        let graceTimer = 0;
        let countMotion = null;

        list.style.setProperty('--AetherShare', String(aetherSeconds / loadCeiling));
        rows.forEach((row, index) => {
            row.style.setProperty('--Share', String(Number(row.dataset.seconds) / loadCeiling));
            row.style.setProperty('--RowOrder', String(index));
            row.dataset.state = 'rest';
        });

        function comparison(row) {
            const name = row.querySelector('.LoadName').textContent;
            const seconds = Number(row.dataset.seconds);
            return { name, seconds, faster: Math.round((1 - aetherSeconds / seconds) * 100) };
        }

        function lineMarkup(row) {
            if (!row) {
                return `<strong class="FigureValue">${aetherSeconds} seconds</strong><span class="SubjectName" data-product="aether">${products.aether.name}</span>`;
            }
            const { name, faster } = comparison(row);
            return `<strong class="FigureValue">${faster}% faster</strong><span class="SubjectName" data-product="${row.dataset.product}">than ${name}</span>`;
        }

        function swapHeadline(row) {
            const outgoing = [...headline.children].filter(node => !node.hasAttribute('data-leaving'));
            const incoming = document.createElement('span');
            const moving = motionAllowed();
            incoming.className = 'FigureLine';
            incoming.innerHTML = lineMarkup(row);
            headline.append(incoming);
            countMotion?.cancel();
            outgoing.forEach(node => {
                node.setAttribute('data-leaving', '');
                node.setAttribute('aria-hidden', 'true');
                if (!moving) {
                    node.remove();
                    return;
                }
                const exit = node.animate({ opacity: 0, translate: '0 -0.375rem' }, { duration: 180, easing: easeOut, fill: 'forwards' });
                exit.onfinish = () => node.remove();
            });
            incoming.animate([
                { opacity: 0, translate: moving ? '0 0.375rem' : '0 0' },
                { opacity: 1, translate: '0 0' }
            ], { duration: moving ? 260 : 180, delay: moving ? 50 : 0, easing: easeOut, fill: 'backwards' });
        }

        function announce(row) {
            if (!row) {
                status.textContent = '';
                return;
            }
            const { name, seconds, faster } = comparison(row);
            status.textContent = `Aether loads the script ${faster}% faster than ${name}, in ${aetherSeconds} seconds instead of ${seconds}.`;
        }

        function activate(row) {
            if (row === activeRow) {
                return;
            }
            activeRow = row;
            rows.forEach(item => {
                let state = 'rest';
                if (row && item !== aetherRow) {
                    state = item === row ? 'active' : 'muted';
                }
                item.dataset.state = state;
            });
            swapHeadline(row);
            announce(row);
        }

        function wantedRow() {
            const keyboard = pointer.focused?.matches(':focus-visible') ? pointer.focused : null;
            return pointer.hovered || keyboard || pointer.tapped;
        }

        function settle() {
            clearTimeout(graceTimer);
            const next = wantedRow();
            if (next) {
                activate(next);
                return;
            }
            graceTimer = setTimeout(() => activate(wantedRow()), leaveGrace);
        }

        rivals.forEach(row => {
            row.addEventListener('pointerenter', event => {
                if (event.pointerType === 'mouse') {
                    pointer.hovered = row;
                    settle();
                }
            });
            row.addEventListener('pointerleave', event => {
                if (event.pointerType === 'mouse' && pointer.hovered === row) {
                    pointer.hovered = null;
                    settle();
                }
            });
            row.addEventListener('focus', () => {
                pointer.focused = row;
                settle();
            });
            row.addEventListener('blur', () => {
                if (pointer.focused === row) {
                    pointer.focused = null;
                }
                settle();
            });
            row.addEventListener('click', () => {
                if (pointer.type !== 'mouse') {
                    pointer.tapped = row;
                    settle();
                }
            });
        });

        list.addEventListener('pointerdown', event => {
            pointer.type = event.pointerType;
        });

        document.addEventListener('pointerdown', event => {
            if (pointer.tapped && !rivals.some(row => row.contains(event.target))) {
                pointer.tapped = null;
                settle();
            }
        });

        function measure() {
            list.style.setProperty('--TrackWidth', `${track.clientWidth}px`);
        }

        function updateHint() {
            hint.textContent = core.finePointer.matches ? 'Select a bar to compare it with Aether' : 'Tap a bar to compare it with Aether';
        }

        measure();
        new ResizeObserver(measure).observe(track);
        updateHint();
        core.finePointer.addEventListener('change', updateHint);

        if (motionAllowed()) {
            readouts.forEach(({ node }) => {
                node.textContent = '0s';
            });
            headlineNumber.textContent = '0';
        }

        whenVisible(headline, () => {
            if (!headlineNumber.isConnected || headlineNumber.closest('[data-leaving]')) {
                return;
            }
            countMotion = tween({
                duration: 1300,
                delay: 120,
                ease: easing.outQuint,
                onUpdate: amount => {
                    headlineNumber.textContent = String(Math.round(aetherSeconds * amount));
                }
            });
        }, { threshold: 1 });

        whenVisible(list, () => {
            card.dataset.state = 'drawn';
            readouts.forEach(({ node, seconds }, index) => {
                tween({
                    duration: 1500,
                    delay: 200 + index * 110,
                    ease: easing.outQuint,
                    onUpdate: amount => {
                        node.textContent = `${Math.round(seconds * amount)}s`;
                    }
                });
            });
        }, { threshold: 0.45 });
    }

    const framesCard = section.querySelector('[data-benchmark="frames"]');
    const loadingCard = section.querySelector('[data-benchmark="loading"]');

    if (framesCard) {
        setupFrames(framesCard);
    }

    if (loadingCard) {
        setupLoading(loadingCard);
    }
})();
