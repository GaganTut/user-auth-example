const path = require('path');
const express = require('express');
const bodyparser = require('body-parser');

/*
  Notes:
  - Make sure you have your DB file setup correctly and pointing to the right database.
  - Make sure you have pg installed as a module dependency
  - Use postman to create a new user
*/

// passport
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// session
const session = require('express-session')
const RedisStore = require('connect-redis')(session);

// password hashing
const saltRounds = 10;
const bcrypt = require('bcrypt');

// sequelize
const db = require('./models');
const { User } = require('./models');

// create express app
const app = express();

// instantiate body parser
app.use(bodyparser.urlencoded({extended: false}));

// setup sessions
app.use(session({
  store: new RedisStore(),
  secret: 'something_super-weird',
  resave: false,
  saveUninitialized: true
}));

// setup passport
app.use(passport.initialize());
app.use(passport.session());

// passport local Strategy
passport.use(new LocalStrategy (
  function(username, password, done) {
    console.log('runs before serializing');
    User.findOne({
      where: {
        username: username
      }
    })
    .then ( user => {
      if (user === null) {
        console.log('user failed');
        return done(null, false, {message: 'bad username'});
      }
      else {
        bcrypt.compare(password, user.password)
        .then(res => {
          if (res) { return done(null, user); }
          else {
            return done(null, false, {message: 'bad password'});
          }
        });
      }
    })
    .catch(err => {
      console.log('error: ', err);
    });
  }
));

passport.serializeUser(function(user, done) {
  console.log('serializing');
// ^ ---------- given from authentication strategy
  // building the object to serialize to save
  return done(null, {
    id: user.id,
    username: user.username
  });
});

passport.deserializeUser(function(user, done) {
  console.log('deserializing');
  // ^ ---------- given from serializeUser
  User.findOne({
    where: {
      id: user.id
    }
  }).then(user => {
    return done(null, user); // <------- inserts into the request object
  });
});


// ROUTING

// public
app.get('/', (req, res) => {
  res.send('hello');
});


// login section
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname + '/views/login.html'));
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/secret',
  failureRedirect: '/login'
}));



/// new user section
app.post('/user/new', (req, res) => {
  bcrypt.genSalt(saltRounds, function(err, salt) {
    bcrypt.hash(req.body.password, salt, function(err, hash) {
      User.create({
        username: req.body.username,
        password: hash
      })
      .then( (user) => {
        console.log(user);
        res.redirect('/login');
      });
    });
  });
});


// secure routes
function isAuthenticated (req, res, next) {
  console.log('checking');
  if(req.isAuthenticated()) {
    console.log('you good');
    next();
  }else {
    console.log('you bad!!!!');
    res.redirect('/login');
  }
}

app.get('/secret', isAuthenticated, (req, res) => {
  console.log('req.user: ', req.user);
  console.log('req.user id', req.user.id);
  console.log('req.username', req.user.username);
  console.log('req.user.password: ', req.user.password);

  console.log('pinging the secret');
  res.send('you found the secret!');
});





app.listen(9000, () => {
  console.log('starting server');
  db.sequelize.sync();
});
