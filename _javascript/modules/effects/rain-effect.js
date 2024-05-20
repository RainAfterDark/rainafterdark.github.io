import * as Cfg from "./config";
import { loadWorker, getNow, deviceHasPointer } from "../helpers";

export class RainState {
    offscreenCanvas;
    canvasWidth = 0;
    canvasHeight = 0;
    mouseXD = 0.5;
    gravity = true;
    lastScrollTime = 0;
    lastFlipTime = 0;
    lastSlowTime = 0;
}

const rain = new RainState();
let worker, wrapper, 
    lastScrollTop = 0;

export const isFlipping = (state = rain) => (getNow() - state.lastFlipTime) / 1000 < Cfg.RAIN_SLOW_MO_EASING;
export const isScrolling = (state = rain) => (getNow()  - state.lastScrollTime) / 1000 < Cfg.RAIN_SLOW_MO_EASING;

function update() {
    worker.postMessage(rain);
}

function slowDown() {
    const now = getNow();
    if ((now - rain.lastSlowTime) / 1000 > Cfg.RAIN_SLOW_MO_EASING + Cfg.RAIN_SLOW_MO_DURATION)
        rain.lastSlowTime = getNow();
}

function flipGravity(g) {
    if (rain.gravity === g) return;
    rain.gravity = g;
    if (!isFlipping()) slowDown();
    rain.lastFlipTime = getNow();
}

export function initRain() {
    worker = loadWorker("rain-worker");
    wrapper = document.getElementById("sidebar-canvas-wrapper");
    const canvas = document.getElementById("sidebar-canvas");

    rain.canvasWidth = wrapper.clientWidth;
    rain.canvasHeight = wrapper.clientHeight;
    rain.offscreenCanvas = canvas.transferControlToOffscreen();
    worker.postMessage(rain, [rain.offscreenCanvas]);
    rain.offscreenCanvas = null;

    window.addEventListener("resize", () => {
        rain.canvasWidth = wrapper.clientWidth;
        rain.canvasHeight = wrapper.clientHeight;
        update();
    });

    window.addEventListener("scroll", () => {
        const st = window.scrollY || document.documentElement.scrollTop;
        if (st > lastScrollTop)
            flipGravity(true);
        else if (st < lastScrollTop)
            flipGravity(false);
        lastScrollTop = st <= 0 ? 0 : st;
        if (!isScrolling()) slowDown();
        rain.lastScrollTime = getNow();
        update();
    });

    if (!deviceHasPointer()) return;
    document.addEventListener("mousemove", (e) => {
        rain.mouseXD = e.clientX / window.innerWidth;
        update();
    });
}