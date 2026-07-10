// This repo lives on a FAT32 volume, where readlink on a regular file fails
// with EISDIR instead of EINVAL. Next.js build tracing only tolerates
// EINVAL/ENOENT/UNKNOWN, so remap the code to mean "not a symlink".
// Must load before anything requires graceful-fs (it clones fs at load time),
// hence --require via NODE_OPTIONS rather than next.config.
const fs = require('fs');

const notASymlink = (err) => {
  if (err && err.code === 'EISDIR') err.code = 'EINVAL';
  return err;
};

const origReadlink = fs.readlink.bind(fs);
fs.readlink = (path, ...rest) => {
  const cb = rest[rest.length - 1];
  if (typeof cb === 'function') {
    rest[rest.length - 1] = (err, link) => cb(notASymlink(err), link);
  }
  return origReadlink(path, ...rest);
};

const origReadlinkSync = fs.readlinkSync.bind(fs);
fs.readlinkSync = (...args) => {
  try {
    return origReadlinkSync(...args);
  } catch (err) {
    throw notASymlink(err);
  }
};

const origReadlinkPromise = fs.promises.readlink.bind(fs.promises);
fs.promises.readlink = async (...args) => {
  try {
    return await origReadlinkPromise(...args);
  } catch (err) {
    throw notASymlink(err);
  }
};
