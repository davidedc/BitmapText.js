// some functions to generate text

function generateUpperCasePairs() {
    let pairs = [];
    for (let i = 65; i < 91; i++) {
        for (let j = 65; j < 91; j++) {
        pairs.push(String.fromCharCode(i) + String.fromCharCode(j));
        }
    }
    return pairs;
}

// all pairs of mixed-case letters
// i.e. Aa, Ab, Ac, ..., Zz

function generateMixedCasePairs() {
    let pairs = [];
    for (let i = 65; i < 91; i++) {
        for (let j = 97; j < 123; j++) {
        pairs.push(String.fromCharCode(i) + String.fromCharCode(j));
        }
    }
    return pairs;
}

// all pairs of lowercase letters
// i.e. aa, ab, ac, ..., zz

function generateLowerCasePairs() {
    let pairs = [];
    for (let i = 97; i < 123; i++) {
        for (let j = 97; j < 123; j++) {
        pairs.push(String.fromCharCode(i) + String.fromCharCode(j));
        }
    }
    return pairs;
}
