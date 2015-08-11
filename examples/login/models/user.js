var mongoose = require('mongoose');

module.exports = mongoose.model('User', {
	id: String,
	principal: String,
	email: String,
	firstName: String,
	lastName: String
});
