import { initRain, initBgAnim, initParallax3d } from "./modules/effects.js";
import { fixNav, fixMermaids, fixModeToggle } from "./modules/helpers.js";

initRain();
initBgAnim();
initParallax3d();

let initialized = false;
document.addEventListener("turbolinks:load", () => {
    fixNav();
    fixMermaids();
    if (initialized) fixModeToggle();
    initialized = true;
});