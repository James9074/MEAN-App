var express = require('express');
var router = express.Router();
var Organization = require('../models/organization')

/* GET home page. */
router.get('/:name', function(req, res, next) {
	Organization.getOrganizationByShortPath(req.params.name, function(err, org){
		if (err) throw err;
		
		if (!org) {
			next();
		} else {
			res.render('orgIndex', {layout: 'orgLayout',title: org.name, org: org});
		}

	})
});

module.exports = router;
