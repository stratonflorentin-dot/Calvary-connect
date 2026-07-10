// Runs the next CLI with the FAT32 readlink fix applied to this process and
// (via NODE_OPTIONS) to every child process Next spawns.
require('./fat32-readlink-fix.cjs');

const existing = process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '';
process.env.NODE_OPTIONS = existing + '--require ./scripts/fat32-readlink-fix.cjs';

require('next/dist/bin/next');
