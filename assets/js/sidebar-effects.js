/* Modified version of: https://github.com/geoffb/canvas-rain-demo */

const FIXED_STEP = 16;

// Wind
const WIND_MIN_VELOCITY = 0.1;
const WIND_MAX_VELOCITY = 0.3;
const WIND_BUFFER_MULTIPLIER = 3;
const WIND_VELOCITY_MULTIPLIER = 1.25;
const WIND_VELOCITY_VARIANCE = 0.05;

// Drop settings
const DROP_COUNT = 80;
const DROP_MIN_WIDTH = 1;
const DROP_MAX_WIDTH = 3;
const DROP_X_BUFFER = 200;
const DROP_COLOR_CHANCE = 0.25;
const DROP_COLOR_LIGHTNESS = 75;
const DROP_MIN_VELOCITY = 0.5;
const DROP_MAX_VELOCITY = 0.75;
const DROP_MIN_LENGTH = 5;
const DROP_MAX_LENGTH = 30;
const DROP_LENGTH_MULTIPLIER = 1.5;
const DROP_MIN_ALPHA = 0.3;
const DROP_MAX_ALPHA = 1;
const DROP_MIN_SPAWNRATE = 0.25;

const SPLASH_MIN_BREAKPOINT = 100;
const SPLASH_MAX_BREAKPOINT = 200;
const SPLASH_MIN_RADIUS = 5;
const SPLASH_MAX_RADIUS = 10;
const SPLASH_MIN_DURATION = 200;
const SPLASH_MAX_DURATION = 500;

var speedMultiplier = 1;
var mXDistance = 0;
var sidebarHover = false;

// Math helpers
var math = {
    // Random integer between min and max
    randomInteger: function (min, max) {
        return Math.round((Math.random() * (max - min)) + min);
    },
    // Linear Interpolation
    lerp: function (a, b, n) {
        return a + ((b - a) * n);
    },
    scaleVector: function (v, s) {
        v.x *= s;
        v.y *= s;
    },
    normalizeVector: function (v) {
        var m = Math.sqrt(v.x * v.x + v.y * v.y);
        math.scaleVector(v, 1 / m);
    }
};

var randomColor = function() {
    var h = Math.round(math.lerp(0, 360, Math.random()));
    var l = Math.random() < DROP_COLOR_CHANCE ? DROP_COLOR_LIGHTNESS : 100;
    var hsl = `hsl(${h}, 100%, ${l}%, 1)`;
    return hsl;
}

// Initialize our canvas
var stage, wrapper, ctx;

var initStage = function() {
    stage = document.getElementById("sidebar-canvas");
    wrapper = document.getElementById("sidebar-canvas-wrapper");
    stage.width = wrapper.clientWidth;
    stage.height = wrapper.clientHeight;
    ctx = stage.getContext("2d");

    /*const sidebar = document.getElementById("sidebar");
    const isHover = e => e.parentElement.querySelector(":hover") === e;*/

    document.addEventListener("mousemove", function checkHover(e) {
        /*const hovered = isHover(sidebar);
        if (hovered !== checkHover.hovered) {
            speedMultiplier = hovered ? 0.25 : 1;
            sidebarHover = hovered;
            checkHover.hovered = hovered;
        }*/
        mXDistance = e.clientX / window.innerWidth;
    });

    window.addEventListener("resize", function() {
        stage.width = wrapper.clientWidth;
        stage.height = wrapper.clientHeight;
    });
}

document.addEventListener("turbolinks:load", function() {
    initStage();
});

// Collection of rain drops
var drops = [];

var initDrops = function () {
    for (var i = 0; i < DROP_COUNT; i++) {
        var drop = {
            splash: {
                breakpoint: 0,
                active: false
            }
        };
        resetDrop(drop);
        drop.y = math.randomInteger(0, stage.height);
        drops.push(drop);
    }
};

// Reset a drop to the top of the canvas
var resetDrop = function (drop) {
    var scale = Math.random();
    drop.color = randomColor();
    drop.width = math.lerp(DROP_MIN_WIDTH, DROP_MAX_WIDTH, scale);

    var buffer = DROP_X_BUFFER * math.lerp(1, WIND_BUFFER_MULTIPLIER, mXDistance);
    drop.x = math.randomInteger(-buffer, stage.width);
    //drop.vx = math.lerp(WIND_MIN_VELOCITY, WIND_MAX_VELOCITY, mXDistance);
    drop.vx = WIND_MIN_VELOCITY;
    drop.vxw = math.lerp(0, WIND_VELOCITY_VARIANCE, Math.random()) * (Math.round(Math.random()) > 0 ? 1 : -1);
    drop.vy = math.lerp(DROP_MIN_VELOCITY, DROP_MAX_VELOCITY, scale);
    drop.y = math.randomInteger(-drop.len, 0);

    drop.len = math.lerp(DROP_MIN_LENGTH, DROP_MAX_LENGTH, scale);
    drop.alpha = math.lerp(DROP_MIN_ALPHA, DROP_MAX_ALPHA, scale);

    drop.splash.breakpoint = math.lerp(SPLASH_MIN_BREAKPOINT, SPLASH_MAX_BREAKPOINT, scale);
    drop.splash.maxradius = math.lerp(SPLASH_MIN_RADIUS, SPLASH_MAX_RADIUS, scale);
    drop.splash.maxtime = math.lerp(SPLASH_MIN_DURATION, SPLASH_MAX_DURATION, scale);

    drop.sr = Math.random() <= math.lerp(DROP_MIN_SPAWNRATE, 1, mXDistance);
};

var startSplash = function (drop) {
    drop.splash.x = drop.x;
    drop.splash.y = drop.y;
    drop.splash.t = 0;
    drop.splash.alpha = drop.alpha;
    drop.splash.active = true;
}

var updateDrops = function (dt) {
    //dt *= speedMultiplier;
    for (var i = drops.length - 1; i >= 0; --i) {
        var drop = drops[i];
        var vm = math.lerp(1, WIND_VELOCITY_MULTIPLIER, mXDistance);
        drop.vx = math.lerp(WIND_MIN_VELOCITY, WIND_MAX_VELOCITY, mXDistance) + drop.vxw;
        drop.x += drop.vx * dt * vm;
        drop.y += drop.vy * dt * vm;

        if(drop.y > stage.height - drop.splash.breakpoint) {
            if(drop.sr)
                startSplash(drop);
            resetDrop(drop);
        }

        if(drop.splash.active) {
            drop.splash.t += dt;
            if(drop.splash.t >= drop.splash.maxtime) {
                drop.splash.active = false;
            }
        }
    }
};

var renderDrops = function (ctx) {
    ctx.save();
    ctx.compositeOperation = "lighter";

    for (var i = 0; i < drops.length; ++i) {
        var drop = drops[i];

        if(drop.splash.active && drop.splash.y < stage.height - SPLASH_MIN_BREAKPOINT) {
            var scale = drop.splash.t / drop.splash.maxtime;
            var radius = drop.splash.maxradius * scale;
            ctx.globalAlpha = drop.splash.alpha - (drop.splash.alpha * scale);
            ctx.beginPath();
            ctx.ellipse(drop.splash.x, drop.splash.y, radius * 4, radius, 0, 0, Math.PI *2);
            ctx.stroke();
            ctx.closePath();
        }

        if(!drop.sr)
            continue;

        var x1 = Math.round(drop.x);
        var y1 = Math.round(drop.y);

        var v = { x: drop.vx, y: drop.vy };
        math.normalizeVector(v);
        math.scaleVector(v, -drop.len * math.lerp(1, DROP_LENGTH_MULTIPLIER, mXDistance));

        var x2 = Math.round(x1 + v.x);
        var y2 = Math.round(y1 + v.y);

        ctx.strokeStyle = drop.color;
        ctx.lineWidth = drop.width;
        ctx.globalAlpha = drop.alpha;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.closePath();
    }
    ctx.restore();
};

var render = function () {
    //ctx.fillStyle = "black";
    ctx.clearRect(0, 0, stage.width, stage.height);
    renderDrops(ctx);
};

var lastTime = 0;

var update = function (time) {
    var dt = time - lastTime;
    lastTime = time;
    if (dt > 100) { dt = FIXED_STEP; }
    
    while (dt >= FIXED_STEP) {
        updateDrops(FIXED_STEP);
        dt -= FIXED_STEP;
    }
    
    render();
    requestAnimationFrame(update);
};

initStage();
initDrops();
requestAnimationFrame(update);

/*setInterval(() => {
    var activeCount = 0;
    for(var i in drops) {
        if(drops[i].sr)
            activeCount++;
    }
    console.log(activeCount);
}, 1000);*/