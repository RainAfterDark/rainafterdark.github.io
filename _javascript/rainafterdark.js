// TODO: Modularize this mess
(() => {

const FRAME_RATE               = 60,    // fps
      MAX_LAG                  = 1,     // seconds
      TIME_SCALE               = 100,   // %
      SLOW_MO_MULTIPLIER       = 25,    // %
      SLOW_MO_DURATION         = 0.1,   // seconds
      SLOW_MO_EASING           = 0.2,   // seconds
      CANVAS_DEBUG             = false, // bool

      TYPE_MIN_SPEED           = 50,    // ms/char
      TYPE_PAUSE_OFFSET        = 0,     // %
      TYPE_TURBO_THRESHOLD     = 60,    // %
      TYPE_SKIP_THRESHOLD      = 40,    // %

      WIND_MIN_VELOCITY        = 100,   // px/s
      WIND_MAX_VELOCITY        = 300,   // px/s
      WIND_VELOCITY_VARIANCE   =  50,   // px/s
      WIND_BUFFER_MULTIPLIER   = 300,   // %
      WIND_VELOCITY_MULTIPLIER = 125,   // %

      DROP_COUNT               = 100,   // int
      DROP_MIN_WIDTH           = 1,     // px
      DROP_MAX_WIDTH           = 3,     // px
      DROP_X_BUFFER            = 200,   // px
      DROP_COLOR_CHANCE        = 50,    // %
      DROP_COLOR_LIGHTNESS     = 75,    // %
      DROP_MIN_VELOCITY        = 500,   // px/s
      DROP_MAX_VELOCITY        = 750,   // px/s
      DROP_MIN_LENGTH          = 5,     // px
      DROP_MAX_LENGTH          = 30,    // px
      DROP_LENGTH_MULTIPLIER   = 150,   // %
      DROP_MIN_ALPHA           = 5,     // %
      DROP_MAX_ALPHA           = 25,    // %
      DROP_MIN_SPAWNRATE       = 25,    // %

      SPLASH_MIN_BREAKPOINT    = 80,    // %
      SPLASH_MAX_BREAKPOINT    = 90,    // %
      SPLASH_MIN_RADIUS        = 8,     // px
      SPLASH_MAX_RADIUS        = 16,    // px
      SPLASH_MIN_DURATION      = 0.8,   // seconds
      SPLASH_MAX_DURATION      = 1.6;   // seconds

let stage, stageWrapper, ctx, avatar,
    initialized = false,
    deviceHasPointer = false,
    mouseXD = 0, lastMX = 0, lastMY = 0,

    promises = [],
    typers = [],
    tocObserver,
    progressBar,

    gravity = true,
    isFlipping = false,
    isScrolling = false,
    lastScrollTop = 0,
    lastScrollTime = 0,
    lastFlipTime = 0,
    lastSlowTime = 0,
    
    drops = [],
    lastTime = 0,
    elapsedTime = 0;

function randomInteger (min, max) {
    return Math.round((Math.random() * (max - min)) + min);
}

function lerp (a, b, n) { // Linear Interpolation
    return a + ((b - a) * n);
}

function scaleVector (v, s) {
    v.x *= s;
    v.y *= s;
}

function normalizeVector (v) {
    let m = Math.sqrt(v.x * v.x + v.y * v.y);
    scaleVector(v, 1 / m);
}

function randomColor() {
    let h = Math.round(lerp(0, 360, Math.random()));
    let l = Math.random() < DROP_COLOR_CHANCE / 100 ? DROP_COLOR_LIGHTNESS : 100;
    let hsl = `hsl(${h}, 100%, ${l}%, 1)`;
    return hsl;
}

function getNow() {
    return Date.now();
}

function onVisible(element, threshold = 0) {
    let token = {};
    promises.push(token);
    return new Promise((resolve) => {
        const o = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                resolve(entry.intersectionRatio);
                o.disconnect();
            }
        }, { threshold: threshold });

        token.break = () => {
            resolve(false);
            o.disconnect();
        }

        if (element.getBoundingClientRect().bottom <= 0) {
            resolve(-1);
            return;
        }
        o.observe(element);
    });
}

function fixMermaids() { // hack to update the mermaids
    modeToggle.notify(); 
}

function fixNav() { // because we made the sidebar turbo-permanent we need to do this here
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

function fixModeToggle() { // nuke the evenListeners because they keep stacking on load
    if (!initialized) return;
    let modeToggle = document.querySelector("#mode-toggle");
    modeToggle.replaceWith(modeToggle.cloneNode(true));
}

function slowDown() {
    let now = getNow();
    if ((now - lastSlowTime) / 1000 > SLOW_MO_EASING + SLOW_MO_DURATION)
        lastSlowTime = getNow();
}

function updateAvatar() {
    let cl = avatar.classList;
    let flipped = cl.contains("flip");
    if (!gravity && !flipped)
        cl.add("flip");
    else if (gravity && flipped)
        cl.remove("flip");
}

function flipGravity(g) {
    if (gravity === g || !initialized)
        return;
    gravity = g;
    updateAvatar();
    if (!isFlipping)
        slowDown();
    lastFlipTime = getNow();
}

function parallaxTransform(target, invert = false, mult = 1) {
    if (!target) return;
    let i = (invert ? -1 : 1);
    let rect = target.getBoundingClientRect();
    let calcX = -(lastMY - rect.y - (rect.height / 2)) / rect.height * mult * i;
    let calcY = (lastMX - rect.x - (rect.width / 2)) / rect.width * mult * i;
    let transform = "perspective(200px) rotateX(" + calcX + "deg) " + "rotateY(" + calcY + "deg)";
    target.style.transform = transform;
    target.style.webkitTransform = transform;
}

function updateParallax3d() {
    if (!deviceHasPointer) return;
    const targets = document.querySelectorAll(".parallax-3d");
    for (let i = 0; i < targets.length; i++) 
        parallaxTransform(targets[i]);
    parallaxTransform(stageWrapper, true, 2 / 3);
}

function showTailWrappers() {
    const wrappers = document.querySelectorAll(".post-tail-wrapper, #tail-wrapper");
    for (let i = 0; i < wrappers.length; i++) {
        wrappers[i].classList.add("show");
    }
}

function onMJXReady() {
    let token = {};
    promises.push(token);
    return new Promise((resolve) => {
        token.break = () => resolve(false);
        const mjxScript = document.getElementById("MathJax-script");
        if (mjxScript) {
            if (window.MathJax && MathJax.version) {
                resolve("MJX already loaded");
                return;
            }
            window.MathJax.startup = {
                pageReady: () => 
                    MathJax.startup.defaultPageReady()
                    .then(() => resolve("MJX initialized"))
            }
            return;
        }
        resolve("No MJX");
    });
}

function clickToc(e) {
    let hash = e.target.hash;
    let needFinish = true;
    let finishTo = 0;
    for (let i = 0; i < typers.length; i++) {
        if (typers[i].headerHash === hash) {
            needFinish = !typers[i].finished;
            finishTo = i;
            break;
        }
    }
    if (needFinish) {
        for (let i = 0; i <= finishTo; i++) {
            typers[i].finish();
        }
        let correction = setInterval(() => {
            if (getNow() - lastScrollTime > 100) {
                typers[finishTo].original.scrollIntoView();
                clearInterval(correction);
            }
        }, 100);
    }
}

function onTocReady() {
    let token = {};
    promises.push(token);
    return new Promise((resolve) => {
        token.break = () => resolve(false);
        if (document.querySelector("main h2, main h3")) {
            let checkToc = setInterval(() => {
                if (window.tocbot) {
                    tocbot.refresh({ ...tocbot.options,
                        onClick: clickToc,
                    });
                    document.getElementById("toc-wrapper").classList.remove("d-none");
                    resolve("Tocbot!");
                    clearInterval(checkToc);
                }
            }, 100);
            return;
        }
        resolve("No Toc");
    });
}

function updateProgressBar() {
    if (!progressBar) {
        progressBar = new Turbolinks.ProgressBar();
        progressBar.setValue(0);
    }
    let finalProgress = 1;
    if (typers.length > 0) {
        let totalProgress = 0;
        for (let i = 0; i < typers.length; i++)
            totalProgress += typers[i].progress;
        finalProgress = Math.min(totalProgress / typers.length, 1);
        progressBar.show();
    }
    progressBar.setValue(finalProgress);
    if (finalProgress === 1)
        progressBar.hide();
}

class FakeTyper {
    original;
    fakeDiv;
    wrapper;
    nextFakeTyper;

    content = "";
    headerHash = "";
    initialized = false;
    finished = false;

    i = 0;
    lastLen = 0;
    progress = 0;

    constructor (element) {
        this.original = element; 
        this.content = this.original.outerHTML;
        if (this.original.tagName.startsWith("H")) {
            let a = this.original.querySelector("a.anchor");
            if (a) this.headerHash = a.hash;
        }
    }

    init() { // this whole thing is so we can preserve references to the og
        if (this.initialized) return;
        this.fakeDiv = document.createElement("div");
        this.fakeDiv.className = "fake-typer"; // we do a little silly
        this.original.parentNode.insertBefore(this.fakeDiv, this.original);

        this.wrapper = document.createElement("div");
        this.wrapper.className = "temp-wrapper d-none";
        this.original.parentNode.insertBefore(this.wrapper, this.original);
        this.wrapper.appendChild(this.original); // wrap og element in an invisible wrapper
        this.initialized = true;
    }

    type() {
        if (this.finished || !this.initialized) return;
        const rect = document.querySelector("main article div.content").getBoundingClientRect();
        const threshold = rect.bottom + (window.innerHeight * (TYPE_PAUSE_OFFSET / 100));
        const pause = threshold >= window.innerHeight;
        const ratio =  threshold / window.innerHeight;

        const turbo = TYPE_TURBO_THRESHOLD / 100;
        let speed = Math.round(TYPE_MIN_SPEED * (Math.max(ratio, turbo) - turbo) / (1 - turbo));
        let char = () => this.content[this.i];
        let writeImmediately = false;
        
        while (char() === "<") {
            this.i = this.content.indexOf(">", this.i) + 1;
            writeImmediately = true;
        }

        if (!pause) {
            this.fakeDiv.innerHTML = this.content.slice(0, ++this.i);
            this.progress = this.fakeDiv.innerHTML.length / this.content.length;
            writeImmediately = writeImmediately || this.fakeDiv.innerHTML.length <= this.lastLen;
            this.lastLen = this.fakeDiv.innerHTML.length;
        }

        if (this.fakeDiv.innerHTML.length >= this.content.length
            || ratio < TYPE_SKIP_THRESHOLD / 100) {
            this.finish();
            return;
        }

        if (writeImmediately && !pause) {
            this.type();
            return;
        }    
        setTimeout(this.type.bind(this), speed);
    }

    async start() {
        if (this.finished || !this.initialized) return;
        const visibility = await onVisible(this.fakeDiv);
        if (visibility === -1) {
            this.finish(); // finish if above viewport
            return;
        }
        this.type();
    }

    finish() {
        if (this.finished || !this.initialized) return;
        this.finished = true;
        this.progress = 1;
        this.fakeDiv.remove(); // and viola!
        this.wrapper.replaceWith(this.original); // magic!
        if (this.original.className === "mermaid") fixMermaids();
        if (this.nextFakeTyper) this.nextFakeTyper.start();
        else showTailWrappers();
    }
}

async function typewrite() {
    const mjxState = await onMJXReady();
    const tocState = await onTocReady();
    document.querySelector("main").classList.add("show");

    if (!window.location.pathname.startsWith("/posts/") || !mjxState || !tocState) {
        showTailWrappers();
        return;
    }

    const elements = document.querySelectorAll(
        "main article header > h1, " + 
        ".post-desc, .post-meta > span, .post-meta > div > a, " +
        "figcaption, .post-meta > div > span, .post-meta > div > div > span, " +
        "main article div.content > *");

    let skipFrom = 0;
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const typer = new FakeTyper(element);
        if (i > 0) typers[typers.length - 1].nextFakeTyper = typer;
        typers.push(typer);
        if (typer.headerHash && typer.headerHash === window.location.hash) {
            skipFrom = typers.length - 1;
        }
    }

    if (typers.length > 0) {
        for (let i = skipFrom; i < typers.length; i++) 
            typers[i].init();
        typers[skipFrom].start();
    }
}

function reloadReset() {
    for (let i = 0; i < promises.length; i++) {
        if (promises[i])
            promises[i].break();
    }
    promises = [];
    typers = [];

    tocObserver.disconnect();
    tocObserver.observe(document.querySelector(("#access-div")));
}

function initialize() {
    stage = document.getElementById("sidebar-canvas");
    stageWrapper = document.getElementById("sidebar-canvas-wrapper");
    stage.width = stageWrapper.clientWidth;
    stage.height = stageWrapper.clientHeight;
    ctx = stage.getContext("2d");
    ctx.globalCompositeOperation = "lighter";
    avatar = document.getElementById("avatar");
    deviceHasPointer = window.matchMedia("(pointer: fine)").matches;

    const isHover = e => e.parentElement.querySelector(":hover") === e;
    document.addEventListener("mousemove", function checkHover(e) {
        const hovered = isHover(avatar);
        if (hovered !== checkHover.hovered) {
            checkHover.hovered = hovered;
            if (hovered && !gravity)
                flipGravity(true);
        }
        mouseXD = e.clientX / window.innerWidth;
        lastMX = e.clientX;
        lastMY = e.clientY;
    });

    window.addEventListener("scroll", () => {
        let st = window.scrollY  || document.documentElement.scrollTop;
        if (st > lastScrollTop)
            flipGravity(true);
        else if (st < lastScrollTop)
            flipGravity(false);
        lastScrollTop = st <= 0 ? 0 : st;
        if (!isScrolling) slowDown();
        lastScrollTime = getNow();
    });

    tocObserver = new IntersectionObserver(([entry]) => {
        let tocWrapper = document.querySelector("#toc-wrapper");
        if (tocWrapper) // position: sticky "fix" to prevent jitter
            tocWrapper.classList[entry.isIntersecting ? "remove" : "add"]("fixed");
    });

    for (let i = 0; i < DROP_COUNT; i++) {
        drops.push(new Drop());
    }

    document.addEventListener("turbolinks:load", () => {
        reloadReset();
        fixNav();
        fixMermaids();
        fixModeToggle();
        flipGravity(!gravity);
        typewrite();
        initialized = true;
    });

    requestAnimationFrame(update);
    requestAnimationFrame(unknownPleasures);
}

/* Modified version of: https://github.com/geoffb/canvas-rain-demo */
class Drop {
    splash = new Splash();

    constructor() {
        this.init();
        this.y = randomInteger(0, stage.height);
    }

    init() {
        this.scale = Math.random();
        this.color = randomColor();
        this.alpha = lerp(DROP_MIN_ALPHA, DROP_MAX_ALPHA, this.scale) / 100;

        this.width = lerp(DROP_MIN_WIDTH, DROP_MAX_WIDTH, this.scale);
        this.len = lerp(DROP_MIN_LENGTH, DROP_MAX_LENGTH, this.scale);
        this.breakpoint = lerp(SPLASH_MIN_BREAKPOINT, SPLASH_MAX_BREAKPOINT, this.scale) / 100;
        this.spawned = Math.random() <= lerp(DROP_MIN_SPAWNRATE / 100, 1, mouseXD);

        let buffer = DROP_X_BUFFER * lerp(1, WIND_BUFFER_MULTIPLIER / 100, mouseXD);
        this.x = isFlipping !== gravity ? randomInteger(-buffer, stage.width) : randomInteger( 0, stage.width + buffer);
        this.y = isFlipping !== gravity ? -this.len * 2 : (stage.height * this.breakpoint);

        this.vx = WIND_MIN_VELOCITY;
        this.wv = lerp(-WIND_VELOCITY_VARIANCE, WIND_VELOCITY_VARIANCE, Math.random());
        this.vy = lerp(DROP_MIN_VELOCITY, DROP_MAX_VELOCITY, this.scale);
    }

    update(deltaTime) {
        let vm = lerp(1, WIND_VELOCITY_MULTIPLIER / 100, mouseXD);
        this.vx = lerp(WIND_MIN_VELOCITY, WIND_MAX_VELOCITY, mouseXD) + this.wv;
        let down /* and hanging around */ = isFlipping !== gravity;

        if (!this.splash.active) {
            let dir = down ? 1 : -1;
            this.x += this.vx * deltaTime * vm * dir;
            this.y += this.vy * deltaTime * vm * dir;
        }

        if (down && this.y > stage.height * this.breakpoint) {
            this.startSplash();
            this.init();
        } else if (!down  && this.y + this.len < 0) {
            this.init();
            this.startSplash();
        }
        this.splash.update(deltaTime);
    }

    render() {
        this.splash.render();
        if (!this.spawned || this.splash.active)
            return;

        let v = { x: this.vx, y: this.vy };
        normalizeVector(v);
        let len = this.len * lerp(1, DROP_LENGTH_MULTIPLIER / 100, mouseXD);
        len = Math.min((stage.height * this.breakpoint) - this.y, len);
        scaleVector(v, Math.max(len, 0));

        let x2 = this.x + v.x;
        let y2 = this.y + v.y;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width;
        ctx.globalAlpha = this.alpha;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.closePath();
        
        if (CANVAS_DEBUG) {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, 2, 2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.closePath();
        }
    }

    startSplash() {
        if (this.spawned)
            this.splash.start(this.x, this.y, this.color, this.scale);
    }
}

class Splash {
    active = false;
    
    start(x, y, color, scale) {
        this.x = x;
        this.y = y;
        this.color = color;

        this.alpha = lerp(DROP_MIN_ALPHA, DROP_MAX_ALPHA, scale) / 100;
        this.width = lerp(DROP_MIN_WIDTH, DROP_MAX_WIDTH, scale);

        let m = 1 + mouseXD;
        this.maxRadius = lerp(SPLASH_MIN_RADIUS, SPLASH_MAX_RADIUS, scale) * m;
        this.maxTime = lerp(SPLASH_MIN_DURATION, SPLASH_MAX_DURATION, 1 - scale) / m;

        this.t = isFlipping !== gravity ? 0 : this.maxTime;
        this.active = true;
    }

    update(deltaTime) {
        if (!this.active)
            return;
        let down = isFlipping !== gravity;
        let dir = down ? 1 : -1;
        this.t += deltaTime * dir;
        if ((down && this.t >= this.maxTime) || (!down && this.t <= 0))
            this.active = false;
    }

    render() {
        if (!this.active ||
            this.y > stage.height * SPLASH_MAX_BREAKPOINT / 100)
            return;

        let scale = this.t / this.maxTime;
        let radius = this.maxRadius * scale;

        ctx.strokeStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.lineWidth = this.width - (this.width * scale);

        ctx.beginPath();
        ctx.ellipse(this.x, this.y, radius * 4, radius, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();
    }
}

function updateDrops(now, fixedStep) {
    const slowMult = SLOW_MO_MULTIPLIER / 100;
    const slowDeltaTime = (now - lastSlowTime) / 1000;
    let speed = slowMult;
    
    isFlipping = (now - lastFlipTime) / 1000 < SLOW_MO_EASING;
    isScrolling = (now - lastScrollTime) / 1000 < SLOW_MO_EASING;

    if ((!isFlipping && !isScrolling) || slowDeltaTime < SLOW_MO_EASING)
        speed = slowDeltaTime < SLOW_MO_DURATION + SLOW_MO_EASING
        ? lerp(slowMult, 1, 1 - Math.min(slowDeltaTime / SLOW_MO_EASING, 1))
        : lerp(slowMult, 1, Math.min((slowDeltaTime - SLOW_MO_DURATION - SLOW_MO_EASING) / SLOW_MO_EASING, 1));
    
    for (let i = 0; i < drops.length; i++)
        drops[i].update(fixedStep * TIME_SCALE / 100 * speed);
};

function renderDrops() {
    stage.width = stageWrapper.clientWidth;
    stage.height = stageWrapper.clientHeight;
    ctx.save();
    for (let i = 0; i < drops.length; ++i)
        drops[i].render();

    if (CANVAS_DEBUG) {
        ctx.strokeStyle = "rgb(255, 255, 255)";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.moveTo(0, stage.height * (SPLASH_MIN_BREAKPOINT / 100));
        ctx.lineTo(stage.width, stage.height * (SPLASH_MIN_BREAKPOINT / 100));
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.moveTo(0, stage.height * (SPLASH_MAX_BREAKPOINT / 100));
        ctx.lineTo(stage.width, stage.height * (SPLASH_MAX_BREAKPOINT / 100));
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.moveTo(stage.width / 2, 0);
        ctx.lineTo(stage.width / 2, stage.height);
        ctx.stroke();
        ctx.closePath();
    }
    ctx.restore();
};

// Modified version of https://maxhalford.github.io/blog/unknown-pleasures/
function unknownPleasures() {
    const canvas = document.querySelector("#bg-canvas");
    const wrapper = document.querySelector("#bg-canvas-wrapper");
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    const ctx = canvas.getContext("2d");

    // Determine x and y range
    const xMin = 0;
    const xMax = canvas.width;
    const yMin = canvas.height * 0.33;
    const yMax = canvas.height;

    // Determine the number of lines and the number of points per line
    const nLines = 80;
    const nPoints = 80;

    const mx = (xMin + xMax) / 2;
    const dx = (xMax - xMin) / nPoints;
    const dy = (yMax - yMin) / nLines;

    let x = xMin;
    let y = yMin;

    function rand (min, max) {
        return Math.random() * (max - min) + min;
    }

    function randInt (min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randNormal (mu, sigma) {
        let sum = 0;
        for (let i = 0; i < 6; i += 1) {
            sum += rand(-1, 1);
        }
        return mu + sigma * sum / 6;
    }

    function normalPDF (x, mu, sigma) {
        const sigma2 = Math.pow(sigma, 2);
        const numerator = Math.exp(-Math.pow((x - mu), 2) / (2 * sigma2));
        const denominator = Math.sqrt(2 * Math.PI * sigma2);
        return numerator / denominator;
    }

    ctx.fillStyle = "black";
    ctx.strokeStyle = "white";

    const lim = Math.round(lerp(5, 15, mouseXD));
    for (let i = 1; i <= lim; i++) {
        ctx.beginPath();
        const rad = 2 * Math.PI;
        ctx.arc(xMax / 2, yMin, 100 + (Math.random() * lim) + (i * i), rad * Math.random(), rad * Math.random());
        ctx.lineWidth = 1 - (i / lim);
        ctx.stroke();
    }

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(xMax / 2, yMin, 100 + (5 * Math.random() * (1 + mouseXD)), 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillRect(xMin, yMin, xMax, yMax);
    ctx.moveTo(xMin, yMin);
    ctx.lineWidth = 1.2;

    for (let i = 0; i < nLines; i++) {
        const lr = 1 - (i / nLines)
        ctx.globalAlpha = lr;
        ctx.beginPath();
        // Generate random parameters for the line's normal distribution
        const nModes = Math.round(randInt(1, 4) * (1 + mouseXD));
        let mus = [];
        let sigmas = [];
        for (let j = 0; j < nModes; j++) {
            const off = 50 * (1 + mouseXD / 2) * (1 - (i / nLines));
            mus[j] = rand(mx - off, mx + off);
            sigmas[j] = randNormal(24, 30 * (1 + mouseXD / 2));
        }
        let w = y
        for (let k = 0; k < nPoints; k++) {
            x = x + dx;
            let noise = 0;
            for (let l = 0; l < nModes; l++) {
                noise += normalPDF(x, mus[l], sigmas[l]);
            }
            const yy = 0.3 * w + 0.7 * (y - 600 * noise + noise * Math.random() * (200 * (1 + mouseXD)) + Math.random());
            ctx.lineTo(x, yy);
            w = yy;
        }
        // Cover the previous lines
        ctx.fill();
        // Draw the current line
        ctx.stroke();
        // Go to the next line
        x = xMin;
        y = y + dy;
        ctx.moveTo(x, y);
    }

    setTimeout(() => requestAnimationFrame(unknownPleasures), lerp(1000 / 24, 1000 / 12, 1 - mouseXD));
}

function update() {
    const fixedStep = 1 / FRAME_RATE;
    const now = getNow();
    const nowMS = now / 1000;
    const deltaTime = Math.min(nowMS - lastTime, MAX_LAG);

    let shouldRender = false;
    lastTime = nowMS; 
    elapsedTime += deltaTime;

    while (elapsedTime >= fixedStep) {
        updateDrops(now, fixedStep);
        elapsedTime -= fixedStep;
        shouldRender = true;
    }
    
    updateParallax3d();
    updateProgressBar();
    if (shouldRender) renderDrops();
    requestAnimationFrame(update);
};

initialize();

})();