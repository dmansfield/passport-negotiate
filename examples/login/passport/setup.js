var NegotiateStrategy   = require('passport-negotiate').Strategy;
var User = require('../models/user');

var EmptyUser = {};

/**
 * setup passport and strategies
 */
module.exports = function(passport) {

	// we have to worry a bit about EmptyUser when serializing / deserializng
	passport.serializeUser(function(user, done) {
		console.log('serializing user:', user);
		// only id gets serialized
		done(null, user === EmptyUser ? 0 : user._id);
	});

	passport.deserializeUser(function(id, done) {
		console.log('deserializing user id:',id);
		if (id === 0) {
			// FIXME: nextTick?
			done(null, EmptyUser);
		} else {
			User.findById(id, function(err, user) {
				if (err) {
					console.error('Error deserializing user: '+err);
					throw err;
				}
				console.log('deserialized user:',user);
				done(err, user);
			});
		}
	});

	passport.use('login', 
		new NegotiateStrategy(
			{
				passReqToCallback: true
				, emptyUserObject: EmptyUser
			}, 
			function(req, principal, done) {
				User.findOne({ 'principal' : principal}, 
					function(err, user){
						if (err) {
							console.log('Error in login: '+err);
							return done(err);
						}
						// we may or may not have a user, but authentication succeeded
						// and we MUST not worry about EmptyUser here. let the
						// strategy take care of that.
						return done(null, user);
					}
				);
			}
		)
	);

};
