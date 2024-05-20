import * as Cfg from "../modules/effects/config";
import { RainState, isFlipping, isScrolling } from "../modules/effects/rain-effect";
import { randInt, lerp, clamp, normalizeVector, getNow } from "../modules/helpers";

let rain = new RainState();
let canvas, ctx, drops = [], lastTime = 0, elapsedTime = 0;
const isDown = () => isFlipping(rain) !== rain.gravity;

class Drop {
    splash = new Splash();

    constructor() {
        this.init();
        this.y = randInt(0, rain.canvasHeight);
    }

    init() {
        this.scale = Math.random();
        this.color = randomColor();
        this.alpha = lerp(Cfg.DROP_MIN_ALPHA, Cfg.DROP_MAX_ALPHA, this.scale) / 100;

        this.width = lerp(Cfg.DROP_MIN_WIDTH, Cfg.DROP_MAX_WIDTH, this.scale);
        this.len = lerp(Cfg.DROP_MIN_LENGTH, Cfg.DROP_MAX_LENGTH, this.scale);
        this.breakpoint = lerp(Cfg.SPLASH_MIN_BREAKPOINT, Cfg.SPLASH_MAX_BREAKPOINT, this.scale) / 100;
        this.spawned = Math.random() <= lerp(Cfg.DROP_MIN_SPAWNRATE / 100, 1, rain.mouseXD);

        let buffer = Cfg.DROP_X_BUFFER * lerp(1, Cfg.WIND_BUFFER_MULTIPLIER / 100, rain.mouseXD);
        this.x = isDown() ? randInt(-buffer, rain.canvasWidth) : randInt( 0, rain.canvasWidth + buffer);
        this.y = isDown() ? -this.len * 2 : (rain.canvasHeight * this.breakpoint);

        this.vx = Cfg.WIND_MIN_VELOCITY;
        this.wv = lerp(-Cfg.WIND_VELOCITY_VARIANCE, Cfg.WIND_VELOCITY_VARIANCE, Math.random());
        this.vy = lerp(Cfg.DROP_MIN_VELOCITY, Cfg.DROP_MAX_VELOCITY, this.scale);
    }

    update(deltaTime) {
        const vm = lerp(1, Cfg.WIND_VELOCITY_MULTIPLIER / 100, rain.mouseXD);
        this.vx = lerp(Cfg.WIND_MIN_VELOCITY, Cfg.WIND_MAX_VELOCITY, rain.mouseXD) + this.wv;

        if (!this.splash.active) {
            const dir = isDown() ? 1 : -1;
            this.x += this.vx * deltaTime * vm * dir;
            this.y += this.vy * deltaTime * vm * dir;
        }

        if (isDown() && this.y > rain.canvasHeight * this.breakpoint) {
            this.startSplash();
            this.init();
        } else if (!isDown() && this.y + this.len < 0) {
            this.init();
            this.startSplash();
        }
        this.splash.update(deltaTime);
    }

    render() {
        this.splash.render();
        if (!this.spawned || this.splash.active) return;

        let len = this.len * lerp(1, Cfg.DROP_LENGTH_MULTIPLIER / 100, rain.mouseXD);
        const flipRatio = Math.min((getNow() - rain.lastFlipTime) / 1000 / (Cfg.RAIN_SLOW_MO_EASING * 2), 1);
        len *= 1 - (Math.sin(flipRatio * Math.PI));

        let v = { x: this.vx, y: this.vy };
        normalizeVector(v);
        let x = this.x + (isDown() ? v.x * len : 0);
        let y = this.y + (isDown() ? v.y * len : 0);

        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;

        const skipSteps = clamp((rain.canvasHeight * this.breakpoint) - this.y, -len, len);
        for (let i = 0; i <= len; i++) {
            ctx.lineWidth = lerp(0, this.width, 1 - (i / len));
            ctx.beginPath();
            ctx.moveTo(x, y);
            x += isDown() ? -v.x : v.x;
            y += isDown() ? -v.y : v.y;
            if ((isDown() ? len - i : i) > skipSteps) continue;
            ctx.lineTo(x, y);
            ctx.stroke();
            if (i === 0) {
                ctx.beginPath();
                ctx.arc(x, y, this.width / 2, 0, Math.PI * 2);
                ctx.fill();
            }
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
        if (this.active) return;
        this.x = x;
        this.y = y;
        this.color = color;

        this.alpha = lerp(Cfg.DROP_MIN_ALPHA, Cfg.DROP_MAX_ALPHA, scale) / 100;
        this.width = lerp(Cfg.DROP_MIN_WIDTH, Cfg.DROP_MAX_WIDTH, scale);

        let m = 1 + rain.mouseXD;
        this.maxRadius = lerp(Cfg.SPLASH_MIN_RADIUS, Cfg.SPLASH_MAX_RADIUS, scale) * m;
        this.maxTime = lerp(Cfg.SPLASH_MIN_DURATION, Cfg.SPLASH_MAX_DURATION, 1 - scale) / m;

        this.t = isDown() ? 0 : this.maxTime;
        this.active = true;
    }

    update(deltaTime) {
        if (!this.active) return;
        let dir = isDown() ? 1 : -1;
        this.t += deltaTime * dir;
        if ((isDown() && this.t >= this.maxTime) || (!isDown() && this.t <= 0))
            this.active = false;
    }

    render() {
        if (!this.active ||
            this.y > rain.canvasHeight * Cfg.SPLASH_MAX_BREAKPOINT / 100)
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

function randomColor() {
    let h = Math.round(lerp(0, 360, Math.random()));
    let l = Math.random() < Cfg.DROP_COLOR_CHANCE / 100 ? Cfg.DROP_COLOR_LIGHTNESS : 100;
    let hsl = `hsl(${h}, 100%, ${l}%)`;
    return hsl;
}

function updateDrops(now, fixedStep) {
    const slowMult = Cfg.RAIN_SLOW_MO_MULTIPLIER / 100;
    const slowDeltaTime = (now - rain.lastSlowTime) / 1000;
    let speed = slowMult;

    if ((!isFlipping(rain) && !isScrolling(rain)) || slowDeltaTime < Cfg.RAIN_SLOW_MO_EASING)
        speed = slowDeltaTime < Cfg.RAIN_SLOW_MO_DURATION + Cfg.RAIN_SLOW_MO_EASING
        ? lerp(slowMult, 1, 1 - Math.min(slowDeltaTime / Cfg.RAIN_SLOW_MO_EASING, 1))
        : lerp(slowMult, 1, Math.min((slowDeltaTime - Cfg.RAIN_SLOW_MO_DURATION - Cfg.RAIN_SLOW_MO_EASING) / Cfg.RAIN_SLOW_MO_EASING, 1));
    
    for (let i = 0; i < drops.length; i++)
        drops[i].update(fixedStep * Cfg.RAIN_TIME_SCALE / 100 * speed);
};

function renderDrops() {
    canvas.width = rain.canvasWidth;
    canvas.height = rain.canvasHeight;
    ctx.save();

    for (let i = 0; i < drops.length; ++i)
        drops[i].render();

    if (Cfg.RAIN_CANVAS_DEBUG) {
        ctx.strokeStyle = "rgb(255, 255, 255)";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.moveTo(0, rain.canvasHeight * (Cfg.SPLASH_MIN_BREAKPOINT / 100));
        ctx.lineTo(rain.canvasWidth, rain.canvasHeight * (Cfg.SPLASH_MIN_BREAKPOINT / 100));
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.moveTo(0, rain.canvasHeight * (Cfg.SPLASH_MAX_BREAKPOINT / 100));
        ctx.lineTo(rain.canvasWidth, rain.canvasHeight * (Cfg.SPLASH_MAX_BREAKPOINT / 100));
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.moveTo(rain.canvasWidth / 2, 0);
        ctx.lineTo(rain.canvasWidth / 2, rain.canvasHeight);
        ctx.stroke();
        ctx.closePath();
    }

    ctx.restore();
};

function update() {
    const fixedStep = 1 / Cfg.RAIN_FRAME_RATE;
    const now = getNow();
    const nowMS = now / 1000;
    const deltaTime = Math.min(nowMS - lastTime, Cfg.RAIN_MAX_LAG);

    let shouldRender = false;
    lastTime = nowMS; 
    elapsedTime += deltaTime;

    while (elapsedTime >= fixedStep) {
        updateDrops(now, fixedStep);
        elapsedTime -= fixedStep;
        shouldRender = true;
    }
    
    if (shouldRender) renderDrops();
    requestAnimationFrame(update);
};

function initialize() {
    canvas = rain.offscreenCanvas;
    ctx = canvas.getContext("2d");
    for (let i = 0; i < Cfg.DROP_COUNT; i++) {
        drops.push(new Drop());
    }
    requestAnimationFrame(update);
}

onmessage = (e) => {
    rain = e.data;
    if (!canvas) initialize();
}