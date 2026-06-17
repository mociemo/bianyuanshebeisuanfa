const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/user.html'));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok', frontend: 'comparison',
        schemeA: 'http://localhost:3001',
        scheme7: 'http://localhost:3000',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`对比前端运行在 http://localhost:${PORT}`);
    console.log(`  - 用户操作: http://localhost:${PORT}/user.html`);
    console.log(`  - 性能对比: http://localhost:${PORT}/comparison.html`);
});
