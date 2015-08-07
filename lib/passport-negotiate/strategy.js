var passport = require('passport')
	, util = require('util');

function Strategy(options, verify) {
	
}

util.inherits(Strategy, passport.Strategy);

Strategy.prototype.authenticate = function(req) {
	
};

module.exports = Strategy;
