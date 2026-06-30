const preset = require('@learn-and-build/config/jest/nestjs');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  rootDir: 'src',
};
