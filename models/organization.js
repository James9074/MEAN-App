var mongoose = require('mongoose');

var organizationSchema = mongoose.Schema({
	name: String,
	url: String,
	primaryColor: String,
	secondaryColor: String,
	welcomeText: String,
	thankYouText: String
}, {timestamps: true});

var Organization = mongoose.model('Organization', organizationSchema);

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

module.exports = Organization;