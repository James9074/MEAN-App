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
var Handlebars = require('hbs');

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

// connect to our database

/* LOCAL and Heroku Development*/
var db = mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/FaithByDeeds');

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
  res.render('error', {layout: 'layouts/layout'});
});

//Handlebars helpers
Handlebars.registerHelper('formatTime', function (date, format) {
    if (!date) return "";
    var mmnt = moment(date);
    return mmnt.format(format);
});

Handlebars.registerHelper('formatCurrency', function (value) {
    return parseFloat(value).toFixed(2);
});

Handlebars.registerHelper('calcProgress', function (currentAmount, goalAmount) {
    if (goalAmount == 0) return 100;
    return Math.trunc((currentAmount / goalAmount) * 100);
});

Handlebars.registerHelper('calcProgressWidth', function (currentAmount, goalAmount) {
    if (goalAmount == 0) return 100;
    var result = ((currentAmount / goalAmount) * 100);
    if (result > 100) result = 100;
    result = Math.trunc(result);
    return result;
});

Handlebars.registerHelper('isMonetary', function (needType) {
    return (needType == "monetary");
});

Handlebars.registerHelper('selected', function(option, value){
    if (option === value) {
        return ' selected';
    } else {
        return ''
    }
});

Handlebars.registerHelper("isAdvocateOfNeed", function(need, user) {
  if (!need) return false;
  if (!user) return false;
  if  (need.department.advocates.indexOf(user.id) == -1) return false;
  return true;
});

Handlebars.registerHelper("isAdvocateOfDepartment", function(dept, user) {
  if (!dept) return false;
  if (!user) return false;
  if  (dept.advocates.indexOf(user.id) == -1) return false;
  return true;
});

Handlebars.registerHelper("slideGroupBeg", function(index, panels){
    //panels is how many panels we are displaying in each group
    if (index % panels == 0) return true;
    return false;
});

Handlebars.registerHelper("slideGroupEnd", function(index, panels){
    //panels is how many panels we are displaying in each group
    if ((index % panels) == (panels - 1)) return true;
    return false;
});

module.exports = app;
