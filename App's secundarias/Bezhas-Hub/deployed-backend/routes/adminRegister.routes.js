const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const verifyAdminJWT = require('../middleware/verifyAdminJWT');
const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key';

// Endpoint para login de admin
// POST /api/admin-register/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos.' });
    }
    try {
        const user = await User.findOne({ email, role: 'admin' });
        if (!user) {
            return res.status(401).json({ error: 'Usuario admin no encontrado.' });
        }
        const isMatch = await require('bcryptjs').compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña incorrecta.' });
        }
        // Generar token JWT
        const token = jwt.sign({ email: user.email, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ message: 'Login admin exitoso.', token, user: { email: user.email, role: user.role, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: 'Error al autenticar admin.' });
    }
});

// Endpoint para registrar un usuario admin (solo para desarrollo/pruebas)
// POST /api/admin-register
router.post('/admin-register', async (req, res) => {
    const { email, password } = req.body;
    // Solo permitir el registro si no existe ningún admin
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
        return res.status(403).json({ error: 'Ya existe un usuario admin.' });
    }
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            email,
            password: hashedPassword,
            role: 'admin',
            username: 'Admin',
            createdAt: new Date()
        });
        await user.save();
        res.status(201).json({ message: 'Usuario admin creado correctamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear usuario admin.' });
    }
});

// Ejemplo de ruta protegida solo para admin
router.get('/panel', verifyAdminJWT, (req, res) => {
    res.json({ message: 'Acceso permitido al panel admin', admin: req.admin });
});

// Ruta de acceso directo oculta para el panel admin
router.get('/superpanel', verifyAdminJWT, (req, res) => {
    res.json({ message: 'Acceso permitido al Super Panel', admin: req.admin });
});

module.exports = router;
