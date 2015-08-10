var passport = require('passport')
    , util = require('util')
	, Kerberos = require('kerberos').Kerberos
	, kerberos = new Kerberos();

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
 * we need to generate a 401 with a "WWW-Authenticate: Negotiate" header when
 * the auth. token is not present, and 'failureRedirect' prevents this. The
 * "normal" functioning of a browser-server interaction with Negotiate auth
 * is request->response(401)->re-request-with-Authorization->ok. Instead use
 * `noUserRedirect` which will be used in the following condition:
 * 
 * It is possible for an authentication attempt to succeed, but the `verify`
 * cannot find a `user` object. In this case, the user can provide a 
 * `noUserRedirect` in the options. Alternatively, `noUserOk` can be passed with
 * a true value which will allow processing to continue as if authentication was
 * successful even though no user object was found. The object instance supplied
 * in `options.emptyUserObject` will be used in this case. Using `noUserOk` 
 * without suppling an `options.emptyUserObject` is an error.  Calling the 
 * `done` callback  without a `user` object and without `noUserRedirect` and 
 * without `noUserOk` will result in an error.
 * 
 * In any case, if authentication succeeds, the principal will be stored in 
 * req.session.authenticatedPrincipal
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
 *   - `emptyUserObject`  the user object to be substituted when no user object is provided by the `verify` 
 *     callback but authentication succeeded AND `noUserOk` is passed in the options for the specified route
 *   - `verbose`  include some more verbose logging
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
	this._emptyUserObject = options.emptyUserObject;
}

util.inherits(Strategy, passport.Strategy);

/**
 * Options: in addition to the general passport options allowed in the authenticate middleware method:
 *   - `noUserRedirect`  url to redirect to if authentication succeeds but no user object is found
 *   - `noUserOk`  boolean that allows success when authentication succeeds but no user object is found. 
 *     see notes in strategy constructor
 * @param req
 * @param options see above
 */
Strategy.prototype.authenticate = function(req, options) {
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
		self.error('Malformed authentication token: '+auth);
		return;
	}
	
	auth = auth.substring("Negotiate ".length);
	
	var servicePrincipalName = this._servicePrincipalName || "HTTP";
	kerberos.authGSSServerInit(servicePrincipalName, function(err, context) {
		if (!failIfError(err, 'init')) { 
			kerberos.authGSSServerStep(context, auth, function(err) {
				if (!failIfError(err, 'step')) {
					// context will be wiped when we "clean" below, so stash the principal
					var principal = context.username;
					
					kerberos.authGSSServerClean(context, function(err) {
						function verified(err, user, info) {
							if (err) { return self.error(err); }
							if (!user) { 
								if (options.noUserRedirect) {
									if (self._verbose) {
										console.log("redirecting to "+options.noUserRedirect);
									}
									return self.redirect(options.noUserRedirect);
								}
								if (options.noUserOk) {
									if (self._verbose) {
										console.log("proceeding with empty user object for: "+principal);
									}
									user = self._emptyUserObject;
									if (!user) {
										return self.error("No emptyUserObject provided during strategy setup and no user object found for: "+principal);
									}
								} else {
									return self.error("No user object found for principal: "+principal);
								} 
							}
							self.success(user, info);
						}
						
						req.session.authenticatedPrincipal = principal;
						
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
