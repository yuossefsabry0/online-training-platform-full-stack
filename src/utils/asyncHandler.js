'use strict';

// Wrap async controllers so rejections flow into Express' error pipeline.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
