var express = require('express');
var _ = require('lodash');
var bcrypt = require('bcryptjs');
var passport = require('passport');
var moment = require('moment');
var multer = require('multer');
var crypto = require('crypto');
var path = require('path');
var async = require('async');
var LocalStrategy = require('passport-local').Strategy;
var router = express.Router();
var request = require('request');
var bodyParser = require('body-parser');
var Organization = require('../models/organization');
var Department = require('../models/department');
var User = require('../models/user');
var Contribution = require('../models/contribution');
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

function ensureSiteAdmin(req, res, next){
	if (Config.siteAdmins.indexOf(req.user.email) != -1) {
		return next();
	} else {
		req.flash('error_msg', 'You do not have access to that page.');
		res.redirect('/dashboard');
	}
}

function isSiteAdmin(user) {
	return (Config.siteAdmins.indexOf(user.email) != -1);
}

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('base/index', {layout: 'layouts/layout', title: 'Home | FaithByDeeds'});
});

/* GET about page */
router.get('/about', function(req, res, next) {
	res.render('base/about', {layout: 'layouts/layout', title: 'About | FaithByDeeds'});
});

/* GET FAQ page */
router.get('/faq', function(req, res, next) {
	res.render('base/faq', {layout: 'layouts/layout', title: 'FAQ | FaithByDeeds'});
});

/* GET terms */
router.get('/terms', function(req, res, next) {
	res.render('base/terms', {layout: 'layouts/layout', title: 'Terms of Service | FaithByDeeds'});
});

/* GET logout */
router.get('/logout', function(req, res, next) {
	req.logout();
	req.flash('success_msg', 'You are now logged out.');
	res.redirect('/login');
});

/* GET donation rept */
router.get('/donation-rept', ensureAuthenticated, ensureSiteAdmin, function(req, res, next) {
	
	var beginning = new Date(req.query.beg);
	var ending = new Date(req.query.end);
	if (!req.query.beg) beginning = new Date(0);
	if (!req.query.end) ending = new Date("December 30, 2999");

	ending.setDate(ending.getDate() + 1);

	Contribution.find({"createdAt": {"$gte": beginning, "$lt": ending}}).populate('need contributor').populate({path: 'need', populate: {path: 'organization'}}).exec(function(err, contributions){
		res.render('base/donationRept', {layout: 'layouts/layout', 
			title: 'Donation Report | FaithByDeeds', pageHeader: 'Donation Report', 
			activeMenuItem: 'adminMenuItem',
			isSiteAdmin: isSiteAdmin(req.user),
			nonMonetaryContributions: _.sortBy(_.filter(contributions, function(o){return (o.need.needType == "non-monetary")}), "createdAt").reverse(),			
			monetaryContributions: _.sortBy(_.filter(contributions, function(o){return (o.need.needType == "monetary" && o.status == "approved")}), "createdAt").reverse(),
			beginning: req.query.beg,
			ending: req.query.end, 
		});
	})
});


/* GET and POST to dashboard */
router.get('/dashboard', ensureAuthenticated, function(req, res, next) {

	User.findOne({_id: req.user.id}).populate('organizations').populate('subscriptions', null, { admin: { $nin: [req.user.id] } }).exec(function(err, user){
		if (err) throw err;
		if(user) {
			res.render('base/dashboard', {layout: 'layouts/layout', 
				title: 'Dashboard | FaithByDeeds', pageHeader: 'Dashboard', 
				joinedDate: moment(user.createdAt).format('MMM DD, YYYY'), 
				orgs: user.organizations,
				subbedOrgs: user.subscriptions,
				activeMenuItem: 'dashboardMenuItem',
				isSiteAdmin: isSiteAdmin(req.user),
			});
		} else {
			next();
		}
	});

});

router.post('/dashboard', ensureAuthenticated, uploading.single('avatar'), function(req, res) {
	if (req.file) {
		var avatar = {
			fileName: req.file.filename,
			originalName: req.file.originalname
		}

		//Remove old avatar from disk if there is one
		if (req.user.avatar){
			var fs = require('fs');
			var filePath = './public/uploads/' + req.user.avatar.fileName; 
			fs.unlinkSync(filePath);
		}

		req.user.avatar = avatar;
		req.user.save();
	} else {
		req.flash('error', 'Image must be a jpeg. ');
	}
	res.redirect('/dashboard');
});

/* GET and POST to register */
router.get('/register', function(req, res, next) {
	res.render('base/register', {
		layout: 'layouts/layout', 
		title: 'Registration | FaithByDeeds', 
		pageHeader: 'Register',
		activeMenuItem: 'registerMenuItem',
	});
});

router.post('/register', function(req, res, next){
 
	// if its blank or null means user has not selected the captcha, so return the error.
	if(req.body['g-recaptcha-response'] === undefined || req.body['g-recaptcha-response'] === '' || req.body['g-recaptcha-response'] === null) {
		req.flash('error', 'You must select the captcha to verify that you are not a robot.');
		res.redirect('/register');
	} else {
		var secretKey = "6LcC4B4UAAAAAI91rdS6S-HAep67XE4k1yBhO-qy";

		// req.connection.remoteAddress will provide IP address of connected user.
		var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;
		// Hitting GET request to the URL, Google will respond with success or error scenario.
		request(verificationUrl,function(error,response,body) {
			body = JSON.parse(body);
			// Success will be true or false depending upon captcha validation.
			if(body.success !== undefined && !body.success) {
				req.flash('error', 'The captcha verification failed.');
				return res.redirect('/register');
			} else{
				//Success
				var firstName = req.body.firstName;
				var lastName = req.body.lastName;
				var email = req.body.email;
				var password = req.body.password;
				var confirmPassword = req.body.confirmPassword;

				//Validation
				req.assert('firstName', 'First name is required.').notEmpty();
				req.assert('lastName', 'Last name is required.').notEmpty();
				req.assert('email', 'Email is required.').notEmpty();
				req.assert('email', 'Email is not valid.').isEmail();
				req.assert('password', 'Password is required.').notEmpty();
				req.assert('password', 'Password must be between 5 to 20 characters.').isLength(5, 20);	
				req.assert('confirmPassword', 'Passwords do not match.').equals(req.body.password);	

				req.getValidationResult().then(function(result){

					if (!result.isEmpty()){
						return res.render('base/register', {
							layout: 'layouts/layout',
							title: 'Registration',
							pageHeader: 'Register',
							errors: result.useFirstErrorOnly().array(),
						});
					} else {
						var newUser = new User({
							firstName: firstName,
							lastName: lastName,
							email: email,
							password: password
						});

						User.findOne({email: email.toLowerCase()}).exec(function(err, user) {
							if (!user) {
								User.createUser(newUser, function(err, user){
									if ( err ) throw err;
									var msg = "Hello,\n\nYou've successfully created a FaithByDeeds account! To login and access your dashboard, go to the following URL:\n\n" + req.protocol + '://' + req.get('host') + "/login";
									var subject = "FaithByDeeds - Thanks for signing up!";
									sendEmail(subject, msg, email);

									req.flash('success_msg', 'You are now registered! You may log in.');
									return res.redirect('/login');
								});				
							} else {
								req.flash('error', 'Email already in use.');
								return res.redirect('/register');
							}
						});

					}
				});
			}
		});
	}
});

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  },
  function(username, password, done) {
  	User.getUserByEmail(username.toLowerCase(), function(err, user){
  		if(err) throw err;
  		if (!user){
  			return done(null, false, {message: 'Unknown Email.'});
  		}

  		User.comparePassword(password, user.password, function(err, isMatch){
  			if(err) throw err;
  			if(isMatch){
  				return done(null, user);
  			} else {
  				return done(null, false, {message: 'Invalid password.'});
  			}
  		});
  	});
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.getUserById(id, function(err, user) {
    done(err, user);
  });
});

/* GET and POST to login */
router.get('/login', function(req, res, next) {
	res.render('base/login', {layout: 'layouts/layout', title: 'Login | FaithByDeeds', pageHeader: 'Login', activeMenuItem: 'loginMenuItem'});
});


router.post('/login',
  passport.authenticate('local', {successRedirect:'/dashboard',failureRedirect:'/login', failureFlash:true}),
  function(req, res) {
  	res.redirect('/dashboard');
  });

/* GET and POST to forgot */
router.get('/forgot', function(req, res, next) {
	res.render('base/forgot', {layout: 'layouts/layout', title: 'Forgot Password | FaithByDeeds', pageHeader: 'Forgot Password'});
});

router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email.toLowerCase() }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
			if (err) throw err;
			done(err, token, user);
        });
      });
    },
    function(token, user, done) {

		var msg = "Hello,\n\nYou've requested the reset of the password for your account.\n\nPlease click on the following link to change your password.\n\nIf you did not intend to reset your password, ignore this email."
		+ "\n\n" + req.protocol + '://' + req.get('host') + '/reset/' + token;
		var subject = "FaithByDeeds - Password reset";
		sendEmail(subject, msg, user.email);

		req.flash('success_msg', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
		done(null, 'done');
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

/* GET and POST to reset */
router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
	res.render('base/resetPassword', {layout: 'layouts/layout', title: 'Reset Password | FaithByDeeds', pageHeader: 'Reset Password'});
  });
});

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }

		var password = req.body.password;
		var confirmPassword = req.body.confirmPassword;

		req.assert('password', 'Password is required.').notEmpty();
		req.assert('password', 'Password must be between 5 to 20 characters.').isLength(5, 20);	
		req.assert('confirmPassword', 'Passwords do not match.').equals(req.body.password);	

		req.getValidationResult().then(function(result){

			if (!result.isEmpty()){
				return res.render('base/resetPassword', {
					layout: 'layouts/layout',
					title: 'Reset Password | FaithByDeeds',
					pageHeader: 'Reset Password',
					errors: result.useFirstErrorOnly().array()
				});
			} else {
				//Update password
				user.resetPasswordToken = undefined;
        		user.resetPasswordExpires = undefined;
        		user.password = req.body.password;

				User.createUser(user, function(err, user){
					if (err) throw err;
					var msg = "Hello,\n\nThe password associated with your FaithByDeeds account has been reset. ";
					var subject = "FaithByDeeds - Password changed";
					sendEmail(subject, msg, user.email);

					req.flash('success_msg', 'The password has been reset! You may log in.');
					return res.redirect('/login');
				});

			}
		});

      });
    },
  ], function(err) {
    res.redirect('/');
  });
});

/* GET and POST to org-create */
router.get('/org-create', ensureAuthenticated, function(req, res, next){
	res.render('base/org-create', {layout: 'layouts/layout', title: 'Create Organization | FaithByDeeds', pageHeader: 'Create Organization', });
});

router.post('/org-create', ensureAuthenticated, function(req, res, next){
	var orgName = req.body.orgName;
	var email = req.body.email;
	var address = req.body.address;
	var city = req.body.city;
	var state = req.body.state;
	var zip = req.body.zip;
	var short = req.body.short;
	var payment = req.body.payment;

	//Validation
	req.assert('orgName', 'Organization name is required.').notEmpty();
	req.assert('email', 'Organization email is required.').notEmpty();
	req.assert('email', 'Organization email is not valid.').isEmail();
	req.assert('address', 'Address is required.').notEmpty();
	req.assert('city', 'City is required.').notEmpty();
	req.assert('state', 'State is required.').notEmpty();
	req.assert('zip', 'Zip is not valid.').isLength(5, 5).isInt(); //Between 5 and 5 chars	
	req.assert('short', 'Short path is required.').notEmpty();
	req.assert('short', 'Short path can not contain special characters or spaces.').matches(/^[a-zA-Z0-9]*$/g);
	req.assert('short', 'Short path must be between 5 to 20 characters.').isLength(5, 20);
	req.assert('payment', 'Payment method is required.').notEmpty();

	req.getValidationResult().then(function(result){
		if (!result.isEmpty()){
			res.render('base/org-create', {
				layout: 'layouts/layout',
				title: 'Create Organization | FaithByDeeds',
				pageHeader: 'Create Organization',
				errors: result.useFirstErrorOnly().array()
			});
		} else {
			var newOrganization = new Organization({
				admin: req.user.id,
				name: orgName,
				email: email,
				address: address,
				city: city,
				state: state,
				zip: zip,
				shortPath: short,
				paymentOption: payment,
			});

			//Create the General department
			var newDepartment = new Department({
				organization: newOrganization.id,
				departmentName: 'General',
			});

			//The org admin is an advocate for the General department
			newDepartment.advocates.push(req.user.id);

			//Push the new department to the new organization
			newOrganization.departments.push(newDepartment);

			//The org admin is a subscriber to the organization
			newOrganization.subscribers.push(req.user.id);

			//Save the department
			newDepartment.save();

			Organization.createOrganization(newOrganization, function(err, org){
				if ( err && err.code === 11000 ) {
					req.flash('error', 'Short path already in use.');
					res.redirect('/org-create');
				} else if (err){
					req.flash('error', 'Oops. An error occurred.');
					res.redirect('/org-create');			
				} else {

					/* Send email */
					var msg = "Hello,\n\nYou've set up a new organization on FaithByDeeds! You can access the organization from the user dashboard, or from the URL below:\n\n" + req.protocol + '://' + req.get('host') + '/org/' + short;
					var subject = "FaithByDeeds - You've created a new organization!";
					sendEmail(subject, msg, req.user.email);

					req.user.organizations.push(org.id);
					req.user.subscriptions.push(org.id);
					req.user.save();
					req.flash('success_msg', 'Your organization has been created!');
					res.redirect('/org/' + org.shortPath + '/theme');
				}
			});

		}
	});


});
module.exports = router;
