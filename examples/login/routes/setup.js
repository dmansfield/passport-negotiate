var User = require('../models/user');

var authenticateLocation = '/authenticate-negotiate';
var homeLocation = '/home';

// If the kerberos authentication succeeds we set req.session.authenticatedPrincipal.
// This can happen even when "authentication" fails because we don't have a user
// object for this principal. 
function hasAuthenticatedPrincipal(req, res, next) {
	console.log('check for authenticated principal: '+req.session.authenticatedPrincipal);
	if (!req.session.authenticatedPrincipal) {
		res.redirect(authenticateLocation);
		return;
	}
	next();
}

function isAuthenticated(req, res, next) {
	console.log('check for user: ', req.user);
	if (!req.user) {
		res.redirect(authenticateLocation);
		return;
	}
	next();
}

module.exports = function(app, passport) {
	app.get('/', isAuthenticated, function (req, res) {
		res.redirect('/home');
	});
	
	// this is the only url where we authenticate. we cannot use failedRedirect
	// because Negotiate needs to generate 401 with a specific header back to
	// the browser.  However, authentication can succeed but we don't have a
	// user object in our application, in which case we redirect to /manageprofile
	app.get(authenticateLocation, passport.authenticate('login', {
		successRedirect: homeLocation,
		noUserRedirect: '/manageprofile'
	}));
	
	// successful authentication but no user object found will redirect here
	// where we MUST have req.session.authenticatedPrincipal populated from
	// a successful authentication. 
	app.get('/manageprofile', hasAuthenticatedPrincipal, function(req,res) {
		var user = req.user;
		if (!user) {
			// don't do new User() because it will get an id then.
			user = {};
			user.principal = req.session.authenticatedPrincipal;
		}
		console.log('using user:', user);
		res.render('manageprofile', {
			message: req.flash('message'),
			user: user
		});
	});
	
	// on post, we will create the User object, so ensure we have the trusted
	// principal obtained via authentication.
	app.post('/manageprofile', hasAuthenticatedPrincipal, function(req,res) {
		var user = req.user;
		var principal = req.session.authenticatedPrincipal;
			
		if (!user) {
			user = new User();
			user.principal = principal;
			console.log("creating a new user for "+principal);
		}  else {
			console.log("updating existing user for "+principal);
		}

		user.email = req.param('email');
		user.firstName = req.param('firstName');
		user.lastName = req.param('lastName');

		user.save(function(err) {
			if (err) {
				console.log('Error in saving user: '+err);
				throw err;
			}

			console.log('User registration/update successful for principal: '+principal);

			// because we may have created a new user object, re-login
			// this will serialize the new user object to the session
			req.login(user, function() {
				res.redirect(homeLocation);
			});
		});
	});

	app.post('/deleteprofile', isAuthenticated,	function(req, res) {
		User.findOneAndRemove({principal: req.session.authenticatedPrincipal}, 
			function(err) {
				if (err) {
					console.log('Error in deleting user: '+err);
					throw err;
				}
				res.redirect('/signout');
			}
		);
	});
	
	app.get(homeLocation, isAuthenticated, function(req, res) {
		console.log('available credential cache: ', req.session.delegatedCredentialsCache);
		res.render('home', {user : req.user, loggedInAt : req.session.loggedInAt});
	});
	
	app.get('/signout',	function(req,res) {
		req.logout();
		req.session.authenticatedPrincipal = null;
		res.render('signedout');
	});
};
