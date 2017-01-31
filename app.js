var express = require('express');
var path = require('path');
var moment = require('moment');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var bcrypt = require('bcryptjs');
var flash = require('connect-flash');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var session = require('express-session');
var multer = require('multer');

var mongoose = require('mongoose');

// connect to our database
var db = mongoose.connect('mongodb://localhost/FaithByDeeds');
var Organization = require('./models/organization');
var User = require('./models/user');

var index = require('./routes/index');
var users = require('./routes/users');
var orgs = require('./routes/org');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(require('node-sass-middleware')({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  indentedSyntax: true,
  sourceMap: true
}));
app.use(express.static(path.join(__dirname, 'public')));

//Add express-validator functionality to app
app.use(expressValidator());

app.use(session({
  secret: 'secret',
  saveUninitialized: true,
  resave: true
}));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

//connect Flash
app.use(flash());

app.use(function (req, res, next){
  res.locals.success_msg  = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
});

app.use('/', index);
app.use('/users', users);
app.use('/org', orgs);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
