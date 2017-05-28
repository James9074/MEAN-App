var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.ObjectId;

var contributionSchema = mongoose.Schema({
	contributor: {
		type: ObjectId,
		ref: 'User',
		required: true,
	},
	need: {
		type: ObjectId,
		ref: 'Need',
		required: true,
	},
	organization: { //Keeping a record of the organization here will make our lives easier when we want to report on all org contributions
		type: ObjectId,
        ref: 'Organization',
		required: true,
	},
	contributionAmount: { //The amount contributed or being pledged
		type: Number,
		min: 0,
		required: true,
	},
	comments: {
		type: String,
		required: false,
	},
 	status: {
        type: String,
        enum: ['pending', 'approved', 'declined', 'incompletePayment'],
		required: true,
	},   
    publicName: { //The name in which the contribution is submitted as
        type: String,
        default: 'Anonymous',
        required: false, 
    },
	pledgeDate: {
		type: Date,
		required: false, //Not always applicable		
	},
}, {timestamps: true});

var Contribution = module.exports = mongoose.model('Contribution', contributionSchema);

module.exports.addContribution = function(newContribution, callback){ //With callback
	newContribution.save(callback);
} 