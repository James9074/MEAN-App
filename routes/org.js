var express = require('express');
var router = express.Router();
var Organization = require('../models/organization')

function ensureAuthenticated(req, res, next){
	if (req.isAuthenticated()){
		return next();
	} else {
		req.flash('error_msg', 'You are not logged in.');
		res.redirect('/login');
	}
}

function ensureAdmin(req, org, callback){
	callback(null, (req.user && (req.user.id === org.admin.id)));
}

var isAdmin = function(org, user) {
	if (user){
		return org.admin.id === user.id;
	} else {
		return false;
	}
}

/* GET home page. */
router.get('/:name', function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			res.render('orgIndex', {layout: 'orgLayout',title: org.name, org: org, isAdmin: isAdmin(org, req.user)});
		} else {
			next();
		}	
	});
});

/* GET theme settings. */
router.get('/:name/theme', ensureAuthenticated, function(req, res, next) {

	Organization.findOne({shortPath: req.params.name}).populate('admin').exec(function(err, org){
		if (err) throw err;
		if (org){
			ensureAdmin(req, org, function(err, isAdmin){
				if (isAdmin) {
					res.render('orgIndex', {layout: 'orgLayout',title: org.name, org: org, isAdmin: true});
				} else {
					res.redirect('/org/' + org.shortPath);
				}
			});
		} else {
			next();
		}	
	});
});

module.exports = router;
