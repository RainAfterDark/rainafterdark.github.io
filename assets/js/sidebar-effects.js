/* Modified version of: https://github.com/geoffb/canvas-rain-demo */

(function () {

// Animation
const FRAME_RATE               = 60;   // fps
const MAX_LAG                  = 1;    // seconds
const TIME_SCALE               = 100;  // %
const SLOW_MO_MULTIPLIER       = 10;   // %
const SLOW_MO_DURATION         = 0.5;  // seconds
const SLOW_MO_EASING           = 0.25; // seconds

// Wind
const WIND_MIN_VELOCITY        = 100;  // px/s
const WIND_MAX_VELOCITY        = 300;  // px/s
const WIND_VELOCITY_VARIANCE   =  50;  // px/s
const WIND_BUFFER_MULTIPLIER   = 300;  // %
const WIND_VELOCITY_MULTIPLIER = 125;  // %

// Drop settings
const DROP_COUNT               = 80;   // int
const DROP_MIN_WIDTH           = 1;    // px
const DROP_MAX_WIDTH           = 3;    // px
const DROP_X_BUFFER            = 200;  // px
const DROP_COLOR_CHANCE        = 75;   // %
const DROP_COLOR_LIGHTNESS     = 75;   // %
const DROP_MIN_VELOCITY        = 500;  // px/s
const DROP_MAX_VELOCITY        = 750;  // px/s
const DROP_MIN_LENGTH          = 5;    // px
const DROP_MAX_LENGTH          = 30;   // px
const DROP_LENGTH_MULTIPLIER   = 150;  // %
const DROP_MIN_ALPHA           = 5;    // %
const DROP_MAX_ALPHA           = 25;   // %
const DROP_MIN_SPAWNRATE       = 25;   // %

const SPLASH_MIN_BREAKPOINT    = 80;   // %
const SPLASH_MAX_BREAKPOINT    = 90;   // %
const SPLASH_MIN_RADIUS        = 8;    // px
const SPLASH_MAX_RADIUS        = 16;   // px
const SPLASH_MIN_DURATION      = 0.8;  // seconds
const SPLASH_MAX_DURATION      = 1.6;  // seconds

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

let stage, wrapper, ctx, avatar;
let avatarHovered = false;
let mouseX = 0;

let gravity = false;
let lastScrollTop = 0;
let lastSlowTime = 0;

function slowDown() {
    lastSlowTime = Date.now();
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
    gravity = g;
    updateAvatar();
}

function initStage() {
    stage = document.getElementById("sidebar-canvas");
    wrapper = document.getElementById("sidebar-canvas-wrapper");
    stage.width = wrapper.clientWidth;
    stage.height = wrapper.clientHeight;
    ctx = stage.getContext("2d");
    ctx.globalCompositeOperation = "lighter";

    const isHover = e => e.parentElement.querySelector(":hover") === e;
    document.addEventListener("mousemove", function checkHover(e) {
        const hovered = isHover(avatar);
        if (hovered !== checkHover.hovered) {
            checkHover.hovered = hovered;
            avatarHovered = hovered;
            if (hovered && !gravity) {
                flipGravity(true);
            }
        }
        mouseX = e.clientX / window.innerWidth;
    });

    window.addEventListener("resize", function() {
        stage.width = wrapper.clientWidth;
        stage.height = wrapper.clientHeight;
    });

    window.addEventListener("scroll", function(){
        let st = window.scrollY  || document.documentElement.scrollTop;
        if (st > lastScrollTop) {
           flipGravity(true);
        } else if (st < lastScrollTop) {
            flipGravity(false);
        }
        lastScrollTop = st <= 0 ? 0 : st;
        slowDown();
     });

    document.addEventListener("turbolinks:load", function() {
        avatar = document.getElementById("avatar");
        flipGravity(!gravity);
        slowDown();
    });
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
        this.spawned = Math.random() <= lerp(DROP_MIN_SPAWNRATE / 100, 1, mouseX);

        let buffer = DROP_X_BUFFER * lerp(1, WIND_BUFFER_MULTIPLIER / 100, mouseX);
        this.x = gravity ? randomInteger(-buffer, stage.width) : randomInteger(0, stage.width + buffer);
        this.y = gravity ? -this.len : stage.height * this.breakpoint;

        this.vx = WIND_MIN_VELOCITY;
        this.wv = lerp(-WIND_VELOCITY_VARIANCE, WIND_VELOCITY_VARIANCE, Math.random());
        this.vy = lerp(DROP_MIN_VELOCITY, DROP_MAX_VELOCITY, this.scale);
    }

    update(deltaTime) {
        let vm = lerp(1, WIND_VELOCITY_MULTIPLIER / 100, mouseX);
        this.vx = lerp(WIND_MIN_VELOCITY, WIND_MAX_VELOCITY, mouseX) + this.wv;

        let g = gravity ? 1 : -1;
        this.x += this.vx * deltaTime * vm * g;
        this.y += this.vy * deltaTime * vm * g;

        if(gravity && this.y > stage.height * this.breakpoint) {
            this.startSplash();
            this.init();
        } else if(!gravity && this.y - this.len < 0) {
            this.init();
            this.startSplash();
        }
        this.splash.update(deltaTime);
    }

    render() {
        this.splash.render();
        if(!this.spawned)
            return;

        let x1 = Math.round(this.x);
        let y1 = Math.round(this.y);

        let v = { x: this.vx, y: this.vy };
        normalizeVector(v);
        let len = this.len * lerp(1, DROP_LENGTH_MULTIPLIER / 100, mouseX);
        len = Math.min((stage.height * this.breakpoint) - this.y, len);
        scaleVector(v, len);

        let x2 = Math.round(x1 + v.x);
        let y2 = Math.round(y1 + v.y);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width;
        ctx.globalAlpha = this.alpha;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.closePath();
    }

    startSplash() {
        if(this.spawned)
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

        let m = 1 + mouseX;
        this.maxRadius = lerp(SPLASH_MIN_RADIUS, SPLASH_MAX_RADIUS, scale) * m;
        this.maxTime = lerp(SPLASH_MIN_DURATION, SPLASH_MAX_DURATION, 1 - scale) / m;

        this.t = 0;
        this.active = true;
    }

    update(deltaTime) {
        if(!this.active)
            return;
        this.t += deltaTime;
        if(this.t >= this.maxTime)
            this.active = false;
    }

    render() {
        if(!this.active ||
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

let drops = [];

function initDrops() {
    for(let i = 0; i < DROP_COUNT; i++) {
        drops.push(new Drop());
    }
};

function updateDrops(deltaTime) {
    for(let i = 0; i < drops.length; i++) {
        drops[i].update(deltaTime);
    }
};

function renderDrops() {
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.save();
    for(let i = 0; i < drops.length; ++i) {
        drops[i].render();
    }
    ctx.restore();
};

let lastTime = 0, elapsedTime = 0;
const FIXED_STEP = 1 / FRAME_RATE;
const SLOW_MULT = SLOW_MO_MULTIPLIER / 100;

function update(timestamp) {
    const currentTime = timestamp / 1000;
    const deltaTime = Math.min(currentTime - lastTime, MAX_LAG);

    const slowDeltaTime = (Date.now() - lastSlowTime) / 1000;
    const speed = slowDeltaTime < SLOW_MO_DURATION + SLOW_MO_EASING
        ? lerp(SLOW_MULT, 1, 1 - Math.min(slowDeltaTime / SLOW_MO_EASING, 1))
        : lerp(SLOW_MULT, 1, Math.min((slowDeltaTime - SLOW_MO_DURATION - SLOW_MO_EASING) / SLOW_MO_EASING, 1));

    let shouldRender = false;
    lastTime = currentTime; 
    elapsedTime += deltaTime;

    while(elapsedTime >= FIXED_STEP) {
        updateDrops(FIXED_STEP * TIME_SCALE / 100 * speed);
        elapsedTime -= FIXED_STEP;
        shouldRender = true;
    }

    if(shouldRender)
        renderDrops();
    requestAnimationFrame(update);
};

initStage();
initDrops();
requestAnimationFrame(update);

})();