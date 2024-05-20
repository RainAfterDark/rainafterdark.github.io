export function showContent() {
    document.querySelector("main").classList.add("show");
}

export function showTail() {
    const wrappers = document.querySelectorAll(".post-tail-wrapper, #tail-wrapper");
    for (let i = 0; i < wrappers.length; i++)
        wrappers[i].classList.add("show");
}

export function showPage() {
    showContent();
    showTail();
}