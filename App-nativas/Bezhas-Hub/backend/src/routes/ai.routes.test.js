const { Router } = require('express');
const router = Router();

router.get('/test', (req, res) => res.send('AI Route Test'));

module.exports = router;
