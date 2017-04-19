var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.ObjectId;

var departmentSchema = mongoose.Schema({
	departmentName: {
		type: String,
		required: true,
	},
	advocates: [{
		type: ObjectId,
		ref: 'User',
        unique: true,
	}],
}, {timestamps: true});

var Department = module.exports = mongoose.model('Department', departmentSchema);