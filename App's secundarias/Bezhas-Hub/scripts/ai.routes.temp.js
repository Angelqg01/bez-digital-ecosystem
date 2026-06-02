const { Router } = require('express');
const router = Router();

console.log('AI Routes Initialized');

router.get('/agents', (req, res) => {
    res.json([{ id: 'test', name: 'Test Agent' }]);
});

module.exports = router;
