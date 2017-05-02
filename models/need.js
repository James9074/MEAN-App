var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.ObjectId;

var needSchema = mongoose.Schema({
	creator: {
		type: ObjectId,
		ref: 'User',
		required: true,
	},
	organization: {
		type: ObjectId,
		ref: 'Organization',
		required: true,
	},
	title: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: false,
	},
	goalAmount: { //The goal amount
		type: Number,
		min: 0,
		required: false, //Not always applicable (e.g. Prayers)
	},
	currentAmount: { //The amount currently had
		type: Number,
		min: 0,
		required: false,
	},
	needType: {
		type: String,
		enum: ['monetary','non-monetary'],
		required: true,
	},
	department: {
		type: ObjectId,
		ref: 'Department',
		required: true,
	},
	needDate: {
		type: Date,
		required: false, //Not always applicable		
	},
	contributions: [{
		type: ObjectId,
		ref: 'Contribution',		
	}],
	status: {
		type: String,
		enum: ['public', 'archived'],
		default: 'public',
		required: true,
	},
}, {timestamps: true});

var Need = module.exports = mongoose.model('Need', needSchema);

module.exports.createNeed = function(newNeed, callback){ //With callback
	newNeed.save(callback);
} 