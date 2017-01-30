var express = require('express');
var router = express.Router();
var Organization = require('../models/organization')

/* GET home page. */
Organization.find(function(err, orgs){
	orgs.forEach(function(org){
		router.get('/' + org.toObject().url, function(req, res, next) {
			res.render('orgIndex', {layout: 'orgLayout',title: org.toObject().name, org: org.toObject()});
		});	
	});
	
});

module.exports = router;
