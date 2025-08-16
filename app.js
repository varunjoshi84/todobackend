const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const Todo = require('./models/todo');
const todoRoutes = require('./routes/todoRoutes');
const authRoutes = require('./routes/authRoutes');
require('dotenv').config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/todo-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));
app.use(flash());

// Custom middleware to check for JWT in cookies
app.use(async (req, res, next) => {
  const token = req.cookies.token;
  
  if (token) {
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
      // Find user
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Token is invalid, clear it
      res.clearCookie('token');
    }
  }
  
  next();
});

// Make user and flash messages available to all templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success')
  };
  next();
});

// API Routes
app.use('/api/todos', todoRoutes);
app.use('/api/auth', authRoutes);

// Web Routes for EJS frontend
app.get('/', async (req, res) => {
  try {
    // If user is logged in, show todos
    if (req.user) {
      const todos = await Todo.find({ user: req.user._id }).sort({ createdAt: -1 });
      return res.render('index', { todos });
    }
    
    // Otherwise redirect to login page
    res.redirect('/login');
  } catch (error) {
    console.error('Error rendering index page:', error);
    req.flash('error', 'An unexpected error occurred');
    res.status(500).render('500', { error: error.message });
  }
});

// Login page route
app.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('login');
});

// Register page route
app.get('/register', (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('register');
});

// Login handler
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    
    // Create token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    req.flash('success', 'Logged in successfully');
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An unexpected error occurred');
    res.redirect('/login');
  }
});

// Register handler
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      req.flash('error', 'Username already exists');
      return res.redirect('/register');
    }
    
    // Create user
    const user = new User({ username, password });
    await user.save();
    
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'An unexpected error occurred');
    res.redirect('/register');
  }
});

// Logout handler
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  req.flash('success', 'Logged out successfully');
  res.redirect('/login');
});

// Todo handlers
app.post('/todos', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const todo = new Todo({
      title,
      description: description || '',
      user: req.user._id,
      read: false,
      completed: false
    });
    
    await todo.save();
    // Return the created todo as JSON instead of redirecting
    res.status(201).json(todo);
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/todos/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id } = req.params;
    const { title, description, completed } = req.body;
    
    const todo = await Todo.findOne({ _id: id, user: req.user._id });
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    if (title !== undefined) todo.title = title;
    if (description !== undefined) todo.description = description;
    if (completed !== undefined) todo.completed = completed;
    
    await todo.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/todos/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id } = req.params;
    
    const result = await Todo.findOneAndDelete({ _id: id, user: req.user._id });
    
    if (!result) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/todos/:id/read', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id } = req.params;
    
    const todo = await Todo.findOne({ _id: id, user: req.user._id });
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    todo.read = true;
    await todo.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', {
    error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
