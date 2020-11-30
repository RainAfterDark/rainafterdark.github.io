var loadedScripts = [];
var initialLoad = false;

function getRootPath() {
    var path = window.location.pathname.split("/");
    if(path[1] == "")
        return "home";
    if(path[1] == "tabs")
        return "tabs/" + path[2];
    return path[1];
}

function loadScript(id, locations, script) {
    for(var i in loadedScripts) {
        var ls = loadedScripts[i];
        if(id == ls.id) {
            return;
        }
    }
    loadedScripts.push({ id, script, locations });
    if(initialLoad) {
        script();
        console.log("1st | " + id + " | " + getRootPath());
    }
}

document.addEventListener("turbolinks:load", function() {
    initialLoad = true;
    for(var i in loadedScripts) {
        var ls = loadedScripts[i];
        if(ls.locations == "global" || ls.locations.includes(getRootPath())) {
            ls.script();
            console.log("Nth | " + ls.id + " | " + getRootPath());
        }
    }
});