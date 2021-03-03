class OptionsManager {
    constructor() {
        this.options = {};

        const optionElems = document.getElementsByClassName("option");

        for (var i = 0; i < optionElems.length; i++) {
            const elem = optionElems.item(i);
            const name = elem.id;
            this.options[name] = elem;
        }

        this.fs = require("fs");
        var jsonStr = this.readFile("./config.json");
        this.json = JSON.parse(jsonStr);
    }

    writeFile(path, output) {
        this.fs.writeFileSync(path, output);
    }
    readFile(path) {
        if(!this.fs.existsSync(path)) {
            this.writeFile(path, "{}");
            return "{}";
        }
        return this.fs.readFileSync(path, 'utf8');
    }

    linkHide(name, elements, checked = true) {
        const optionElem = this.options[name];

        if (optionElem && optionElem.type === "checkbox") {
            optionElem.addEventListener("change", () => {
                elements.forEach(elem => {
                    elem.style.display = optionElem.checked === checked ? "" : "none";
                });
            });
        }
    }

    linkCallback(name, _callback) {
        function callback(elem) {
            var value = null;
            if(elem.type === "checkbox") {
                value = elem.checked;
            } else {
                if(elem.value === "" || !elem.value) {
                    var placeholder = elem.getAttribute("placeholder");
                    if(placeholder)
                        value = placeholder;
                } else {
                    value = elem.value;
                }
            }
            _callback(value);
        }
        const elem = this.options[name];
        elem.addEventListener("change", () => {
            callback(elem);
        });
        const manual = document.getElementById(name + "-manual");
        if (manual) {
            manual.addEventListener("change", () => {
                callback(elem);
            });
        }
    }

    linkRanges() {
        for (const name in this.options) {
            if (!this.options.hasOwnProperty(name)) continue;

            const elem = this.options[name];

            if (elem.type === "range") {
                const manual = document.getElementById(name + "-manual");
                if (manual) {
                    const end = manual.getAttribute("end");
                    var value = elem.value;
                    if(end)
                        value = value + end;
                    manual.value = value;
                    manual.min = elem.min;
                    manual.max = elem.max;
    
                    elem.addEventListener("change", () => {
                        manual.value = elem.value;
                    });

                    manual.addEventListener("change", () => {
                        elem.value = manual.value;
                    });
                }
            }
        }
    }

    set(name, value) {
        const elem = this.options[name];
        
        if(elem) {
            if(elem.type === "checkbox")
                elem.checked = value;
            else
                elem.value = value;    
        }

        this.json[name] = value;
        this.writeFile("config.json", JSON.stringify(this.json));
    } 
    get(name) {
        const elem = this.options[name];

        if (elem) {
            return elem.type === "checkbox" ? elem.checked : elem.value;
        }
    }
    getOrDefault(name, placeholder) {
        var value = this.json[name];
        if(value)
            return value;
        this.set(name, placeholder);
        return placeholder;
    }

    load() {
        for (const name in this.options) {
            if (!this.options.hasOwnProperty(name)) continue;

            const elem = this.options[name];
            var getItem = this.json[name];
            var stored;
            if(getItem) {
                if(elem.type !== "text") {
                    stored = JSON.parse(getItem);
                } else
                    stored = getItem;
            }
            this.options[name] = elem;

            if (stored) {
                if (elem.type === "checkbox") {
                    elem.checked = stored;
                } else {
                    elem.value = stored;
                }

                elem.dispatchEvent(new Event("change"));
            }

            elem.addEventListener("change", () => {
                const value = elem.type === "checkbox" ? elem.checked : elem.value;
                this.json[name] = value;
                this.writeFile("config.json", JSON.stringify(this.json));
            });
        }
    }
}