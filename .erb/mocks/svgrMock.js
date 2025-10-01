// Jest mock for SVG files imported via SVGR-style syntax
// Exports an object to support both CJS and ESM import styles
const stub = 'svg-file-stub';
module.exports = {
  __esModule: true,
  default: stub,
  ReactComponent: () => null,
};
