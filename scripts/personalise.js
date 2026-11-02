(() => {
    const wall = document.querySelector('[data-theme-wall]');
    if (!wall) {
        return;
    }

    const themes = [
        { slug: 'lucid', name: 'Lucid' },
        { slug: 'midnight', name: 'Midnight' },
        { slug: 'paper', name: 'Paper' },
        { slug: 'graphite', name: 'Graphite' },
        { slug: 'ember', name: 'Ember' },
        { slug: 'arctic', name: 'Arctic' },
        { slug: 'obsidian', name: 'Obsidian' },
        { slug: 'sakura', name: 'Sakura' },
        { slug: 'fjord', name: 'Fjord' },
        { slug: 'lucid-light', name: 'Lucid Light' },
        { slug: 'moss', name: 'Moss' },
        { slug: 'rosewood', name: 'Rosewood' }
    ];
    const columnCount = 4;
    const copyCount = 4;
    const rowsPerCopy = themes.length / columnCount;
    const speeds = [17, -13, 20, -15];
    const startFractions = [0.12, 0.58, 0.34, 0.86];
    const restPitch = 16;
    const restYaw = -14;
    const tiltRange = 6;
    const planeScale = 1.06;
    const reducedMotion = window.Lucid?.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)');

    const pointer = { left: 0, top: 0 };
    const tilt = { left: 0, top: 0 };
    let plane = null;
    let tracks = [];
    let offsets = [];
    let velocities = [];
    let period = 0;
    let frame = 0;
    let lastTime = 0;
    let visible = false;
    let activeTile = null;
    let hoveredTile = null;
    let pinnedTile = null;
    let heldColumn = -1;

    function wrap(value) {
        return ((value % period) + period) % period;
    }

    function createTile(theme, order) {
        const tile = document.createElement('figure');
        const image = document.createElement('img');
        const caption = document.createElement('figcaption');
        tile.className = 'ThemeTile';
        tile.dataset.theme = theme.slug;
        tile.style.setProperty('--TileOrder', String(order));
        image.src = `assets/images/product/themes/${theme.slug}.webp`;
        image.alt = '';
        image.width = 380;
        image.height = 228;
        image.decoding = 'async';
        image.draggable = false;
        caption.className = 'ThemeName';
        caption.textContent = theme.name;
        tile.append(image, caption);
        return tile;
    }

    function measure() {
        const tiles = tracks[0].children;
        const previous = period;
        period = tiles[rowsPerCopy].offsetTop - tiles[0].offsetTop;
        if (previous > 0 && period > 0) {
            offsets = offsets.map(offset => (offset / previous) * period);
        }
    }

    function paintPlane() {
        const pitch = restPitch - tilt.top * tiltRange;
        const yaw = restYaw + tilt.left * tiltRange;
        plane.style.transform = `rotateX(${pitch.toFixed(3)}deg) rotateY(${yaw.toFixed(3)}deg) scale(${planeScale})`;
    }

    function paintTracks() {
        tracks.forEach((track, index) => {
            const shift = period / 2 - offsets[index];
            track.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
        });
    }

    function canAnimate() {
        return visible && period > 0 && !reducedMotion.matches && !document.hidden;
    }

    function tick(now) {
        frame = 0;
        if (!canAnimate()) {
            lastTime = 0;
            return;
        }
        const elapsed = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
        lastTime = now;
        const tiltBlend = 1 - Math.exp(-elapsed / 0.35);
        tilt.left += (pointer.left - tilt.left) * tiltBlend;
        tilt.top += (pointer.top - tilt.top) * tiltBlend;
        tracks.forEach((track, index) => {
            const held = heldColumn === index;
            const blend = 1 - Math.exp(-elapsed / (held ? 0.3 : 0.9));
            velocities[index] += ((held ? 0 : speeds[index]) - velocities[index]) * blend;
            offsets[index] = wrap(offsets[index] + velocities[index] * elapsed);
        });
        paintPlane();
        paintTracks();
        frame = requestAnimationFrame(tick);
    }

    function sync() {
        if (canAnimate()) {
            if (!frame) {
                lastTime = 0;
                frame = requestAnimationFrame(tick);
            }
            return;
        }
        cancelAnimationFrame(frame);
        frame = 0;
    }

    function select(tile) {
        if (tile === activeTile) {
            return;
        }
        activeTile?.removeAttribute('data-state');
        activeTile = tile;
        if (tile) {
            tile.dataset.state = 'active';
            wall.dataset.focus = 'true';
            heldColumn = Number(tile.parentElement.dataset.column);
            return;
        }
        delete wall.dataset.focus;
        heldColumn = -1;
    }

    function tileFrom(target) {
        return target instanceof Element ? target.closest('.ThemeTile') : null;
    }

    function resetTilt() {
        pointer.left = 0;
        pointer.top = 0;
        tilt.left = 0;
        tilt.top = 0;
        paintPlane();
    }

    function build() {
        plane = document.createElement('div');
        plane.className = 'ThemePlane';
        tracks = Array.from({ length: columnCount }, (empty, columnIndex) => {
            const track = document.createElement('div');
            const column = themes.filter((theme, index) => index % columnCount === columnIndex);
            track.className = 'ThemeTrack';
            track.dataset.column = String(columnIndex);
            for (let copy = 0; copy < copyCount; copy += 1) {
                column.forEach((theme, rowIndex) => track.append(createTile(theme, columnIndex + rowIndex)));
            }
            plane.append(track);
            return track;
        });
        wall.append(plane);
        measure();
        offsets = startFractions.map(fraction => fraction * period);
        velocities = speeds.map(() => 0);
        paintPlane();
        paintTracks();

        new IntersectionObserver(entries => {
            entries.forEach(entry => {
                visible = entry.isIntersecting;
                if (entry.intersectionRatio >= 0.2 && wall.dataset.state !== 'live') {
                    wall.dataset.state = 'live';
                }
                sync();
            });
        }, { threshold: [0, 0.2] }).observe(wall);

        new ResizeObserver(() => {
            measure();
            paintTracks();
        }).observe(wall);

        wall.addEventListener('pointermove', event => {
            if (event.pointerType === 'touch') {
                return;
            }
            const bounds = wall.getBoundingClientRect();
            if (!reducedMotion.matches) {
                pointer.left = (event.clientX - bounds.left) / bounds.width - 0.5;
                pointer.top = (event.clientY - bounds.top) / bounds.height - 0.5;
            }
            hoveredTile = tileFrom(event.target) || hoveredTile;
            select(pinnedTile || hoveredTile);
        }, { passive: true });

        wall.addEventListener('pointerleave', () => {
            pointer.left = 0;
            pointer.top = 0;
            hoveredTile = null;
            select(pinnedTile);
        });

        wall.addEventListener('click', event => {
            const tile = tileFrom(event.target);
            pinnedTile = tile && tile !== pinnedTile ? tile : null;
            select(pinnedTile || hoveredTile);
        });

        document.addEventListener('pointerdown', event => {
            if (pinnedTile && !wall.contains(event.target)) {
                pinnedTile = null;
                select(hoveredTile);
            }
        }, { passive: true });

        document.addEventListener('visibilitychange', sync);
        reducedMotion.addEventListener('change', () => {
            resetTilt();
            sync();
        });
    }

    if (window.Lucid) {
        window.Lucid.whenVisible(wall, build, { threshold: 0, rootMargin: '900px 0px' });
    } else {
        build();
    }
})();
