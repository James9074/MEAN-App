var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.ObjectId;

var organizationSchema = mongoose.Schema({
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
		required: true,
	},
	amount: {
		type: Number,
		min: 0,
		required: false, //Not always applicable (e.g. Prayers)
	},
	needType: {
		type: String,
		enum: ['check','paypal'],
		required: true,
	},
	department: {
		type: String, //This needs work - departments should have a schema
	},
	needDate: {
		type: Date,
		required: false, //Not always applicable		
	},
}, {timestamps: true});