const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');
const auth = require('../middleware/auth');

router.get('/', auth, todoController.getTodos);
router.post('/', auth, todoController.createTodo);
router.put('/:id', auth, todoController.updateTodo);
router.delete('/:id', auth, todoController.deleteTodo);
router.patch('/:id/read', auth, todoController.markAsRead);

module.exports = router;
