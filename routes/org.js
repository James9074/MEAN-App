var express = require('express');
var router = express.Router();
var Organization = require('../models/organization')
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

/* GET home page. */
router.get('/:name', function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			res.render('org/orgIndex', {layout: 'layouts/orgLayout',title: org.name, org: org, isAdmin: isAdmin(org, req.user)});
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
				res.render('org/orgThemeSettings', {layout: 'layouts/orgLayout',title: org.name, org: org, pageHeader: 'Theme Settings', isAdmin: true});
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

				//Validation

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
			} else {
				res.redirect('/org/' + org.shortPath);
			}
		} else {
			next();
		}
	
	});

	//if (req.file) {
	//	var avatar = {
	//		fileName: req.file.filename,
	//		originalName: req.file.originalname
	//	}
	//	req.user.avatar = avatar;
	//	req.user.save();
	//} else {
		//req.flash('error', 'Image must be a jpeg. ');
	//}
	//res.redirect('/dashboard');
});

module.exports = router;
