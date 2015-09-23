var passport = require('passport-strategy')
    , util = require('util')
	, Kerberos = require('kerberos').Kerberos
	, kerberos = new Kerberos()
	, NoUserError = require('./errors/nousererror');

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
 * In general, it is unwise to use `failureRedirect` with this strategy, because
 * we need to generate a 401 with a `WWW-Authenticate: Negotiate` header when
 * the auth token is not present, and `failureRedirect` prevents this. The
 * "normal" functioning of a browser-server interaction with Negotiate auth
 * is request->response(401)->re-request-with-Authorization->ok. Instead use
 * `noUserRedirect` which will be used in the following condition:
 * 
 * It is possible for an authentication attempt to succeed, but the `verify`
 * cannot find a `user` object. The provided `verify` callback may want to 
 * supply an "empty" user object and then use additional middleware to
 * handle this case in certain applications. Multiple authentication layers
 * may be used as well to handle this. If `noUserRedirect` is provided in the 
 * options, this will be used instead of failing the authentication.
 * 
 * In any case, if authentication succeeds, the principal will be stored in 
 * req.session.authenticatedPrincipal and/or req.authenticatedPrincipal depending
 * on whether session support is enabled.
 * 
 * `options` can be used to further configure the strategy.
 * 
 * Options:
 *   - `passReqToCallback`  when `true`, `req` is the first argument to the verify callback (default: `false`)
 *   - `servicePrincipalName`  in the form `service@host`.  `service` should pretty much always
 *     be `HTTP` but `host` may need to be specified when CNAMES or load balancers are in use. 
 *     This principal will be looked up in the keytab to establish credentials during authentication.
 *     The keytab will be found in it's default location, or by consulting the KRB5_KTNAME environment
 *     variable.
 *   - `verbose`  include some more verbose logging
 *   - `enableConstrainedDelegation`  when set to `true`, S4U2Proxy constrained delegation
 *     will be initiated and credentials will be stored in a temporary credentials cache.
 *     The name of the cache will be stored in req.session.delegatedCredentialsCache 
 *     and/or req.delegatedCredentialsCache (depending on whether session support is enabled)
 *     This cache will have an expiry which should be monitored and the user's session
 *     should be re-authenticated to refresh it. see README
 * 
 * @param {Object} options
 * @param {Function} verify
 */
function Strategy(options, verify) {
	if (typeof options === 'function') {
		verify = options;
		options = {};
	}
	
	if (!verify) {
		throw new Error('negotiate authentication strategy requires a verify function');
	}

	passport.Strategy.call(this);
	
	this.name = 'negotiate';
	this._verify = verify;
	this._passReqToCallback = options.passReqToCallback;
	this._servicePrincipalName = options.servicePrincipalName;
	this._verbose = options.verbose;
	this._enableConstrainedDelegation = options.enableConstrainedDelegation;
}

util.inherits(Strategy, passport.Strategy);

/**
 * Options: in addition to the general passport options allowed in the authenticate middleware method:
 *   - `noUserRedirect`  url to redirect to if authentication succeeds but no user object is provided by `verify` callback
 *     see notes in strategy constructor
 * @param req  An Express request object
 * @param options  An object. See above.
 */
Strategy.prototype.authenticate = function(req, options) {
	var auth = req.get("authorization");
	
	if (!auth) {
		// this will generate a 401 and WWW-Authenticate: Negotiate header
		return this.fail('Negotiate');
	}
	
	var self = this;
	
	if (auth.lastIndexOf('Negotiate ', 0) !== 0) {
		self.error('Malformed authentication token: '+auth);
		return;
	}
	
	auth = auth.substring("Negotiate ".length);
	
	function failIfError(err, step) {
		if (err) {
			console.error("authentication failed at operation '"+step+"' with error: "+err);
			self.error(err);
			return 1;
		}
		return 0;
	}

	var servicePrincipalName = this._servicePrincipalName || "HTTP";

	kerberos.authGSSServerInit(servicePrincipalName, this._enableConstrainedDelegation, function(err, context) {
		if (!failIfError(err, 'init')) { 
			kerberos.authGSSServerStep(context, auth, function(err) {
				if (!failIfError(err, 'step')) {
					// context will be wiped when we "clean" below,
					// so stash the returned values in the session
					var principal = context.username;

					if (req.session)
					    req.session.authenticatedPrincipal = principal;
					req.authenticatedPrincipal = principal;
					if (self._enableConstrainedDelegation) {
					    if (req.session)
					        req.session.delegatedCredentialsCache = context.delegatedCredentialsCache;
					    req.delegatedCredentialsCache = context.delegatedCredentialsCache;
					}
					
					kerberos.authGSSServerClean(context, function(err) {
						function verified(err, user, info) {
							if (err) { return self.error(err); }
							if (!user) { 
								if (options.noUserRedirect) {
									if (self._verbose) {
										console.log("redirecting to: "+options.noUserRedirect);
									}
									return self.redirect(options.noUserRedirect);
								}
								// FIXME: it is not clear that calling fail with an Error object is correct
								return self.fail(new NoUserError(principal));
							}
							self.success(user, info);
						}

						if (!failIfError(err), 'clean') {
							if (self._passReqToCallback) {
								self._verify(req, principal, verified);
							} else {
								self._verify(principal, verified);
							}
						}
					});
				}
			});
		}
	});	
};

module.exports = Strategy;
