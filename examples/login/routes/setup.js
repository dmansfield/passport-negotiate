var User = require('../models/user');

var hasValidUser = function (req, res, next) {
    if (req.user && req.user._id) {
            return next();
    }
    // if the user is not authenticated then redirect him to the login page
    res.redirect('/');
};

module.exports = function(app, passport) {
	// With Negotiate, there is no login page because credentials must be
	// obtained by the user-agent by interacting with the client OS  
	app.get('/', passport.authenticate('login', {
		successRedirect: '/home',
		noUserRedirect: '/manageprofile'
	}));
	
	// if someone hits manageprofile with GET, we authenticate to 
	// get the user principal from kerberos.  Note: in this case we allow
	// "success" without a real user object.  The "empty" user will be used.
	app.get('/manageprofile', 
		passport.authenticate('login', { noUserOk: true }), 
		function(req,res) {
			res.render('manageprofile', {
				message: req.flash('message'),
				user: req.user,
				authenticatedPrincipal: req.session.authenticatedPrincipal
			});
		}		
	);
	
	// on post, we will create the User object, so ensure we use the trusted
	// principal obtained via authentication. we may also get the empty user
	// if this is a new user.
	app.post('/manageprofile',
		passport.authenticate('login', { noUserOk: true }), 
		function(req,res) {
			var user = req.user;
			var principal = req.session.authenticatedPrincipal;
			
			// check for "empty" user.
			if (!user._id) {
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
					res.redirect('/home');
				});
			});
		}
	);

	app.post('/deleteprofile', hasValidUser, function(req, res) {
		User.findOneAndRemove({principal: req.session.authenticatedPrincipal}, function(err) {
			if (err) {
				console.log('Error in deleting user: '+err);
				throw err;
			}
			res.redirect('/signout');
		});
	});
	
	app.get('/home', hasValidUser, function(req, res) {
		res.render('home', {user : req.user, loggedInAt : req.session.loggedInAt});
	});
	
	app.get('/signout', function(req,res) {
		req.logout();
		res.render('signedout');
	});
};
