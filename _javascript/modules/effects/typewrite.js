import * as Cfg from "./config";
import { toc } from "../components/toc";
import { showContent, showTail } from "./page-load";
import { fixMermaids } from "../helpers";

let typers = [], tocObserver, progressBar;

function onVisible(element, threshold = 0) {
    return new Promise((resolve) => {
        const o = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                resolve(entry.intersectionRatio);
                o.disconnect();
            }
        }, { threshold: threshold });
        if (element.getBoundingClientRect().bottom <= 0) {
            resolve(-1);
            return;
        }
        o.observe(element);
    });
}

function onMJXReady() {
    return new Promise((resolve) => {
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
        const scrollTo = typers[finishTo].original;
        const correction = setInterval(() => {
            const rect = scrollTo.getBoundingClientRect();
            if (rect.top <= 1) {
                clearInterval(correction);
                return;
            }
            scrollTo.scrollIntoView();
        }, 1000);
    }
}

function initToc() {
    toc(clickToc);
    tocObserver = new IntersectionObserver(([entry]) => {
        const tocWrapper = document.getElementById("toc-wrapper");
        if (tocWrapper) // position: sticky "fix" to prevent jitter
            tocWrapper.classList[entry.isIntersecting ? "remove" : "add"]("fixed");
    });
    tocObserver.observe(document.querySelector(("#access-div")));
}

function updateProgressBar() {
    if (!progressBar) return;
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
    requestAnimationFrame(updateProgressBar);
}

class FakeTyper {
    original;
    fakeDiv;
    wrapper;
    nextTyper;

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
        const threshold = rect.bottom + (window.innerHeight * (Cfg.TYPE_PAUSE_OFFSET / 100));
        const pause = threshold >= window.innerHeight;
        const ratio =  threshold / window.innerHeight;

        const turbo = Cfg.TYPE_TURBO_THRESHOLD / 100;
        let speed = Math.round(Cfg.TYPE_MIN_SPEED * (Math.max(ratio, turbo) - turbo) / (1 - turbo));
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
            || ratio < Cfg.TYPE_SKIP_THRESHOLD / 100) {
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
        if (this.nextTyper) this.nextTyper.start();
        else showTail();
    }
}

function reset() {
    progressBar.setValue(1);
    progressBar.hide();
    progressBar = null;
    if (typers.length > 0) // prevent tail from showing early on page visit
        typers[typers.length - 1].finished = true;
    typers = [];
    tocObserver.disconnect();
    tocObserver = null;
}

export async function typewrite() {
    await onMJXReady();
    initToc();
    showContent();

    progressBar = new Turbolinks.ProgressBar();
    const elements = document.querySelectorAll("main article div.content > *");
    let skipFrom = 0;
    
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const typer = new FakeTyper(element);
        if (i > 0) typers[typers.length - 1].nextTyper = typer;
        typers.push(typer);
        if (typer.headerHash && typer.headerHash === window.location.hash) {
            skipFrom = typers.length - 1;
        }
    }

    if (typers.length > 0) {
        for (let i = skipFrom; i < typers.length; i++) 
            typers[i].init();
        typers[skipFrom].start();
    } else showTail();

    document.addEventListener("turbolinks:before-visit", reset, { once: true });
    requestAnimationFrame(updateProgressBar);
}