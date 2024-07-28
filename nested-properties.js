function checkNestedPropertiesExist(obj, properties) {
    let current = obj;
    for (let prop of properties) {
        if (current[prop] === undefined) {
            return false;
        }
        current = current[prop];
    }
    return true;
}

function setNestedProperty(obj, properties, value) {
    let current = obj;
    for (let i = 0; i < properties.length; i++) {
        const prop = properties[i];
        if (i === properties.length - 1) {
            current[prop] = value;
        } else {
            if (!current[prop]) {
                current[prop] = {};
            }
            current = current[prop];
        }
    }
}

function getNestedProperty(obj, properties) {
    let current = obj;
    for (let prop of properties) {
        if (current[prop] === undefined) {
            return null;
        }
        current = current[prop];
    }
    return current;
}

function ensureNestedPropertiesExist(obj, properties) {
    let current = obj;
    for (const element of properties) {
        const prop = element;
        if (current[prop] === undefined) {
            current[prop] = {};
        }
        current = current[prop];
    }
}
