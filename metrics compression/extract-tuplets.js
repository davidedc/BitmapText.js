#!/usr/bin/env node

const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node extract-tuplets.js <file-path>');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

// Find the BitmapText.r call and extract the array
// Format: BitmapText.r('id',[[...],[...]])
// The array ends with ,spaceAdvancement])}
const match = content.match(/BitmapText\.r\('([^']+)',(\[.+\])\)\}/);
if (!match) {
  console.error('Could not find BitmapText.r call');
  console.error('Trying to find what the file contains...');
  const preview = content.substring(0, 500);
  console.error('First 500 chars:', preview);
  process.exit(1);
}

const id = match[1];
const arrayStr = match[2];

// Parse the array
let metricsData;
try {
  metricsData = eval(arrayStr);
} catch (e) {
  console.error('Failed to parse array:', e.message);
  process.exit(1);
}

console.log('ID:', id);
console.log('Structure elements:', metricsData.length);
console.log('\nElement 0 (config):', metricsData[0]);
console.log('\nElement 2 (baselines):', metricsData[2]);
console.log('\nElement 3 (values) length:', metricsData[3].length);
console.log('First 20 values:', metricsData[3].slice(0, 20));
console.log('\nElement 4 (tuplets) length:', metricsData[4].length);
console.log('First 30 tuplets:', metricsData[4].slice(0, 30));
console.log('\nElement 5 (space):', metricsData[5]);
