var express = require('express');
var _ = require('lodash');
var router = express.Router();
var Organization = require('../models/organization');
var Department = require('../models/department');
var Need = require('../models/need');
var User = require('../models/user');
var Contribution = require('../models/contribution');
var multer = require('multer');
var path = require('path');
var crypto = require('crypto');
var fs = require('fs');
var ipn = require('paypal-ipn');
var request = require('request');
var Config = require('../config.js');

//Require and configure nodemailer
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: Config.emailService,
    auth: {
        user: Config.emailUser,
        pass: Config.emailPass,
    }
});

//sendEmail function
function sendEmail(subject, msg, email) {
	var mailOptions = {
		from: '"FaithByDeeds" <'+ Config.emailUser +'>', // sender address
		to: email,
		subject: subject,
		text: msg,
	};

	transporter.sendMail(mailOptions, (err, info) => {
		if (error) throw error;
		//Message Sent
	})
}

//sendEmail function with cc address
function sendEmailCC(subject, msg, email, cc) {
	var mailOptions = {
		from: '"FaithByDeeds" <'+ Config.emailUser +'>', // sender address
		to: email,
		cc: cc,
		subject: subject,
		text: msg,
	};

	transporter.sendMail(mailOptions, (err, info) => {
		if (error) throw error;
		//Message Sent
	})
}

//Upload file extension
var storage = multer.diskStorage({
	destination: function (req, file, cb){
		cb(null, './public/uploads/');
	},
	filename: function (req, file, cb) {
			crypto.pseudoRandomBytes(16, function(err, raw){
				if (err) throw err;
				cb(null, raw.toString('hex') + Date.now() + '.jpg'); //Appending .jpg
			});
	},
});

//Upload directory and file filter
var uploading = multer({
	storage: storage,
	fileFilter: function(req, file, cb){
		if (path.extname(file.originalname) !== '.jpg') {
			req.flash('error','Images must be in jpeg format.');
			return cb(null, false);
		}
		cb(null, true);
	},
});

function ensureAuthenticated(req, res, next){
	if (req.isAuthenticated()){
		return next();
	} else {
		req.flash('error_msg', 'You are not logged in.');
		res.redirect('/login');
	}
}

var isAdmin = function(org, user) {
	return (user && (org.admin.id === user.id))
}

var isSubscriber = function(org, user) {
	return (user && (user.subscriptions.indexOf(org.id) >= 0));
}

var isAdvocateOfNeed = function(need, user) {
	if (!user) return false;
	if  (need.department.advocates.indexOf(user.id) == -1) return false;
	return true;
}

var isAdvocateforOrg = function (org, user) {
	if (!user) return false;
	var depts = _.filter(org.departments, function(o){ return (o.advocates.indexOf(user.id) != -1)});
	if (depts.length > 0) return true;
	return false;
}

var isAdvocateforOrgPopped = function (org, user) { //Only if the advocates have been populated
	if (!user) return false;

	var depts = _.filter(org.departments, function(o){
	
		var adv = _.filter(o.advocates, function(u){
			return (u.id == user.id); 
		})
		 return (adv.length > 0);
	});

	if (depts.length > 0) return true;
	return false;
}

/* GET home page. */
router.get('/:name', function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			Contribution.find({$and: [{organization: org.id}, {status: 'approved'}]}).populate('contributor need').limit(12).exec(function(err, contributions){
				if (err) throw err;
				var panels = 4; //The number of panels per slide set
				res.render('org/orgIndex', {layout: 'layouts/orgLayout',
					title: org.name, 
					org: org, 
					isAdmin: isAdmin(org, req.user),
					isSubscriber: isSubscriber(org, req.user),
					activeMenuItem: 'homeMenuItem',
					contributions: contributions,
					slideSets: Math.ceil(contributions.length / 4.0),
					panels: panels,
				});
			});
		} else {
			next();
		}	
	});
});

/* POST to /subscribe */
router.get('/:name/subscribe', ensureAuthenticated, function (req, res, next){

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (!isSubscriber(org, req.user)){
				req.user.subscriptions.push(org.id);
				req.user.save();
				org.subscribers.push(req.user.id);
				org.save();
				req.flash('success_msg', 'You are now a subscriber of this organization.')
				res.redirect('/org/' + org.shortPath);
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	});

});

/* GET needs. */
router.get('/:name/needs', function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').populate({path: 'needs', populate: {path: 'creator department'}}).exec(function(err, org){
		if (err) throw err;
		if (org){

			var needs = org.needs;
			
			//Only show public needs - not archived
			needs = _.filter(needs, function(o){ return (o.status == "public")});

			if (isAdmin(org, req.user) && req.query.archive) {
				needs = _.filter(needs, function(o){ return (o._id == req.query.archive)});
				if (needs.length == 1) {
					needs[0].status = "archived";
					needs[0].save();
					req.flash('success_msg', 'The need was archived.');
					res.redirect('/org/' + org.shortPath + '/needs');
				} else {
					req.flash('error', 'There was a problem processing the request.');
					res.redirect('/org/' + org.shortPath + '/needs');					
				}
			} else {
				//Filter by department
				if(req.query.department){
					needs = _.filter(needs, function(o){ return (o.department.departmentName == req.query.department)});
				}

				//Filter by search term
				if (req.query.search){
					needs = _.filter(needs, function(o){ return (o.title.toLowerCase().indexOf(req.query.search.toLowerCase()) != -1)});
				}

				//Sort
				needs = _.sortBy(needs, "createdAt").reverse();
				if (req.query.sortBy){
					if (req.query.sortBy == "oldest") needs.reverse();
				}

				res.render('org/orgNeeds', {layout: 'layouts/orgLayout',
					user: req.user,
					title: org.name, 
					org: org, 
					pageHeader: 'Needs', 
					isAdmin: isAdmin(org, req.user), 
					isSubscriber: isSubscriber(org, req.user),
					isAdvocate: isAdvocateforOrg(org, req.user),
					activeMenuItem: 'needsMenuItem',
					needs: needs,
					query: req.query,
				});				
			}
		} else {
			next();
		}	
	});
});

/* GET and POST to needs/new */
router.get('/:name/needs/new', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdvocateforOrg(org, req.user)) {
				res.render('org/orgEditNeed', {layout: 'layouts/orgLayout',
					user: req.user,
					title: org.name, 
					org: org, 
					pageHeader: 'Add Need', 
					isAdmin: isAdmin(org, req.user), 
					isSubscriber: isSubscriber(org, req.user),
				});
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}	
	});
});

/* GET the needs archive */
router.get('/:name/archive', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').populate({path: 'needs', populate: {path: 'creator department'}}).exec(function(err, org){
		if (err) throw err;
		if (org){

			if (isAdmin(org, req.user)) {

				var needs = org.needs;
				
				//Only show archived needs - not public
				needs = _.filter(needs, function(o){ return (o.status == "archived")});

				if (req.query.publish) {
					needs = _.filter(needs, function(o){ return (o._id == req.query.publish)});
					if (needs.length == 1) {
						needs[0].status = "public";
						needs[0].save();
						req.flash('success_msg', 'The need was published.');
						res.redirect('/org/' + org.shortPath + '/needs');
					} else {
						req.flash('error', 'There was a problem processing the request.');
						res.redirect('/org/' + org.shortPath + '/needs');					
					}
				} else {
			
					//Filter by department
					if(req.query.department){
						needs = _.filter(needs, function(o){ return (o.department.departmentName == req.query.department)});
					}

					//Filter by search term
					if (req.query.search){
						needs = _.filter(needs, function(o){ return (o.title.toLowerCase().indexOf(req.query.search.toLowerCase()) != -1)});
					}

					//Sort
					needs = _.sortBy(needs, "createdAt").reverse();
					if (req.query.sortBy){
						if (req.query.sortBy == "oldest") needs.reverse();
					}

					res.render('org/orgArchive', {layout: 'layouts/orgLayout',
						user: req.user,
						title: org.name, 
						org: org, 
						pageHeader: 'Archive', 
						isAdmin: true, 
						isSubscriber: true,
						isAdvocate: true,
						needs: needs,
						query: req.query,
					});
				}				
			} else {
				res.redirect('/org/' + org.shortPath + '/needs');				
			}
		} else {
			next();
		}	
	});
});

router.post('/:name/needs/new', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdvocateforOrg(org, req.user)) {

				//Create need
				var needTitle = req.body.needTitle;
				var amount = req.body.amount;
				var needType = req.body.needType;
				var department = req.body.department;
				var needDate = req.body.needDate;
				var description = req.body.description;

				//Validation
				req.assert('needTitle', 'Need title is a required field.').notEmpty();
				req.assert('amount', 'Quantity or Amount must be a positive number').isInt({min: 0});
				req.assert('needType', 'Need type is a required field').notEmpty();
				req.assert('department', 'Department is a required field.').notEmpty();
				req.assert('needDate', 'Needed by must be a valid date.').isDate();
				req.assert('needDate', 'Needed by must be a date later than today.').isAfter();
				req.assert('discription', 'Description must be no more than 400 characters.').isLength(0,400);

				req.getValidationResult().then(function(result){
					if (!result.isEmpty()){
						res.render('org/orgEditNeed', {layout: 'layouts/orgLayout',
							user: req.user,
							title: org.name, 
							org: org, 
							pageHeader: 'Add Need', 
							isAdmin: isAdmin(org, req.user),
							isSubscriber: isSubscriber(org, req.user),
							errors: result.useFirstErrorOnly().array(),	
						});						
					} else {
						//Make sure that the specified department exists and has the user listed as advocate
						var deptArray = []; //The list of depts the user is an advocate for
						var orgDepts = []; //The list of depts in the organization

						Department.find({advocates: req.user.id}, function (err, depts) {
							if (err){
								return done(err);
							}

							depts.forEach(function(val){
								deptArray.push(val.id);
							});

							//Now we need to generate an array of departments ACTUALLY in the organization
							org.departments.forEach(function(dept){
								orgDepts.push(dept.id);
							});

							//If either condition is false, the form must fail.
							if ((deptArray.indexOf(department) == -1) || (orgDepts.indexOf(department) == -1)){

								req.flash('error', 'An error occurred while processing the request.');
								res.redirect('/org/' + org.shortPath + '/needs/new');
							}
							else{
								//Create need
								var newNeed = new Need({
									creator: req.user.id,
									organization: org.id,
									title: needTitle,
									description: description,
									goalAmount: amount,
									currentAmount: 0,
									needType: needType,
									department: department,
									needDate: needDate,
								});

								//Make sure we add the need to the organization
								org.needs.push(newNeed.id);
								//Save the need and the organization
								newNeed.save();
								org.save();

								req.flash('success_msg', 'Need was successfully created.');
								res.redirect('/org/' + org.shortPath + '/needs');
							}
						});

					}
				});

			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	});	

});

/* GET and POST to needs/contribute */
router.get('/:name/needs/contribute/:need', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').exec(function(err, org){
		if (err) throw err;
		if (org){
			//Find the need
			Need.findOne({$and: [{_id: req.params.need}, {organization: org.id}, {status: 'public'}]}).populate('department').exec(function(err, need){
				if (err) throw err;
				if (need){
					if (isSubscriber(org, req.user)) {
						res.render('org/orgContribute', {layout: 'layouts/orgLayout',
							user: req.user,
							title: org.name, 
							org: org, 
							pageHeader: 'Contribute', 
							isAdmin: isAdmin(org, req.user), 
							isSubscriber: isSubscriber(org, req.user),
							monetaryNeed: (need.needType == "monetary"),
							need: need,
							paypalEmail: Config.paypalEmail,
							fullURL: req.protocol + '://' + req.get('host') + req.originalUrl,
						});
					} else {
						res.redirect('/org/' + org.shortPath + '/needs');
					}
				} else {
					next();
				}
			});

		} else {
			next();
		}

	});
});

router.post('/:name/needs/contribute/:need', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').exec(function(err, org){
		if (err) throw err;
		if (org){
			//Find the need
			Need.findOne({$and: [{_id: req.params.need}, {organization: org.id}]}).populate('creator department').exec(function(err, need){
				if (err) throw err;
				if (need){
					if (isSubscriber(org, req.user)) {
						
						//Grab req.body variables
						var donationAmount = req.body.donationAmount;
						var comments = req.body.comments;
						var publicName = req.body.publicName;

						if (need.needType == "monetary") {
							donationAmount = parseFloat(donationAmount).toFixed(2);
						} else {
							donationAmount = Math.trunc(donationAmount);
							var pledgeDate = req.body.pledgeDate;
						}

						//Form validation
						req.assert('donationAmount', 'The donation amount is required.').notEmpty();
						req.assert('donationAmount', 'The donation amount must be a number.').isFloat();
						req.assert('comments', 'The comments field should be no more than 400 characters.').isLength(0, 400);
						req.assert('publicName', 'The contribute as name must be no more than 50 characters.').isLength(0, 50);
						
						if (!(need.needType == "monetary")) {
							req.assert('pledgeDate', 'The delivery estimate is required.').notEmpty();							
							req.assert('pledgeDate', 'The delivery estimate must be a valid date.').isDate();
							req.assert('pledgeDate', 'The delivery estimate must be later than today.').isAfter();
						}

						req.getValidationResult().then(function(result){
							if (!result.isEmpty()){
								res.render('org/orgContribute', {layout: 'layouts/orgLayout',
									user: req.user,
									title: org.name, 
									org: org, 
									pageHeader: 'Contribute', 
									isAdmin: isAdmin(org, req.user), 
									isSubscriber: isSubscriber(org, req.user),
									monetaryNeed: (need.needType == "monetary"),
									need: need,
									errors: result.useFirstErrorOnly().array(),	
								});						
							} else {
								//If monetary, we redirect this to paypal.com
								if (need.needType == 'monetary'){

									//Go ahead and create the contribution, and set it to 'Pending'. We will use the IPN to set it to 'Approved'
									var newContribution = new Contribution({
										contributor: req.user.id,
										need: need.id,
										organization: org.id,
										contributionAmount: donationAmount,
										comments: comments,
										status: 'incompletePayment',
									});

									if (publicName) newContribution.publicName = publicName;
									if (pledgeDate) newContribution.pledgeDate = pledgeDate;

									newContribution.save();
									need.contributions.push(newContribution.id);
									need.save();

									res.redirect(307, 'https://www.paypal.com/cgi-bin/webscr?custom=' + newContribution.id);
								} else {
									var newContribution = new Contribution({
										contributor: req.user.id,
										need: need.id,
										organization: org.id,
										contributionAmount: donationAmount,
										comments: comments,
										status: 'pending',
									});

									if (publicName) newContribution.publicName = publicName;
									if (pledgeDate) newContribution.pledgeDate = pledgeDate;

									newContribution.save();
									need.contributions.push(newContribution.id);
									need.save();

									/* Send email to contributor and org admin */
									var msg = "Hello,\n\nYou have pledged to contribute" + donationAmount + " of the needed items to the need '" + need.title + "'. The expected delivery date is " + pledgeDate + "."
										+ "\n\nOnce the items have been delivered and the donation status has been updated, the donation will appear on the site. \n\nThank you so much!\n\nOrganization address:\n\n" + org.address + "\n" + org.city + "\n" + org.state + "\n" + org.zip;
									var subject = "FaithByDeeds - You've just made a pledge!";
									sendEmail(subject, msg, req.user.email);									

									var msg = req.user.firstName + " " + req.user.lastName + " (" + req.user.email + ") has pledged to donate to your need, '" + need.title + "'!\n\n" 
										+ "The status of the contribution is 'Pending'. Once the items have been delivered, the organization administrator should change the status to 'Approved'. \n\nQuantity: " + donationAmount + "\n\nExpected Delivery: " + pledgeDate;
									var subject = "FaithByDeeds - There has been a donation made to your need!";
									sendEmailCC(subject, msg, org.admin.email, need.creator.email);									

									req.flash('success_msg', 'You contributed to \''+ need.title + '\'');
									res.redirect('/org/' + org.shortPath + '/needs');
								}
							}
						});

					} else {
						res.redirect('/org/' + org.shortPath + '/needs');
					}
				} else {
					next();
				}
			});

		} else {
			next();
		}

	});
});

/* GET and POST to needs/edit */
router.get('/:name/needs/edit/:need', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').exec(function(err, org){
		if (err) throw err;
		if (org){
			//Find the need
			Need.findOne({$and: [{_id: req.params.need}, {organization: org.id}]}).populate('department').exec(function(err, need){
				if (err) throw err;
				if (need){
					if (isAdvocateOfNeed(need, req.user)) {
						res.render('org/orgEditNeed', {layout: 'layouts/orgLayout',
							user: req.user,
							title: org.name, 
							org: org, 
							pageHeader: 'Edit Need', 
							isAdmin: isAdmin(org, req.user), 
							isSubscriber: isSubscriber(org, req.user),
							need: need,
						});
					} else {
						res.redirect('/org/' + org.shortPath + '/needs');
					}
				} else {
					next();
				}
			});

		} else {
			next();
		}

	});
});

router.post('/:name/needs/edit/:need', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin departments').exec(function(err, org){
		if (err) throw err;
		if (org){
			//Find the need
			Need.findOne({$and: [{_id: req.params.need}, {organization: org.id}]}).populate('department').exec(function(err, need){
				if (err) throw err;
				if (need){
					if (isAdvocateOfNeed(need, req.user)) {

						//Update need
						var needTitle = req.body.needTitle;
						var amount = req.body.amount;
						var needType = req.body.needType;
						var department = req.body.department;
						var needDate = req.body.needDate;
						var description = req.body.description;

						//Validation
						req.assert('needTitle', 'Need title is a required field.').notEmpty();
						req.assert('amount', 'Quantity or Amount must be a positive number').isInt({min: 0});
						req.assert('needType', 'Need type is a required field').notEmpty();
						req.assert('department', 'Department is a required field.').notEmpty();
						req.assert('needDate', 'Needed by must be a valid date.').isDate();
						req.assert('needDate', 'Needed by must be a date later than today.').isAfter();
						req.assert('discription', 'Description must be no more than 400 characters.').isLength(0,400);

						req.getValidationResult().then(function(result){
							if (!result.isEmpty()){
								res.render('org/orgEditNeed', {layout: 'layouts/orgLayout',
									user: req.user,
									title: org.name, 
									org: org, 
									pageHeader: 'Edit Need', 
									isAdmin: isAdmin(org, req.user), 
									isSubscriber: isSubscriber(org, req.user),
									need: need,
									errors: result.useFirstErrorOnly().array(),	
								});						
							} else {
								//Make sure that the specified department exists and has the user listed as advocate
								var deptArray = []; //The list of depts the user is an advocate for
								var orgDepts = []; //The list of depts in the organization

								Department.find({advocates: req.user.id}, function (err, depts) {
									if (err){
										return done(err);
									}

									depts.forEach(function(val){
										deptArray.push(val.id);
									});

									//Now we need to generate an array of departments ACTUALLY in the organization
									org.departments.forEach(function(dept){
										orgDepts.push(dept.id);
									});

									//If either condition is false, the form must fail.
									if ((deptArray.indexOf(department) == -1) || (orgDepts.indexOf(department) == -1)){

										req.flash('error', 'An error occurred while processing the request.');
										res.redirect('/org/' + org.shortPath + '/needs/new');
									}
									else{
										//Update need

										need.title = needTitle;
										need.description = description;
										need.goalAmount = amount;
										need.needType = needType;
										need.department = department;
										need.needDate = needDate;
										
										//Save the need and the organization
										need.save();

										req.flash('success_msg', 'Need was successfully updated.');
										res.redirect('/org/' + org.shortPath + '/needs');
									}
								});
							
							}
						});

					} else {
						res.redirect('/org/' + org.shortPath + '/needs');
					}
				} else {
					next();
				}
			});

		} else {
			next();
		}

	});
});

/* GET needs success and failure */
router.get('/:name/needs/success', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).exec(function(err, org){
		if (err) throw err;
		if (org){
			req.flash('success_msg', 'The need will be updated once the payment has been processed.');
			res.redirect('/org/' + org.shortPath + '/needs');
		} else {
			next();
		}
	});
});

router.get('/:name/needs/failure', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).exec(function(err, org){
		if (err) throw err;
		if (org){
			req.flash('error', 'A problem occurred during the payment process.');
			res.redirect('/org/' + org.shortPath + '/needs');
		} else {
			next();
		}
	});
});

/* This route exists to make sure payments were processed, and to create the monetary contribution as a response */
router.post('/:name/needs/IPNhandler', function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){

			res.send(200);

			ipn.verify(req.body, {'allow_sandbox': true}, function callback(err, msg) {
				if (err) {
					throw (err);
				} else {

					if (req.body.payment_status == 'Completed') {
						// Payment has been confirmed as completed
						Contribution.findOne({_id: req.body.custom}).populate('contributor').exec(function(err, contribution){
							if (err) throw err;
							if (contribution) {
								Need.findOne({_id: contribution.need}).populate('creator').exec(function(err, need){
									if (err) throw err;
									if (need) {
										contribution.status = "approved";
										contribution.save();
										need.currentAmount += contribution.contributionAmount;
										
										/* Send email to contributor and org admin */
										var msg = "Hello,\n\nYou have contributed $" + parseFloat(contribution.contributionAmount).toFixed(2) + " to the need '" + need.title + "'.\n\nThank you!";
										var subject = "FaithByDeeds - You've just made a contribution!";
										sendEmail(subject, msg, contribution.contributor.email);									

										var msg = contribution.contributor.firstName + " " + contribution.contributor.lastName + " (" + contribution.contributor.email + ") has donated to your need, '" + need.title + "'!\n\n" 
											+ "Amount: $" + parseFloat(contribution.contributionAmount).toFixed(2);
										var subject = "FaithByDeeds - There has been a donation made to your need!";
										sendEmailCC(subject, msg, org.admin.email, need.creator.email);					
										
										need.save();
									} else {

									}
								});
							} else {

							}
						});
					} else {

					} 
				}
			});


		} else {
			next();
		}
	});
});

/* GET and POST theme settings. */
router.get('/:name/theme', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {
				res.render('org/orgThemeSettings', {layout: 'layouts/orgLayout',
					title: org.name, 
					org: org, 
					pageHeader: 'Theme Settings', 
					isAdmin: true, 
					isSubscriber: true,
				});
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}	
	});
});

router.post('/:name/theme', ensureAuthenticated, uploading.fields([{name: 'logo', maxCount: 1},{name: 'welcomeImage', maxCount: 1}]), function(req, res) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {	
				//Update org
				var primaryColor = req.body.primaryColor;
				var secondaryColor = req.body.secondaryColor;
				var welcomeText = req.body.welcomeText;
				var thankYouText = req.body.thankYouText;

				//Validation
				req.assert('primaryColor', 'There was an issue with the primary color.').isLength(6, 6);
				req.assert('primaryColor', 'There was an issue with the primary color.').matches(/^[a-fA-F0-9]*$/g);
				req.assert('secondaryColor', 'There was an issue with the primary color.').isLength(6, 6);
				req.assert('secondaryColor', 'There was an issue with the primary color.').matches(/^[a-fA-F0-9]*$/g);
				req.assert('welcomeText', 'Welcome text should be 200-400 characters.').isLength(200,400);
				req.assert('thankYouText', 'Thank you text should be 150-350 characters.').isLength(150,350);			

				req.getValidationResult().then(function(result){

					if (!result.isEmpty()){
						res.render('org/orgThemeSettings', {layout: 'layouts/orgLayout',
							title: org.name, 
							org: org, 
							pageHeader: 'Theme Settings', 
							isAdmin: true,
							errors: result.useFirstErrorOnly().array(),							
						});
					} else {
						//Assigning
						if (primaryColor){
							org.primaryColor = '#' + primaryColor;
						}

						if (secondaryColor){
							org.secondaryColor = '#' + secondaryColor;
						}

						//Logo
						if (req.files.logo){
							var logo = {
						 		fileName: req.files.logo[0].filename,
								originalName: req.files.logo[0].originalname						
							}

							//Remove old logo from disk if there is one
							if (org.logo){
								var filePath = './public/uploads/' + org.logo.fileName; 
								fs.unlinkSync(filePath);
							}

							org.logo = logo;
						}
						//Logo
						if (req.files.welcomeImage){
							var welcomeImage = {
						 		fileName: req.files.welcomeImage[0].filename,
								originalName: req.files.welcomeImage[0].originalname						
							}
							//Remove old welcome image from disk if there is one
							if (org.welcomeImage){
								var filePath = './public/uploads/' + org.welcomeImage.fileName; 
								fs.unlinkSync(filePath);
							}
							org.welcomeImage = welcomeImage;
						}

						//Welcome and Thank you text
						org.welcomeText = welcomeText;
						org.thankYouText = thankYouText;

						org.save();
						req.flash('success_msg', 'Theme settings updated.')
						res.redirect('/org/' + org.shortPath + '/theme');
					}
				});
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	
	});
});

/* GET and POST to departments */
router.get('/:name/departments', ensureAuthenticated, function(req, res, next) {
	Organization.findOne({shortPath: req.params.name}).populate('admin').populate({path: 'departments', populate: {path: 'advocates'}}).exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {
				if (req.query.removeAdv && req.query.dept){
					Department.findOne({"$and": [{organization: org.id}, {_id: req.query.dept}]}).exec(function(err, dept){ //Get the department and make sure we own it
						if (err) throw err;
						if (req.query.removeAdv == req.user.id) dept = false; //Cannot remove the admin from a department
						if (dept){
							//Remove the advocate from department
							dept.advocates.pull({_id: req.query.removeAdv});
							dept.save();
							//Delete the department
							req.flash('success_msg', 'The advocate was removed.');
						} else {
							req.flash('error', 'There was an error processing the request.');
						}
						res.redirect('/org/' + org.shortPath + '/departments');
					});					
				} else if (req.query.delete){

					//Make sure there are no needs under this department
					Need.findOne({department: req.query.delete}).exec(function(err, need){
						if (!need) {
							//Delete department
							Department.findOne({"$and": [{organization: org.id}, {_id: req.query.delete}]}).exec(function(err, dept){
								if (err) throw err;
								if (dept.id == org.departments[0].id) dept = false; //Cannot delete the General department
								if (dept){
									//Remove the department from organization
									org.departments.pull({_id: dept.id});
									org.save();
									//Delete the department
									dept.remove();
									req.flash('success_msg', 'The department was removed.');
								} else {
									req.flash('error', 'There was an error processing the request.');
								}
								res.redirect('/org/' + org.shortPath + '/departments');
							});
						} else {
							req.flash('error', 'A department may not be removed while there are still needs associated with it.');
							res.redirect('/org/' + org.shortPath + '/departments');
						}
					})
				} else {
					res.render('org/orgDepartments', {layout: 'layouts/orgLayout',
						title: org.name, 
						org: org, 
						pageHeader: 'Departments', 
						isAdmin: true, 
						isSubscriber: true,
					});
				}
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}	
	});
});

router.post('/:name/departments', ensureAuthenticated, function(req, res, next) {
	Organization.findOne({shortPath: req.params.name}).populate('admin').populate({path: 'departments', populate: {path: 'advocates'}}).exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {

				//If deptId exists, the add advocate form was submitted, instead of the new department form
				if (req.body.deptId) {
					var advocateEmail = req.body.advocateEmail;

					req.assert('advocateEmail', 'You did not enter a valid email address').isEmail();

					req.getValidationResult().then(function(result){
						if (!result.isEmpty()){
							res.render('org/orgDepartments', {layout: 'layouts/orgLayout',
								title: org.name, 
								org: org, 
								pageHeader: 'Departments', 
								isAdmin: true,
								isSubscriber: true,
								errors: result.useFirstErrorOnly().array(),	
							});	
						} else {
							var dept = _.filter(org.departments, function(o){ return (o.id == req.body.deptId)});

							//Make sure we've gotten a result (The department must be in the orgs list of departments)
							if (dept.length == 1) {
								//Now let's make sure the email doesn't exist in the list of advocates
								var advocate = _.filter(dept[0].advocates, function(o){ return (o.email.toLowerCase() == req.body.advocateEmail.toLowerCase())});

								if (advocate.length > 0) {
									//The advocate already exists
									req.flash('error', 'The specified advocate already exists for this department.');
									res.redirect('/org/' + org.shortPath + '/departments');										
								} else {

									User.findOne({email: req.body.advocateEmail.toLowerCase()}).exec(function(err, user){
										if (err) throw err;

										if (user) {
											//Add the advocate to the department and save the department
											dept[0].advocates.push(user.id);
											dept[0].save();
											req.flash('success_msg', 'The advocate was successfully added.');
											res.redirect('/org/' + org.shortPath + '/departments');	
										} else {
											req.flash('error', 'A user with that email address does not exist. Make sure the user has a FaihByDeeds account.');
											res.redirect('/org/' + org.shortPath + '/departments');	
										}

									});
								}							
							} else {
								req.flash('error', 'There was a problem processing the request');
								res.redirect('/org/' + org.shortPath + '/departments');	
							}
						}
					});

				} else {
					var departmentName = req.body.departmentName;

					req.assert('departmentName', 'The department name is required.').notEmpty();
					req.assert('departmentName', 'The department name should be no more than 50 characters.').isLength(0, 50);

					req.getValidationResult().then(function(result){
						if (!result.isEmpty()){
							res.render('org/orgDepartments', {layout: 'layouts/orgLayout',
								title: org.name, 
								org: org, 
								pageHeader: 'Departments', 
								isAdmin: true,
								isSubscriber: true,
								errors: result.useFirstErrorOnly().array(),	
							});						
						} else {
							//Create the department
							var newDepartment = new Department({
								organization: org.id,
								departmentName: departmentName,
							});

							//The org admin is an advocate for the General department
							newDepartment.advocates.push(req.user.id);

							//Push the new department to the organization
							org.departments.push(newDepartment);

							//Save the department
							newDepartment.save();

							//Save the organization
							org.save();

							req.flash('success_msg', 'Department was successfully created.');
							res.redirect('/org/' + org.shortPath + '/departments');					
						}
					});
				}
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}	
	});
});

/* GET and POST to donations */
router.get('/:name/donations', ensureAuthenticated, function(req, res, next) {
	Organization.findOne({shortPath: req.params.name}).populate('admin').populate({path: 'departments', populate: {path: 'advocates'}}).exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {
				Contribution.find({organization: org.id}).populate('contributor need').exec(function(err, contributions){
					if (err) throw err;
					res.render('org/orgDonations', {layout: 'layouts/orgLayout',
						title: org.name, 
						org: org, 
						pageHeader: 'Donation Management', 
						isAdmin: true, 
						isSubscriber: true,
						monetaryContributions: _.sortBy(_.filter(contributions, function(o){return (o.need.needType == "monetary" && o.status == "approved")}), "createdAt").reverse(),
						nonMonetaryContributions: _.sortBy(_.filter(contributions, function(o){return (o.need.needType == "non-monetary")}), "createdAt").reverse(),
					});
				});

			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	});
});

router.post('/:name/donations', ensureAuthenticated, function(req, res, next) {
	Organization.findOne({shortPath: req.params.name}).populate('admin').populate({path: 'departments', populate: {path: 'advocates'}}).exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {
				Contribution.findOne({$and: [{organization: org.id}, {_id: req.body.contribution}] }).populate('contributor need').exec(function(err, contribution){
					if (err) throw err;
					if (contribution) {
						if ((["pending", "declined", "approved"].indexOf(req.body.status) != -1) && contribution.need.needType == "non-monetary") {
							
							//Update the need's currentAmount
							if (contribution.status == "approved" && req.body.status != "approved") { //Going from approved to declined or pending -- back out the current amount
								contribution.need.currentAmount -= contribution.contributionAmount;
								contribution.need.save();
							} else if ( (contribution.status == "declined" || contribution.status == "pending") && req.body.status == "approved"){
								contribution.need.currentAmount += contribution.contributionAmount;
								contribution.need.save();
							}

							//Update the status of the contribution
							contribution.status = req.body.status;
							contribution.save();

							req.flash('success_msg', 'The donation status has been updated.');
							res.redirect('/org/' + org.shortPath + '/donations');
						} else {
							req.flash('error', 'There was a problem processing the request.');
							res.redirect('/org/' + org.shortPath + '/donations');
						}
					} else {
						req.flash('error', 'There was a problem processing the request.');
						res.redirect('/org/' + org.shortPath + '/donations');						
					}
				});
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	});
});

/* GET subscribers */
router.get('/:name/subscribers', ensureAuthenticated, function(req, res, next) {
	Organization.findOne({shortPath: req.params.name}).populate('admin subscribers').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {
				if (err) throw err;
				res.render('org/orgSubscribers', {layout: 'layouts/orgLayout',
					title: org.name, 
					org: org, 
					pageHeader: 'Subscribers', 
					isAdmin: true, 
					isSubscriber: true,
				});
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	});
});

/* GET and POST to orgsettings */
router.get('/:name/orgsettings', ensureAuthenticated, function(req, res, next) {
	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {
				if (err) throw err;
				res.render('org/orgSettings', {layout: 'layouts/orgLayout',
					title: org.name, 
					org: org, 
					pageHeader: 'Basic Settings', 
					isAdmin: true, 
					isSubscriber: true,
				});
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	});
});

router.post('/:name/orgsettings', ensureAuthenticated, function(req, res, next) {
	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdmin(org, req.user)) {
				if (err) throw err;


				var orgName = req.body.orgName;
				var email = req.body.email;
				var address = req.body.address;
				var city = req.body.city;
				var state = req.body.state;
				var zip = req.body.zip;
				var payment = req.body.payment;

				//Validation
				req.assert('orgName', 'Organization name is required.').notEmpty();
				req.assert('email', 'Organization email is required.').notEmpty();
				req.assert('email', 'Organization email is not valid.').isEmail();
				req.assert('address', 'Address is required.').notEmpty();
				req.assert('city', 'City is required.').notEmpty();
				req.assert('state', 'State is required.').notEmpty();
				req.assert('zip', 'Zip is not valid.').isLength(5, 5).isInt(); //Between 5 and 5 chars	
				req.assert('payment', 'Payment method is required.').notEmpty();

				req.getValidationResult().then(function(result){
					if (!result.isEmpty()){
						res.render('org/orgSettings', {
							layout: 'layouts/orgLayout',
							title: org.name,
							org: org, 
							pageHeader: 'Basic Settings',
							isAdmin: true, 
							isSubscriber: true,
							errors: result.useFirstErrorOnly().array(),
						});
					} else {						
						org.name = orgName,
						org.email = email,
						org.address = address,
						org.city = city,
						org.state = state,
						org.zip = zip,
						org.paymentOption = payment,
						org.save(); //Update the org
						req.flash('success_msg', 'The organization settings have been updated.');
						res.redirect('/org/' + org.shortPath + '/orgSettings');
					}
				});

			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	});
});

module.exports = router;
