var express = require('express');
var passport = require('passport');
var moment = require('moment');
var multer = require('multer');
var crypto = require('crypto');
var path = require('path');
var LocalStrategy = require('passport-local').Strategy;
var router = express.Router();
var Organization = require('../models/organization');
var Department = require('../models/department.js');
var User = require('../models/user');

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

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('base/index', {layout: 'layouts/layout', title: 'Home | FaithByDeeds'});
});

/* GET logout */
router.get('/logout', function(req, res, next) {
	req.logout();
	req.flash('success_msg', 'You are now logged out.');
	res.redirect('/login');
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
			res.render('base/register', {
				layout: 'layouts/layout',
				title: 'Registration',
				pageHeader: 'Register',
				errors: result.useFirstErrorOnly().array()
			});
		} else {
			var newUser = new User({
				firstName: firstName,
				lastName: lastName,
				email: email,
				password: password
			});

			User.createUser(newUser, function(err, user){
				if ( err && err.code === 11000 ) {
					req.flash('error', 'Email already in use.');
					res.redirect('/register');
				} else if (err){
					req.flash('error', 'Oops. An error occurred.');
					res.redirect('/register');			
				} else {
					req.flash('success_msg', 'You are now registered! You may log in.');
					res.redirect('/login');
				}
			});
		}
	});
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
