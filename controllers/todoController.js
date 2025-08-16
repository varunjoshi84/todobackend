const Todo = require('../models/todo');

// Get all todos for the current user
exports.getTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user.id })
      .sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create a new todo
exports.createTodo = async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const todo = new Todo({
      title,
      description: description || '',
      user: req.user.id,
      read: false,
      completed: false
    });
    
    await todo.save();
    res.status(201).json(todo);
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update a todo
exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed } = req.body;
    
    const todo = await Todo.findOne({ _id: id, user: req.user.id });
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    // Update fields if provided
    if (title !== undefined) todo.title = title;
    if (description !== undefined) todo.description = description;
    if (completed !== undefined) todo.completed = completed;
    
    await todo.save();
    res.json(todo);
  } catch (error) {
    console.error('Update todo error:', error);
    
    // Handle invalid MongoDB ID format
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid todo ID' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete a todo
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await Todo.findOneAndDelete({ _id: id, user: req.user.id });
    
    if (!result) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Delete todo error:', error);
    
    // Handle invalid MongoDB ID format
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid todo ID' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
};

// Mark a todo as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const todo = await Todo.findOne({ _id: id, user: req.user.id });
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    todo.read = true;
    await todo.save();
    
    res.json(todo);
  } catch (error) {
    console.error('Mark as read error:', error);
    
    // Handle invalid MongoDB ID format
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid todo ID' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
};
