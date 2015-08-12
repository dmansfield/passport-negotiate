/**
 * `NoUserError` error.
 *
 * @api public
 */
function NoUserError(principal, message) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  this.name = 'NoUserError';
  this.principal = principal;
  this.message = message || null;
};

/**
 * Inherit from `Error`.
 */
NoUserError.prototype.__proto__ = Error.prototype;


/**
 * Expose `NoUserError`.
 */
module.exports = NoUserError;
