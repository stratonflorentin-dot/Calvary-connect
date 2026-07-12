// Runs the next CLI with the FAT32 readlink fix applied to this process and
// (via NODE_OPTIONS) to every child process Next spawns.
require('dotenv').config();
require('./fat32-readlink-fix.cjs');

const existing = process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '';
process.env.NODE_OPTIONS = existing + '--require ./scripts/fat32-readlink-fix.cjs --max-old-space-size=4096';

require('next/dist/bin/next');
