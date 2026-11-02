(() => {
    const header = document.querySelector('.SiteHeader');
    if (!header) {
        return;
    }

    header.dataset.motion = 'instant';

    const menu = header.querySelector('.HeaderLinks');
    const toggle = header.querySelector('.MenuToggle');
    const links = [...menu.querySelectorAll('.HeaderLink')];
    const hero = document.querySelector('.Hero');
    const lightZones = [...document.querySelectorAll('.LightZone')];
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const compactLayout = window.matchMedia('(width < 48rem)');
    const sectionTargets = {
        Introduction: 'Introduction',
        Community: 'Introduction',
        Capability: 'Introduction',
        Features: 'Introduction',
        Performance: 'Introduction',
        Personalise: 'Introduction',
        Pricing: 'Pricing',
        Questions: 'Questions'
    };

    let menuOpen = false;
    let scrollFrame = 0;
    let activeLink = null;
    let previewLink = null;
    let pinnedLink = null;
    let pinTimer = 0;
    let hiddenAt = 0;
    let remSize = 16;
    let floatingOffset = 0;

    function documentTop(element) {
        let top = 0;
        for (let node = element; node; node = node.offsetParent) {
            top += node.offsetTop;
        }
        return top;
    }

    function measure() {
        const heading = hero?.querySelector('h1');
        const ceiling = window.innerHeight * 0.35;
        remSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        floatingOffset = heading ? Math.min(Math.max(documentTop(heading) - remSize * 5, remSize), ceiling) : ceiling;
    }

    function updateState() {
        const floating = !hero || menuOpen || window.scrollY > floatingOffset;
        const state = floating ? 'floating' : 'top';
        if (header.dataset.state !== state) {
            header.dataset.state = state;
        }
    }

    function updateTheme() {
        if (!themeColor) {
            return;
        }
        const probe = remSize * 2.5;
        const light = lightZones.some(zone => {
            const bounds = zone.getBoundingClientRect();
            return bounds.top <= probe && bounds.bottom > probe;
        });
        const color = light ? '#ffffff' : '#080c13';
        if (themeColor.content !== color) {
            themeColor.content = color;
        }
    }

    function placeIndicator(link) {
        let top = 0;
        let left = 0;
        for (let node = link; node && node !== menu; node = node.offsetParent) {
            top += node.offsetTop;
            left += node.offsetLeft;
        }
        menu.style.setProperty('--IndicatorTop', `${top}px`);
        menu.style.setProperty('--IndicatorLeft', `${left}px`);
        menu.style.setProperty('--IndicatorRight', `${menu.clientWidth - left - link.offsetWidth}px`);
        menu.style.setProperty('--IndicatorBottom', `${menu.clientHeight - top - link.offsetHeight}px`);
    }

    function renderIndicator() {
        const target = previewLink || pinnedLink || activeLink;
        const visible = menu.dataset.indicator === 'visible';
        if (!target) {
            if (visible) {
                menu.dataset.indicator = 'hidden';
                hiddenAt = performance.now();
            }
            return;
        }
        if (!visible && performance.now() - hiddenAt > 240) {
            placeIndicator(target);
            void menu.offsetWidth;
            menu.dataset.indicator = 'visible';
            return;
        }
        menu.dataset.indicator = 'visible';
        placeIndicator(target);
    }

    function setActive(link) {
        if (link === activeLink) {
            return;
        }
        activeLink?.removeAttribute('aria-current');
        activeLink = link;
        activeLink?.setAttribute('aria-current', 'true');
        renderIndicator();
    }

    function linkFor(id) {
        return links.find(link => link.hash === `#${id}`) || null;
    }

    function releasePin() {
        window.clearTimeout(pinTimer);
        if (pinnedLink) {
            pinnedLink = null;
            renderIndicator();
        }
    }

    function watchSections() {
        const sections = Object.keys(sectionTargets)
            .map(id => document.getElementById(id))
            .filter(Boolean);
        if (!hero || !sections.length) {
            return;
        }
        const visibleSections = new Set();
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    visibleSections.add(entry.target);
                } else {
                    visibleSections.delete(entry.target);
                }
            });
            const current = sections.find(section => visibleSections.has(section));
            setActive(current ? linkFor(sectionTargets[current.id]) : null);
        }, { rootMargin: '-40% 0px -59% 0px' });
        sections.forEach(section => observer.observe(section));

        links.filter(link => link.hash && sections.some(section => `#${section.id}` === link.hash)).forEach(link => {
            link.addEventListener('click', () => {
                pinnedLink = link;
                renderIndicator();
                window.clearTimeout(pinTimer);
                pinTimer = window.setTimeout(releasePin, 2000);
            });
        });
        window.addEventListener('scrollend', releasePin);
    }

    function setMenu(open, restoreFocus) {
        if (!toggle || open === menuOpen) {
            return;
        }
        menuOpen = open;
        header.dataset.menu = open ? 'open' : 'closed';
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        updateState();
        if (open) {
            renderIndicator();
            window.requestAnimationFrame(() => links[0]?.focus({ preventScroll: true }));
        } else if (restoreFocus) {
            toggle.focus({ preventScroll: true });
        }
    }

    function scheduleUpdate() {
        if (scrollFrame) {
            return;
        }
        scrollFrame = window.requestAnimationFrame(() => {
            scrollFrame = 0;
            updateState();
            updateTheme();
        });
    }

    menu.querySelectorAll(':scope > li').forEach((item, index) => {
        item.style.setProperty('--ItemOrder', String(index));
    });

    menu.addEventListener('pointerover', event => {
        const link = event.target.closest('.HeaderLink');
        if (event.pointerType !== 'mouse' || !link || link === previewLink) {
            return;
        }
        previewLink = link;
        renderIndicator();
    });

    menu.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'mouse' || !previewLink) {
            return;
        }
        previewLink = null;
        renderIndicator();
    });

    menu.addEventListener('focusin', event => {
        const link = event.target.closest('.HeaderLink');
        if (link && link.matches(':focus-visible')) {
            previewLink = link;
            renderIndicator();
        }
    });

    menu.addEventListener('focusout', event => {
        if (!menu.contains(event.relatedTarget) && previewLink) {
            previewLink = null;
            renderIndicator();
        }
    });

    header.addEventListener('click', event => {
        if (menuOpen && event.target.closest('a[href]')) {
            setMenu(false, false);
        }
    });

    toggle?.addEventListener('click', () => setMenu(!menuOpen, false));

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && menuOpen) {
            setMenu(false, true);
        }
    });

    document.addEventListener('pointerdown', event => {
        if (menuOpen && !header.contains(event.target)) {
            setMenu(false, false);
        }
    });

    header.addEventListener('focusout', event => {
        if (menuOpen && event.relatedTarget && !header.contains(event.relatedTarget)) {
            setMenu(false, false);
        }
    });

    compactLayout.addEventListener('change', () => setMenu(false, false));

    new ResizeObserver(() => renderIndicator()).observe(menu);

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', () => {
        measure();
        scheduleUpdate();
    });
    document.fonts?.ready.then(() => {
        measure();
        scheduleUpdate();
    });

    measure();
    watchSections();
    updateState();
    updateTheme();

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => header.removeAttribute('data-motion'));
    });
})();
