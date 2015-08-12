//
// This application demonstrates a simple use of the passport-negotiate strategy.
// The passport-negotiate module, which uses the kerberos module, requires 
// access to a keytab, and the default location /etc/krb5.keytab probably
// requires root access.  You can set the KRB5_KTNAME environment variable
// to point to an approprate location.  The keytab should contain the key
// for the service principal HTTP/your.server@YOUR.REALM. 
//
// Because Negotatiate authentication is "seamless" there is no login page
// in this application.  A user that cannot be authenticated by the underlying
// kerberos platform will not be able to access any part of the application.
// The application also demonstrates that kerberos authentication can
// succeed but still not have an application-level "user" object.
//
// This application consists of two pages (mainly), /home which shows
// the profile and /manageprofile which manages it. New users which have been
// authenticated but for whom there is not user object are forced to create a 
// profile. Profiles can be deleted.
// 
// Of particular interest are passport/setup.js and routes/setup.js
//
// Please configure a mongo db connection in dbConfig.js 
//

var flash = require('connect-flash');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var mongoose = require('mongoose');
var passport = require('passport');

var dbConfig = require('./dbConfig');
mongoose.connect(dbConfig.url);

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname, 'public/favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(session({secret:'wUpHucup5'}));
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
app.use(passport.session());

var passportSetup = require('./passport/setup');
passportSetup(passport);

var routingSetup = require('./routes/setup');
routingSetup(app, passport);

app.use(function(req, res, next) {
	var err = new Error('Not found');
	err.status = 404;
	next(err);
});

if ('development' === app.get('env')) {
	app.use(function(err, req, res, next){
		res.status(err.status || 500);
		res.render('error',{
			message : err.message
			, error: err
		});
	});
}

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
	console.log('Express server listening on port '+ server.address().port);
});
