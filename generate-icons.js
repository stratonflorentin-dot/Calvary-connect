// Icon generator for Calvary Connect PWA
// Uses canvas to generate PNG icons from SVG data
// Run: node generate-icons.js

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

// All sizes needed
const sizes = [32, 72, 96, 128, 144, 180, 192, 384, 512];

function drawIcon(canvas, size) {
  const ctx = canvas.getContext('2d');
  const s = size;
  const r = s * 0.18; // border radius ratio

  // Background rounded rect
  ctx.fillStyle = '#2952A3';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(s - r, 0);
  ctx.quadraticCurveTo(s, 0, s, r);
  ctx.lineTo(s, s - r);
  ctx.quadraticCurveTo(s, s, s - r, s);
  ctx.lineTo(r, s);
  ctx.quadraticCurveTo(0, s, 0, s - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  if (size <= 48) {
    // Small: just "CC" text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.round(s * 0.55)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CC', s / 2, s / 2);
    return;
  }

  // Truck body (trailer)
  const pad = s * 0.12;
  const truckY = s * 0.25;
  const truckH = s * 0.30;
  const truckW = s * 0.45;

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(pad, truckY + s * 0.05, truckW, truckH, 5);
  ctx.fill();

  // Trailer stripe
  ctx.fillStyle = '#52CAE0';
  ctx.fillRect(pad, truckY + s * 0.12, truckW, s * 0.04);

  // Cab
  const cabX = pad + truckW + s * 0.01;
  const cabY = truckY - s * 0.05;
  const cabW = s * 0.25;
  const cabH = truckH + s * 0.1;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(cabX, cabY, cabW, cabH, 6);
  ctx.fill();

  // Windshield
  ctx.fillStyle = '#52CAE0';
  ctx.beginPath();
  ctx.roundRect(cabX + s * 0.025, cabY + s * 0.03, cabW - s * 0.05, s * 0.12, 4);
  ctx.fill();

  // Wheels
  const wheelY = truckY + truckH + s * 0.1;
  const wheelR = s * 0.072;
  const wheels = [
    pad + truckW * 0.18,
    pad + truckW * 0.65,
    cabX + cabW * 0.5,
  ];

  wheels.forEach(cx => {
    // Outer wheel
    ctx.fillStyle = '#1a3a6b';
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR, 0, Math.PI * 2);
    ctx.fill();
    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Hub
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(cx, wheelY, wheelR * 0.25, 0, Math.PI * 2);
    ctx.fill();
  });

  // "CALVARY" text at bottom
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `bold ${Math.round(s * 0.095)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.letterSpacing = '2px';
  ctx.fillText('CALVARY', s / 2, s - s * 0.05);
}

// Check if canvas module available, if not use fallback
let canvasAvailable = false;
try {
  require('canvas');
  canvasAvailable = true;
} catch (e) {
  canvasAvailable = false;
}

if (canvasAvailable) {
  sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    drawIcon(canvas, size);
    const buffer = canvas.toBuffer('image/png');

    let filename;
    switch (size) {
      case 32: filename = 'favicon.png'; break;
      case 180: filename = 'apple-touch-icon.png'; break;
      case 192: filename = 'icon.png'; break;
      default: filename = `icon-${size}.png`;
    }
    // Also generate icon-NNN.png for standard sizes
    if (size === 192) {
      fs.writeFileSync(path.join(publicDir, 'icon.png'), buffer);
    }
    fs.writeFileSync(path.join(publicDir, filename), buffer);
    console.log(`✅ Generated ${filename} (${size}x${size})`);
  });
  console.log('\n🎉 All icons generated successfully!');
} else {
  console.log('❌ canvas module not found, using SVG fallback approach...');
  process.exit(1);
}
