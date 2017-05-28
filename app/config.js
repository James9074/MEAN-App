var environment = process.env.ENV || 'development';

var emailUser = process.env.EMAIL_USER || "emailUser"
var emailPass = process.env.EMAIL_PASS || "emailPass"
var emailHost = process.env.EMAIL_HOST || "mail"
var emailPort = process.env.EMAIL_PORT || 1025
var emailService = process.env.EMAIL_SERVICE || "gmail"

var sessionKey = process.env.SESSION_KEY
var paypalEmail = process.env.PAYPAL_EMAIL
var siteAdmins = [process.env.SITE_ADMIN ? process.env.SITE_ADMIN.toLowerCase() : 'admin@faithbydeeds.com']

var mongo_server = process.env.MONGODB_HOST || "localhost"
var mongo_port = process.env.MONGODB_PORT || "27017"
var mongo_db = process.env.MONGODB_DB || "FaithByDeeds"
var mongo_url = `mongodb://${mongo_server}:${mongo_port}/${mongo_db}`

var recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY // || '6LcC4B4UAAAAAI91rdS6S-HAep67XE4k1yBhO-qy';

// build our export hash so we can import it into any file that needs custom setup.
module.exports = {
  'environment': environment,
  'mongo_server': mongo_server,
  'mongo_port': mongo_port,
  'mongo_db': mongo_db,
  'mongo_url': mongo_url,
  'emailUser': emailUser,
  'emailPass': emailPass,
  'emailHost': emailHost,
  'emailPort': emailPort,
  'emailService': emailService,
  'sessionKey': sessionKey,
  'siteAdmins': siteAdmins,
  'paypalEmail': paypalEmail,
  'recaptchaSecretKey': recaptchaSecretKey,
  'mailConfig': (process.env.EMAIL_HOST && process.env.EMAIL_PORT) ? {
      host: emailHost,
      port: emailPort,
      auth: {
          user: emailUser,
          pass: emailPass,
      }
    } : {
      service: emailService,
      auth: {
          user: emailUser,
          pass: emailPass,
      }
    }
}
