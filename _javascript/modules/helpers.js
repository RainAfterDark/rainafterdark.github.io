const WORKER_DIR = "/assets/js/dist/workers";

export function loadWorker(name) {
    return new Worker(`${WORKER_DIR}/${name}.min.js`);
}

export function rand(min, max) {
    return Math.random() * (max - min) + min;
}

export function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randNormal(mu, sigma) {
    let sum = 0;
    for (let i = 0; i < 6; i += 1) {
        sum += rand(-1, 1);
    }
    return mu + sigma * sum / 6;
}

export function normalPDF(x, mu, sigma) {
    const sigma2 = Math.pow(sigma, 2);
    const numerator = Math.exp(-Math.pow((x - mu), 2) / (2 * sigma2));
    const denominator = Math.sqrt(2 * Math.PI * sigma2);
    return numerator / denominator;
}

export function lerp(a, b, n) {
    return a + ((b - a) * n);
}

export function clamp (n, min, max) {
    return Math.max(Math.min(n, max), min);
}

export function scaleVector(v, s) {
    v.x *= s;
    v.y *= s;
}

export function normalizeVector(v) {
    let m = Math.sqrt((v.x * v.x) + (v.y * v.y));
    scaleVector(v, 1 / m);
}

export function getNow() {
    return Date.now();
}

export function fixMermaids() { // hack to update the mermaids
    modeToggle.notify(); 
}

export function fixNav() { // because we made the sidebar turbo-permanent we need to do this here
    let navItems = document.querySelectorAll(".nav-item");
    for (let i = 0; i < navItems.length; i++) {
        let nav = navItems[i];
        if (nav.firstElementChild.getAttribute("href") === window.location.pathname) {
            nav.classList.add("active");
            continue;
        }
        nav.classList.remove("active");
    }
}

export function fixModeToggle() { // nuke the evenListeners because they keep stacking on load
    let modeToggle = document.getElementById("mode-toggle");
    modeToggle.replaceWith(modeToggle.cloneNode(true));
}

export function deviceHasPointer() {
    return window.matchMedia("(pointer: fine)").matches;
}