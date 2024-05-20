import { clamp, deviceHasPointer } from "../helpers";

let sidebarWrapper, targets = [],
    lastMX = 0, lastMY = 0;

function parallaxTransform(target, invert = false, mult = 1) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const maxD2 = Math.sqrt(
        Math.pow(rect.height, 2) + Math.pow(rect.width, 2));
    const dist2 = Math.sqrt(
        Math.pow((lastMY - rect.y - (rect.height / 2)), 2) +
        Math.pow((lastMX - rect.x - (rect.width / 2)), 2));
    const absD2 = 1 - ((Math.abs(dist2)) / (maxD2 * 2));

    function calcD(mouseD, rectP, rectD, windowD) {
        const maxD = rectD * 2;
        const dist = clamp(mouseD - rectP - (rectD / 2), -maxD, maxD);
        const deg = (windowD / rectD) * Math.sin(Math.PI * (dist / maxD));
        return deg * absD2 * (invert ? -1 : 1) * mult;
    }

    const calcX = -calcD(lastMY, rect.y, rect.height, window.innerHeight);
    const calcY = calcD(lastMX, rect.x, rect.width, window.innerWidth);
    const transform = `perspective(200px) rotateX(${calcX}deg) rotateY(${calcY}deg)`;
    target.style.transform = transform;
    target.style.webkitTransform = transform;
}

function updateParallax3d() {
    const targets = document.querySelectorAll(".parallax-3d");
    for (let i = 0; i < targets.length; i++) 
        parallaxTransform(targets[i]);
    parallaxTransform(sidebarWrapper, true, 2 / 3);
    requestAnimationFrame(updateParallax3d);
}

export function initParallax3d() {
    if (!deviceHasPointer()) return;
    sidebarWrapper = document.getElementById("sidebar-canvas-wrapper");
    document.addEventListener("turbolinks:load", () => {
        targets = document.querySelectorAll(".parallax-3d");
    });
    document.addEventListener("mousemove", e => {
        lastMX = e.clientX;
        lastMY = e.clientY;
    });
    requestAnimationFrame(updateParallax3d);
}