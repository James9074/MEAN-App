var express = require('express');
var _ = require('lodash');
var router = express.Router();
var Organization = require('../models/organization');
var Department = require('../models/department');
var Need = require('../models/need');
var User = require('../models/user');
var multer = require('multer');
var path = require('path');
var crypto = require('crypto');

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
			res.render('org/orgIndex', {layout: 'layouts/orgLayout',
				title: org.name, 
				org: org, 
				isAdmin: isAdmin(org, req.user),
				isSubscriber: isSubscriber(org, req.user),
				activeMenuItem: 'homeMenuItem',
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

			//Filter by department
			if(req.query.department){
				needs = _.filter(needs, function(o){ return (o.department.departmentName == req.query.department)});
			}

			//Filter by search term
			if (req.query.search){
				needs = _.filter(needs, function(o){ return (o.title.toLowerCase().indexOf(req.query.search.toLowerCase()) != -1)});
			}

			//Sort
			if (req.query.sortBy){
				needs = _.sortBy(needs, "createdAt");
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
			});
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

router.post('/:name/needs/new', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').populate({path: 'departments', populate: {path: 'advocates'}}).exec(function(err, org){
		if (err) throw err;
		if (org){
			if (isAdvocateforOrgPopped(org, req.user)) {

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
							title: org.name, 
							org: org, 
							pageHeader: 'Add Need', 
							isAdmin: true,
							isSubscriber: true,
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

	Organization.findOne({shortPath: req.params.name}).populate('admin').populate({path: 'departments', populate: {path: 'advocates'}}).exec(function(err, org){
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
							org.logo = logo;
						}
						//Logo
						if (req.files.welcomeImage){
							var welcomeImage = {
						 		fileName: req.files.welcomeImage[0].filename,
								originalName: req.files.welcomeImage[0].originalname						
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
				
				if (req.query.delete){

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

module.exports = router;
