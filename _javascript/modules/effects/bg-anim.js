import { loadWorker, deviceHasPointer } from "../helpers";

export class BgState {
    offscreenCanvas;
    canvasWidth = 0;
    canvasHeight = 0;
    mouseXD = 0.5;
}

const bg = new BgState();
let worker, wrapper;

function update() {
    worker.postMessage(bg);
}

export function initBgAnim() {
    worker = loadWorker("bg-worker");
    wrapper = document.getElementById("bg-canvas-wrapper");
    const canvas = document.getElementById("bg-canvas");

    bg.canvasWidth = wrapper.clientWidth;
    bg.canvasHeight = wrapper.clientHeight;
    bg.offscreenCanvas = canvas.transferControlToOffscreen();
    worker.postMessage(bg, [bg.offscreenCanvas]);
    bg.offscreenCanvas = null;

    window.addEventListener("resize", () => {
        bg.canvasWidth = wrapper.clientWidth;
        bg.canvasHeight = wrapper.clientHeight;
        update();
    });

    if (!deviceHasPointer()) return;
    document.addEventListener("mousemove", (e) => {
        bg.mouseXD = e.clientX / window.innerWidth;
        update();
    });
}