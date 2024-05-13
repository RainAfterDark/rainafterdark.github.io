/* Modified version of: https://github.com/geoffb/canvas-rain-demo */

(function () {

const FRAME_RATE               = 60,    // fps
      MAX_LAG                  = 1,     // seconds
      TIME_SCALE               = 100,   // %
      SLOW_MO_MULTIPLIER       = 25,    // %
      SLOW_MO_DURATION         = 0.1,   // seconds
      SLOW_MO_EASING           = 0.2,   // seconds
      CANVAS_DEBUG             = false, // bool

      TYPE_SPEED               = 20,    // ms/char
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

    gravity = true,
    isFlipping = false,
    isScrolling = false,
    lastScrollTop = 0,
    lastScrollTime = 0,
    lastFlipTime = 0,
    lastSlowTime = 0,
    
    drops = [],
    promises = [],
    typers = [],
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
    return new Promise((resolve, reject) => {
        const o = new IntersectionObserver(([entry]) => {
            token.break = () => {
                reject(new Error("A promise meant to broken..."));
                o.disconnect();
            }
            if (entry.isIntersecting) {
                resolve();
                o.disconnect();
            }
        }, { threshold: threshold });
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

function parallax3d() {
    if (!deviceHasPointer) return;
    const targets = document.querySelectorAll(".parallax-3d");
    for (let i = 0; i < targets.length; i++) 
        parallaxTransform(targets[i]);
    parallaxTransform(stageWrapper, true, 2 / 3);
}

function showTailWrappers() {
    const wrappers = document.querySelectorAll(".post-tail-wrapper, #tail-wrapper");
    for (let i = 0; i < wrappers.length; i++) {
        wrappers[i].classList.add("show-tail-wrapper");
    }
}

class Typer {
    fakeDiv;
    next;
    content = "";
    finished = false;
    isHeader = false;
    isTooltip = false;
    isMermaid = false;
    i = 0;
    lastLen = 0;
    caret = false;

    constructor (element) {
        const fakeDiv = document.createElement("div");
        fakeDiv.className = "fake-typer"
        element.parentNode.insertBefore(fakeDiv, element);
        fakeDiv.appendChild(element);

        const tag = element.tagName;
        this.isHeader = tag.startsWith("H") && element.firstElementChild;
        this.isMermaid = element.className === "mermaid";
        this.isTooltip = element.getAttribute("data-bs-toggle") === "tooltip";

        this.fakeDiv = fakeDiv;
        this.content = this.fakeDiv.innerHTML;
        this.fakeDiv.innerHTML = "";
    }

    type() {
        const rect = document.querySelector("main article div.content").getBoundingClientRect();
        const threshold = rect.bottom + (window.innerHeight * (TYPE_PAUSE_OFFSET / 100));
        const pause = threshold >= window.innerHeight;
        const ratio =  threshold / window.innerHeight;

        let speed = Math.round(TYPE_SPEED * ratio);
        var char = () => this.content[this.i];
        let writeImmediately = false;
        
        while (char() === "<") {
            this.i = this.content.indexOf(">", this.i) + 1;
            writeImmediately = true;
        }

        if (!pause) {
            this.i++;
            if (ratio < TYPE_TURBO_THRESHOLD / 100) {
                speed = 0;
                while (this.i + 1 < this.content.length && !/\w/.test(char()))
                    this.i++; // type words instead of chars
            }
            this.fakeDiv.innerHTML = this.content.slice(0, this.i);
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

    start() {
        if (this.finished) return;
        this.caretInterval = setInterval(() => {
            this.caret = !this.caret;
        }, 500);
        onVisible(this.fakeDiv).then(() => {
            this.type();
        }).catch(() => {});
    }

    finish() {
        this.finished = true;
        clearInterval(this.caretInterval);
        this.fakeDiv.innerHTML = this.content; // fix typing artifacts
        
        const shimmer = this.fakeDiv.querySelectorAll(".shimmer");
        for (let i = 0; i < shimmer.length; i++)
            shimmer[i].classList.remove("shimmer"); // from img lazy loading

        const element = this.fakeDiv.firstElementChild;
        this.fakeDiv.replaceWith(element); // unwrap
        if (this.isTooltip) new bootstrap.Tooltip(element);

        if (this.isHeader) {
            let tocWrapper = document.getElementById("toc-wrapper");
            if (tocWrapper.classList.contains("d-none")) {
                tocbot.init({
                    tocSelector: '#toc',
                    contentSelector: '.content',
                    ignoreSelector: '[data-toc-skip]',
                    headingSelector: 'h2, h3, h4',
                    orderedList: false,
                    scrollSmooth: false
                });
                tocWrapper.classList.remove('d-none');
            }
            tocbot.refresh();
        }

        if (this.isMermaid) fixMermaids();
        if (this.next) this.next.start();
        else showTailWrappers();
    }
}

function typewrite() {
    if (!window.location.pathname.startsWith("/posts/") || window.location.hash) {
        showTailWrappers();
        return;
    }

    const elements = document.querySelectorAll(
        //"main article header > h1, " + 
        //".post-desc, .post-meta > span, .post-meta > div > a, " +
        //"figcaption, .post-meta > div > span, .post-meta > div > div > span, " +
        "main article div.content > *");

    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const typer = new Typer(element);
        if (i > 0) typers[typers.length-1].next = typer;
        typers.push(typer);
    }

    if (typers.length > 0) {
        if (window.tocbot)
            tocbot.refresh();
        typers[0].start();
    }
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

    document.addEventListener("turbolinks:load", () => {
        for (let i = 0; i < promises.length; i++) {
            promises[i].break();
        }
        promises = [];
        typers = [];
        fixNav();
        fixMermaids();
        fixModeToggle();
        flipGravity(!gravity);
        typewrite();
        initialized = true;
    });

    for (let i = 0; i < DROP_COUNT; i++) {
        drops.push(new Drop());
    }
}

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
    ctx.clearRect(0, 0, stage.width, stage.height);
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

function update() {
    const fixedStep = 1 / FRAME_RATE;
    const now = getNow();
    const nowMS = now / 1000;
    const deltaTime = Math.min(nowMS - lastTime, MAX_LAG);

    let shouldRender = false;
    lastTime = nowMS; 
    elapsedTime += deltaTime;
    stage.width = stageWrapper.clientWidth;
    stage.height = stageWrapper.clientHeight;

    while (elapsedTime >= fixedStep) {
        updateDrops(now, fixedStep);
        elapsedTime -= fixedStep;
        shouldRender = true;
    }

    
    if (shouldRender) renderDrops();
    parallax3d();
    requestAnimationFrame(update);
};

initialize();
requestAnimationFrame(update);

})();