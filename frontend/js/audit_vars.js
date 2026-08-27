const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');

const consts = {};
const lets = {};

// Regex targets: const isAdmin = ..., let i = ...
const constRegex = /const\s+([a-zA-Z0-9_]+)\s*=/g;
const letRegex = /let\s+([a-zA-Z0-9_]+)\s*=/g;

let match;
while ((match = constRegex.exec(content)) !== null) {
    const name = match[1];
    const offset = match.index;
    const lineNum = content.substring(0, offset).split('\n').length;
    if (!consts[name]) consts[name] = [];
    consts[name].push(lineNum);
}

while ((match = letRegex.exec(content)) !== null) {
    const name = match[1];
    const offset = match.index;
    const lineNum = content.substring(0, offset).split('\n').length;
    if (!lets[name]) lets[name] = [];
    lets[name].push(lineNum);
}

console.log('--- Duplicate Consts ---');
for (const [name, nums] of Object.entries(consts)) {
    if (nums.length > 1) {
        // Filter out those that are likely in different scopes (e.g. inside functions)
        // For now, just print all
        console.log(\\: \\);
    }
}
