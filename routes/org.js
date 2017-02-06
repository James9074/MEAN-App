var express = require('express');
var router = express.Router();
var Organization = require('../models/organization');
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
				req.assert('thankYouText', 'Thank you text should be 150-350 characters.').isLength(200,400);				

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
							console.log(req.files.logo);
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

module.exports = router;
