var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var imgSchema = mongoose.Schema({
	fileName: {
		type: String,
	},
	originalName: {
		type: String,
	}
});

var userSchema = mongoose.Schema({
	firstName: {
		type: String,
		required: true
	},
	lastName: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true,
		unique: true,
		lowercase: true
	},
	password: {
		type: String,
		required: true
	},
	avatar: imgSchema,
}, {timestamps: true});


var User = module.exports = mongoose.model('User', userSchema);

module.exports.createUser = function(newUser, callback){
	bcrypt.genSalt(10, function(err, salt){
		if (err) throw err;
		bcrypt.hash(newUser.password, salt, function(err, hash){
			if (err) throw err;
			newUser.password = hash;
			newUser.save(callback);
		})
	});
}

module.exports.getUserById = function (id, callback){
	User.findById(id, callback);
}

module.exports.getUserByEmail = function (email, callback){
	var query = {email: email};
	User.findOne(query, callback);
}

module.exports.comparePassword = function(candidatePassword, hash, callback){
	bcrypt.compare(candidatePassword, hash, function(err, isMatch){
		if (err) throw err;
		callback(null, isMatch);
	});
}