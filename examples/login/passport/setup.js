var NegotiateStrategy   = require('passport-negotiate').Strategy;
var User = require('../models/user');

module.exports = function(passport) {

	passport.serializeUser(function(user, done) {
		done(null, user._id);
	});

	passport.deserializeUser(function(id, done) {
		console.log('deserializing user id:',id);
		User.findById(id, function(err, user) {
			done(err, user);
		});
	});

	passport.use('login', 
		// you can enable constrained delegation here but there is considerable setup
		// that must be done for it to work properly. see README
		new NegotiateStrategy({enableConstrainedDelegation:false}, function(principal, done) {
			User.findOne({'principal' : principal}, 
				function(err, user){
					return done(err, user);
				}
			);
		})
	);
};
