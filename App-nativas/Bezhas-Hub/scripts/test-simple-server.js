const express = require('express');
const app = express();
const PORT = 3003;

app.get('/', (req, res) => res.send('Hello'));

app.listen(PORT, () => {
    console.log(`Simple Server running on port ${PORT}`);
});
