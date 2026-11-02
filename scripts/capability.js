(() => {
    const scene = document.querySelector('[data-board]');
    if (!scene || !window.Lucid) {
        return;
    }

    const squares = [...scene.querySelectorAll('.BoardSquare')];

    squares.forEach((square, index) => {
        const image = square.querySelector('img');
        if (image && image.alt) {
            square.dataset.name = image.alt;
        }
        square.style.setProperty('--TileOrder', String(index));
    });

    if (Lucid.reducedMotion.matches || !squares.length) {
        return;
    }

    scene.dataset.state = 'waiting';

    Lucid.whenVisible(scene, () => {
        scene.dataset.state = 'visible';
    }, { threshold: 0.35 });
})();
