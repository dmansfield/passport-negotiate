var passport = require('passport')
    , util = require('util')
    , BadRequestError = require('./errors/badrequesterror');

/**
 * `Strategy` constructor.
 * 
 * Authenticate using Negotiate (rfc4559).
 * 
 * Applications must supply a `verify` callback which accepts an authenticated
 * `principal` and then calls the `done` callback supplying a `user`, which
 * should be set to `false` if the authentication should be denied.
 * If an exception occurred, `err` should be set.
 * 
 * Optionally, `options` can be used to further configure the strategy.
 * 
 * Options:
 *   - `passReqToCallback`  when `true`, `req` is the first argument to the verify callback (default: `false`)
 *   - `servicePrincipalName`  in the form `service@host`.  `service` should pretty much always
 *     be `HTTP` but `host` may need to be specified when CNAMES or load balancers are in use. 
 *     This principal will be looked up in the keytab to establish credentials during authentication.
 *     The keytab will be found in it's default location, or by consulting the KRB5_KTNAME environment
 *     variable.
 * 
 * @param {Object} options
 * @param {Function} verify
 */
function Strategy(options, verify) {
	if (typeof options === 'function') {
		verify = options;
		options = {};
	}
	
	if (!verify) throw new Error('negotiate authentication strategy requires a verify function');

	passport.Strategy.call(this);
	
	this.name = 'negotiate';
	this._verify = verify;
	this._passReqToCallback = options.passReqToCallback;
	this._servicePrincipalName = options.servicePrincipalName;
}

util.inherits(Strategy, passport.Strategy);

Strategy.prototype.authenticate = function(req) {
	var auth = req.get("authorization");
	
	if (!auth) {
		// this will generate a 401 and WWW-Authenticate: Negotiate header
		return this.fail('Negotiate');
	}
	
	var self = this;
	
	function failIfError(err, step) {
		if (err) {
			console.error("authentication failed at operation '"+step+"' with error: "+err);
			self.error(err);
			return 1;
		}
		return 0;
	}

	if (auth.lastIndexOf('Negotiate ', 0) !== 0) {
		self.error('Malformed authentication token');
		return;
	}
	
	auth = auth.substring("Negotiate ".length);
	
	function verified(err, user, info) {
		if (err) { return self.error(err); }
		if (!user) { return self.fail(info); }
		self.success(user, info);
	}
	
	var servicePrincipalName = this._servicePrincipalName || "HTTP";
	kerberos.authGSSServerInit(servicePrincipalName, function(err, context) {
		if (!failIfError(err, 'init')) { 
			kerberos.authGSSServerStep(context, auth, function(err) {
				if (!failIfError(err, 'step')) {
					// this will be wiped when we "clean" below, so stash it
					var username = context.username;
					kerberos.authGSSServerClean(context, function(err) {
						if (!failIfError(err), 'clean') {
							if (self._passReqToCallback) {
								this._verify(req, username, verified);
							} else {
								this._verify(username, verified);
							}
						}
					});
				}
			});
		}
	});	
};

module.exports = Strategy;
