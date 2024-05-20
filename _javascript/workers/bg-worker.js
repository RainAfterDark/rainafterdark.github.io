import { BgState } from "../modules/effects/bg-anim";
import { rand, randInt, randNormal, normalPDF, lerp } from "../modules/helpers";

let bg = new BgState();
let canvas, ctx;

// Modified version of https://maxhalford.github.io/blog/unknown-pleasures/
function unknownPleasures() {
    canvas.width = bg.canvasWidth;
    canvas.height = bg.canvasHeight;
    ctx.save();

    // Determine x and y range
    const xMin = 0;
    const xMax = canvas.width;
    const yMin = canvas.height / 3;
    const yMax = canvas.height;

    // Determine the number of lines and the number of points per line
    const nLines = 69;
    const nPoints = 42;

    const mx = (xMin + xMax) / 2;
    const dx = (xMax - xMin) / nPoints;
    const dy = (yMax - yMin) / nLines;

    let x = xMin;
    let y = yMin;

    ctx.fillStyle = "black";
    ctx.strokeStyle = "white";

    const lim = Math.round(lerp(10, 24, bg.mouseXD));
    for (let i = 1; i <= lim; i++) {
        ctx.beginPath();
        const rad = 2 * Math.PI;
        ctx.arc(xMax / 2, yMin, 100 + (Math.random() * lim) + (i * (i / 4)), rad * Math.random(), rad * Math.random());
        ctx.lineWidth = 1 - (i / lim);
        ctx.stroke();
    }

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(xMax / 2, yMin, 100 + (5 * Math.random() * (1 + bg.mouseXD)), 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "black";
    ctx.fillRect(xMin, yMin, xMax, yMax);
    ctx.moveTo(xMin, yMin);

    for (let i = 0; i < nLines; i++) {
        const lr = 1 - (i / nLines);
        const mr = (1 + bg.mouseXD / 2);
        ctx.lineWidth = 1.5 * lr * lr;
        ctx.beginPath();
        // Generate random parameters for the line's normal distribution
        const nModes = Math.round(randInt(6, 9));
        let mus = [];
        let sigmas = [];
        for (let j = 0; j < nModes; j++) {
            const off = 69 * mr;
            mus[j] = rand(mx - off, mx + off);
            sigmas[j] = randNormal(42, 69 * mr);
        }
        let w = y
        for (let k = 0; k < nPoints; k++) {
            x = x + dx;
            let noise = 0;
            for (let l = 0; l < nModes; l++) {
                noise += normalPDF(x, mus[l], sigmas[l]);
            }
            const yy = 0.3 * w + 0.7 * (y - 800 * lr * noise + noise * Math.random() * 200 * mr + Math.random());
            ctx.lineTo(x, Math.max(yy, y - (yMin / 3)));
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

    ctx.restore();
    setTimeout(() => requestAnimationFrame(unknownPleasures), 1000 / 12);
}

function initialize() {
    canvas = bg.offscreenCanvas;
    ctx = canvas.getContext("2d");
    requestAnimationFrame(unknownPleasures);
}

onmessage = (e) => {
    bg = e.data;
    if (!canvas) initialize();
}