var express = require('express');
var passport = require('passport');
var moment = require('moment');
var LocalStrategy = require('passport-local').Strategy;
var router = express.Router();
var Organization = require('../models/organization')
var User = require('../models/user');

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
	res.render('index', {layout: 'layout', title: 'Home | FaithByDeeds'});
});

router.get('/register', function(req, res, next) {
	res.render('register', {
		layout: 'layout', 
		title: 'Registration | FaithByDeeds', 
		pageHeader: 'Register'
	});
});

router.get('/login', function(req, res, next) {
	res.render('login', {layout: 'layout', title: 'Login | FaithByDeeds', pageHeader: 'Login'});
});

router.get('/logout', function(req, res, next) {
	req.logout();
	req.flash('success_msg', 'You are now logged out.');
	res.redirect('/login');
});

router.get('/dashboard', ensureAuthenticated, function(req, res, next) {
	res.render('dashboard', {layout: 'layout', title: 'Dashboard | FaithByDeeds', pageHeader: 'Dashboard', joinedDate: moment(res.locals.user.createdAt).format('MMM DD, YYYY')});
});

/* POST to /register */
router.post('/register', function(req, res, next){
	var firstName = req.body.firstName;
	var lastName = req.body.lastName;
	var email = req.body.email;
	var password = req.body.password;
	var confirmPassword = req.body.confirmPassword;

	//Validation
	req.checkBody('firstName', 'First name is required.').notEmpty();
	req.checkBody('lastName', 'Last name is required.').notEmpty();
	req.checkBody('email', 'Email is required.').notEmpty();
	req.checkBody('email', 'Email is not valid.').isEmail();
	req.checkBody('password', 'Password is required.').notEmpty();
	req.checkBody('confirmPassword', 'Passwords do not match.').equals(req.body.password);	

	var errors = req.validationErrors();

	if (errors){
		console.log(errors);
		res.render('register', {
			layout: 'layout',
			title: 'Registration',
			pageHeader: 'Register',
			errors: errors
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

router.post('/login',
  passport.authenticate('local', {successRedirect:'/dashboard',failureRedirect:'/login', failureFlash:true}),
  function(req, res) {
  	res.redirect('/dashboard');
  });

module.exports = router;
