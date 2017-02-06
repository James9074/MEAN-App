var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.ObjectId;

var imgSchema = mongoose.Schema({
	fileName: {
		type: String,
	},
	originalName: {
		type: String,
	}
});

var organizationSchema = mongoose.Schema({
	admin: {
		type: ObjectId,
		ref: 'User',
		required: true,
	},
	name: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
		lowercase: true,
	},
	address: {
		type: String,
		required: true,
	},
	city: {
		type: String,
		required: true,
	},
	state: {
		type: String,
		required: true,
	},
	zip: {
		type: String,
		required: true,
	},
	shortPath: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
	},
	paymentOption: {
		type: String,
		enum: ['check','paypal'],
		required: true,
	},
	primaryColor: {
		type: String,
		default: '#2f9b46',
		lowercase: true,
	},
	secondaryColor: {
		type: String,
		default: '#13842b',
		lowercase: true,
	},
	logo: imgSchema,
	welcomeImage: imgSchema,
	welcomeText: {
		type: String,
		default: 'Thank you for visiting our Faith by Deeds site!'
		+ ' This is the perfect place to be if you want to stay updated'
		+ ' with our current needs and requests.'
		+ ' To get started, click the \'Register\' button below. Once you’ve'
		+ ' created an account, you can help out by donating to the various'
		+ ' needs listed on the site.',
	},
	thankYouText: {
		type: String,
		default: 'We would like to thank our donors for their generosity in'
		+ ' donating to our organization. These donors have been vital to'
		+ ' forwarding our vision. To see a list of our current needs, click'
		+ ' the button below.',
	},
	subscribers: [{
		type: ObjectId,
		ref: 'User',
	}],
}, {timestamps: true});

var Organization = module.exports = mongoose.model('Organization', organizationSchema);

module.exports.createOrganization = function(newOrganization, callback){ //With callback
	newOrganization.save(callback);
} 

module.exports.getOrganizationByShortPath = function (shortPath, callback){ //With callback
	var query = {shortPath: shortPath};
	Organization.findOne(query, callback);
}

module.exports.getOrganizationsByAdmin = function (adminId, callback){ //With callback
	var query = {admin: adminId};
	Organization.find(query, callback);
}


// for (var i = 0; i < 10; i++){
// 	new Organization({name: 'Fake Org ' + i, url: 'fakeorg' + i, primaryColor: getRandomColor(), 
// secondaryColor: getRandomColor(), welcomeText: 'Welcome ' + i, thankYouText: 'Welcome ' + i}).save();
// }

// function getRandomColor() {
//     var letters = '0123456789ABCDEF';
//     var color = '#';
//     for (var i = 0; i < 6; i++ ) {
//         color += letters[Math.floor(Math.random() * 16)];
//     }
//     return color;
// }