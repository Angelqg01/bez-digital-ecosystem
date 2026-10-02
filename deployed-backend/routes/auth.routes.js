const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const crypto = require('crypto');
const User = require('../models/user.model');
// Use mock model for AffiliateEvent to avoid Mongoose dependency issues
const { AffiliateEvent } = require('../models/mockModels');
const { grantReferralReward } = require('../services/rewards.service');
const { ensureSuperAdminRole } = require('../middleware/auth.middleware');

// In-memory storage for verification codes (en producción usa Redis)
const verificationCodes = new Map();

// In-memory storage for nonces (en producción usa Redis con TTL)
const nonces = new Map();

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'default-secret-key', {
    expiresIn: '30d', // Token expires in 30 days
  });
};

// Helper to generate random 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to send email (placeholder - implementar con SendGrid, AWS SES, etc.)
const sendVerificationEmail = async (email, code) => {
  // TODO: Implementar envío real de email
  console.log(`📧 Sending verification code ${code} to ${email}`);
  // En desarrollo, solo logueamos el código
  return true;
};

/**
 * @route   GET /api/auth/nonce
 * @desc    Generate a nonce for wallet signature verification (prevents replay attacks)
 * @access  Public
 * @query   address - Ethereum wallet address (optional, for logging purposes)
 */
router.get('/nonce', async (req, res) => {
  try {
    const { address } = req.query;

    // Generate a cryptographically secure random nonce
    const nonce = crypto.randomBytes(32).toString('hex');

    // Store nonce with 5-minute expiration (in production use Redis with TTL)
    const timestamp = Date.now();
    nonces.set(nonce, { timestamp, address: address || 'anonymous' });

    // Clean up old nonces (older than 5 minutes)
    const fiveMinutesAgo = timestamp - (5 * 60 * 1000);
    for (const [key, value] of nonces.entries()) {
      if (value.timestamp < fiveMinutesAgo) {
        nonces.delete(key);
      }
    }

    console.log(`🔐 Nonce generated for address: ${address || 'anonymous'}`);

    res.status(200).json({
      success: true,
      nonce,
      message: 'Sign this nonce with your wallet to authenticate',
      expiresIn: 300 // seconds
    });
  } catch (error) {
    console.error('Error generating nonce:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate nonce'
    });
  }
});

const loginOrRegisterRules = () => {
  return [
    body('walletAddress', 'A valid wallet address is required').isEthereumAddress(),
    body('referralCode').optional().isString().trim().escape(),
  ];
};

/**
 * @route   POST /api/auth/login-or-register
 * @desc    Logs in a user by their wallet address or creates a new account if it doesn't exist.
 *          If a referral code is provided on first registration, attributes the referral.
 * @access  Public
 */
router.post('/login-or-register', loginOrRegisterRules(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { walletAddress, referralCode } = req.body;

  try {
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const newUserPayload = { walletAddress: walletAddress.toLowerCase() };

      // If a referral code is provided for a new user, process it
      let referrer = null;
      if (referralCode) {
        referrer = await User.findOne({ 'affiliate.referralCode': referralCode });

        if (referrer) {
          newUserPayload.affiliate = {
            referredBy: referrer._id,
            registeredWithCode: referralCode
          };
          req.log.info(`Referral signup for referrer ${referrer._id} from new user ${walletAddress}`);
        } else {
          req.log.warn(`Invalid referral code '${referralCode}' used during registration.`);
        }
      }

      user = new User(newUserPayload);
      await user.save();

      // If referral was successful, create event and trigger reward
      if (isNewUser && referrer) {
        const affiliateEvent = new AffiliateEvent({
          referrerId: referrer._id,
          referredId: user._id,
          eventType: 'signup',
          referralCodeUsed: referralCode,
          ipAddress: req.ip,
          rewardStatus: 'pending'
        });

        try {
          const rewardResponse = await grantReferralReward(referrer._id, user._id, 'USER_SIGNUP');
          affiliateEvent.rewardStatus = 'processed';
          // Assuming rewardResponse contains { transactionId, amount }
          affiliateEvent.rewardDetails = {
            transactionId: rewardResponse.transactionId,
            amount: rewardResponse.amount
          };
          req.log.info(`Reward processed for referrer ${referrer._id}. TxID: ${rewardResponse.transactionId}`);
        } catch (rewardError) {
          req.log.error({ err: rewardError }, `Failed to process reward for referrer ${referrer._id}`);
          affiliateEvent.rewardStatus = 'failed';
        }
        await affiliateEvent.save();
      }

    }

    // Generate JWT
    const token = generateToken(user._id);

    res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? 'User created successfully' : 'User logged in successfully',
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        roles: user.roles,
        hasSyncedContacts: user.contactSync.hasSynced,
        referralCode: user.affiliate.referralCode
      },
      token
    });

  } catch (error) {
    req.log.error({ err: error }, 'Error in login-or-register endpoint');
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/login-wallet
 * @desc    Login with wallet signature verification
 * @access  Public
 */
router.post('/login-wallet', [
  body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
  body('signature').isString().notEmpty().withMessage('Signature is required'),
  body('message').isString().notEmpty().withMessage('Message is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { walletAddress, signature, message } = req.body;

  try {
    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Find user by wallet address
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // Generate JWT
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username || `User_${walletAddress.slice(0, 6)}`,
        email: user.email,
        walletAddress: user.walletAddress,
        roles: user.roles,
        referralCode: user.affiliate?.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error in login-wallet:', error);
    res.status(500).json({ error: 'Server error during wallet login' });
  }
});

/**
 * @route   POST /api/auth/register-email
 * @desc    Register with email and password
 * @access  Public
 */
router.post('/register-email', [
  body('email').isEmail().withMessage('Email válido requerido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
  body('username').optional().isString().trim(),
  body('referralCode').optional().isString().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, username, referralCode } = req.body;

  try {
    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    // Hash de la contraseña
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear usuario
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      username: username || `User_${Date.now()}`,
      authMethod: 'email',
      roles: ['USER'],
      'affiliate.referralCode': crypto.randomBytes(4).toString('hex').toUpperCase()
    });

    await user.save();

    // Procesar referido si existe
    if (referralCode) {
      const referrer = await User.findOne({ 'affiliate.referralCode': referralCode });
      if (referrer) {
        await grantReferralReward(referrer._id, user._id);
      }
    }

    // Generar token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        roles: user.roles,
        referralCode: user.affiliate.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error en registro por email:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * @route   POST /api/auth/login-email
 * @desc    Login with email and password
 * @access  Public
 */
router.post('/login-email', [
  body('email').isEmail().withMessage('Email válido requerido'),
  body('password').isString().notEmpty().withMessage('Contraseña requerida')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = generateToken(user._id);

    res.json({
      message: 'Login exitoso',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        roles: user.roles,
        referralCode: user.affiliate?.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error en login por email:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * @route   POST /api/auth/google
 * @desc    Login/Register with Google OAuth
 * @access  Public
 */
router.post('/google', [
  body('idToken').isString().notEmpty().withMessage('Google ID Token requerido')
], async (req, res) => {
  const { idToken, referralCode } = req.body;

  try {
    let payload;

    // Verificar si hay configuración real de Google
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const isconfigured = googleClientId && !googleClientId.includes('YOUR_GOOGLE_CLIENT_ID');

    if (isconfigured) {
      const { OAuth2Client } = require('google-auth-library');
      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: googleClientId
      });
      payload = ticket.getPayload();
    } else {
      // Fallback: Mock para desarrollo si no hay keys
      console.warn('⚠️ Google Auth: Ejecutando en modo SIMULACIÓN (Faltan keys en .env)');
      payload = {
        email: `google_user_${Date.now()}@gmail.com`,
        name: 'Google User (Simulado)',
        picture: 'https://via.placeholder.com/150',
        sub: `google_${Date.now()}`
      };
    }

    // Buscar o crear usuario
    let user = await User.findOne({ googleId: payload.sub });
    let isNewUser = false;

    if (!user) {
      user = await User.findOne({ email: payload.email });
      if (user) {
        user.googleId = payload.sub;
        user.authMethod = 'google';
        await user.save();
      } else {
        isNewUser = true;
        user = new User({
          email: payload.email,
          username: payload.name,
          googleId: payload.sub,
          authMethod: 'google',
          profileImage: payload.picture,
          roles: ['USER'],
          'affiliate.referralCode': crypto.randomBytes(4).toString('hex').toUpperCase()
        });
        await user.save();

        // Procesar referido
        if (referralCode) {
          const referrer = await User.findOne({ 'affiliate.referralCode': referralCode });
          if (referrer) {
            await grantReferralReward(referrer._id, user._id);
          }
        }
      }
    }

    const token = generateToken(user._id);

    res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? 'Usuario creado con Google' : 'Login con Google exitoso',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profileImage: user.profileImage,
        roles: user.roles,
        referralCode: user.affiliate.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error en Google Auth:', error);
    res.status(500).json({ error: 'Error en autenticación con Google' });
  }
});

/**
 * @route   POST /api/auth/facebook
 * @desc    Login/Register with Facebook OAuth
 * @access  Public
 */
router.post('/facebook', [
  body('accessToken').isString().notEmpty().withMessage('Facebook Access Token requerido')
], async (req, res) => {
  const { accessToken, referralCode } = req.body;

  try {
    // En producción: verificar token con Facebook Graph API
    // const response = await axios.get(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`);
    // const userData = response.data;

    // Mock para desarrollo
    const userData = {
      id: `fb_${Date.now()}`,
      name: 'Facebook User',
      email: `fb_user_${Date.now()}@facebook.com`,
      picture: { data: { url: 'https://via.placeholder.com/150' } }
    };

    let user = await User.findOne({ facebookId: userData.id });
    let isNewUser = false;

    if (!user) {
      user = await User.findOne({ email: userData.email });
      if (user) {
        user.facebookId = userData.id;
        user.authMethod = 'facebook';
        await user.save();
      } else {
        isNewUser = true;
        user = new User({
          email: userData.email,
          username: userData.name,
          facebookId: userData.id,
          authMethod: 'facebook',
          profileImage: userData.picture?.data?.url,
          roles: ['USER'],
          'affiliate.referralCode': crypto.randomBytes(4).toString('hex').toUpperCase()
        });
        await user.save();

        if (referralCode) {
          const referrer = await User.findOne({ 'affiliate.referralCode': referralCode });
          if (referrer) {
            await grantReferralReward(referrer._id, user._id);
          }
        }
      }
    }

    const token = generateToken(user._id);

    res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? 'Usuario creado con Facebook' : 'Login con Facebook exitoso',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profileImage: user.profileImage,
        roles: user.roles,
        referralCode: user.affiliate.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error en Facebook Auth:', error);
    res.status(500).json({ error: 'Error en autenticación con Facebook' });
  }
});

/**
 * @route   POST /api/auth/x-twitter
 * @desc    Login/Register with X (Twitter) OAuth
 * @access  Public
 */
router.post('/x-twitter', [
  body('accessToken').isString().notEmpty().withMessage('X Access Token requerido'),
  body('accessTokenSecret').isString().notEmpty().withMessage('X Access Token Secret requerido')
], async (req, res) => {
  const { accessToken, accessTokenSecret, referralCode } = req.body;

  try {
    // En producción: verificar tokens con X (Twitter) API v2
    // const axios = require('axios');
    // const response = await axios.get('https://api.twitter.com/2/users/me', {
    //   headers: { 'Authorization': `Bearer ${accessToken}` },
    //   params: { 'user.fields': 'id,name,username,profile_image_url' }
    // });
    // const userData = response.data.data;

    // Mock para desarrollo
    const userData = {
      id: `x_${Date.now()}`,
      name: 'X User',
      username: `xuser${Date.now()}`,
      email: `x_user_${Date.now()}@x.com`, // X no siempre da email
      profile_image_url: 'https://via.placeholder.com/150'
    };

    // Buscar o crear usuario
    let user = await User.findOne({ twitterId: userData.id });
    let isNewUser = false;

    if (!user) {
      user = await User.findOne({ email: userData.email });
      if (user) {
        user.twitterId = userData.id;
        user.authMethod = 'x-twitter';
        await user.save();
      } else {
        isNewUser = true;
        user = new User({
          email: userData.email,
          username: userData.username || userData.name,
          twitterId: userData.id,
          authMethod: 'x-twitter',
          profileImage: userData.profile_image_url,
          roles: ['USER'],
          'affiliate.referralCode': crypto.randomBytes(4).toString('hex').toUpperCase()
        });
        await user.save();

        // Procesar referido
        if (referralCode) {
          const referrer = await User.findOne({ 'affiliate.referralCode': referralCode });
          if (referrer) {
            await grantReferralReward(referrer._id, user._id);
          }
        }
      }
    }

    const token = generateToken(user._id);

    res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? 'Usuario creado con X (Twitter)' : 'Login con X (Twitter) exitoso',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profileImage: user.profileImage,
        roles: user.roles,
        referralCode: user.affiliate.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error en X (Twitter) Auth:', error);
    res.status(500).json({ error: 'Error en autenticación con X (Twitter)' });
  }
});

/**
 * @route   POST /api/auth/github
 * @desc    Login/Register with GitHub OAuth
 * @access  Public
 */
router.post('/github', [
  body('code').isString().notEmpty().withMessage('GitHub authorization code requerido')
], async (req, res) => {
  const { code, referralCode } = req.body;

  try {
    let userData;
    // Verificar si hay configuración real de GitHub
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    const isConfigured = githubClientId && !githubClientId.includes('YOUR_GITHUB_CLIENT_ID') && process.env.GITHUB_CLIENT_SECRET;

    if (isConfigured) {
      const axios = require('axios');

      // Paso 1: Intercambiar code por access_token
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      }, {
        headers: { 'Accept': 'application/json' }
      });

      if (tokenResponse.data.error) {
        console.error('GitHub Auth Error:', tokenResponse.data);
        return res.status(401).json({ error: 'Error validating GitHub code' });
      }

      const accessToken = tokenResponse.data.access_token;

      // Paso 2: Obtener datos del usuario
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Paso 3: Obtener email si es privado
      if (!userResponse.data.email) {
        try {
          const emailsResponse = await axios.get('https://api.github.com/user/emails', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          const primary = emailsResponse.data.find(e => e.primary) || emailsResponse.data[0];
          if (primary) userResponse.data.email = primary.email;
        } catch (e) {
          console.warn('Could not fetch GitHub emails', e.message);
        }
      }

      userData = userResponse.data;
    } else {
      // Mock para desarrollo
      console.warn('⚠️ GitHub Auth: Ejecutando en modo SIMULACIÓN (Faltan keys o son las dummy)');
      userData = {
        id: `gh_${Date.now()}`,
        login: `githubuser${Date.now()}`,
        name: 'GitHub User (Simulado)',
        email: `gh_user_${Date.now()}@github.com`,
        avatar_url: 'https://via.placeholder.com/150'
      };
    }

    // Buscar o crear usuario
    let user = await User.findOne({ githubId: userData.id.toString() });
    let isNewUser = false;

    if (!user) {
      user = await User.findOne({ email: userData.email });
      if (user) {
        user.githubId = userData.id.toString();
        user.authMethod = 'github';
        await user.save();
      } else {
        isNewUser = true;
        user = new User({
          email: userData.email,
          username: userData.login || userData.name,
          githubId: userData.id.toString(),
          authMethod: 'github',
          profileImage: userData.avatar_url,
          roles: ['USER'],
          'affiliate.referralCode': crypto.randomBytes(4).toString('hex').toUpperCase()
        });
        await user.save();

        // Procesar referido
        if (referralCode) {
          const referrer = await User.findOne({ 'affiliate.referralCode': referralCode });
          if (referrer) {
            await grantReferralReward(referrer._id, user._id);
          }
        }
      }
    }

    const token = generateToken(user._id);

    res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? 'Usuario creado con GitHub' : 'Login con GitHub exitoso',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profileImage: user.profileImage,
        roles: user.roles,
        referralCode: user.affiliate.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error en GitHub Auth:', error);
    res.status(500).json({ error: 'Error en autenticación con GitHub' });
  }
});

/**
 * @route   POST /api/auth/register-wallet
 * @desc    Register with wallet signature verification
 * @access  Public
 */
router.post('/register-wallet', [
  body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
  body('signature').isString().notEmpty().withMessage('Signature is required'),
  body('message').isString().notEmpty().withMessage('Message is required'),
  body('username').optional().isString().trim(),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional().isString().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { walletAddress, signature, message, username, email, phone } = req.body;

  try {
    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Check if user already exists
    let existingUser = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (existingUser) {
      return res.status(400).json({ error: 'Wallet address already registered' });
    }

    // Check if email is already used
    if (email) {
      const emailUser = await User.findOne({ email: email.toLowerCase() });
      if (emailUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    // Create new user
    const newUserData = {
      walletAddress: walletAddress.toLowerCase(),
      username: username || `User_${walletAddress.slice(2, 8)}`,
      email: email ? email.toLowerCase() : null,
      phone: phone || null,
      roles: ['user'],
      affiliate: {
        referralCode: `BZH${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      }
    };

    const user = new User(newUserData);
    await user.save();

    // Generate JWT
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        roles: user.roles,
        referralCode: user.affiliate.referralCode
      },
      token
    });

  } catch (error) {
    console.error('Error in register-wallet:', error);
    res.status(500).json({ error: 'Server error during wallet registration' });
  }
});

/**
 * @route   POST /api/auth/send-verification
 * @desc    Send verification code to email
 * @access  Public
 */
router.post('/send-verification', [
  body('email').isEmail().withMessage('Invalid email address')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    // Generate 6-digit code
    const code = generateVerificationCode();

    // Store code with 10 minute expiration
    verificationCodes.set(email.toLowerCase(), {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send email
    await sendVerificationEmail(email, code);

    res.json({
      success: true,
      message: 'Verification code sent to your email'
    });

  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * @route   POST /api/auth/verify-code
 * @desc    Verify email verification code
 * @access  Public
 */
router.post('/verify-code', [
  body('email').isEmail().withMessage('Invalid email address'),
  body('code').isString().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, code } = req.body;

  try {
    const storedData = verificationCodes.get(email.toLowerCase());

    if (!storedData) {
      return res.status(400).json({
        verified: false,
        error: 'No verification code found for this email'
      });
    }

    // Check if code expired
    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(email.toLowerCase());
      return res.status(400).json({
        verified: false,
        error: 'Verification code expired'
      });
    }

    // Check if code matches
    if (storedData.code !== code) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid verification code'
      });
    }

    // Code is valid, delete it
    verificationCodes.delete(email.toLowerCase());

    res.json({
      verified: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info by wallet address (auto-creates user if not exists)
 * @access  Public (requires wallet address in header)
 */
router.get('/me', async (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: 'Wallet address not provided'
      });
    }

    // Find or create user by wallet address
    let user = await User.findOne({
      walletAddress: walletAddress.toLowerCase()
    });

    // If user doesn't exist, create a new one
    if (!user) {
      console.log(`📝 Creating new user for wallet: ${walletAddress}`);
      user = new User({
        walletAddress: walletAddress.toLowerCase(),
        username: `User_${walletAddress.slice(2, 8)}`,
        role: 'USER',
        subscription: 'FREE',
        isVerified: false,
        isBanned: false
      });
      await user.save();
    }

    // Check if wallet is a Super Admin and upgrade if necessary
    user = await ensureSuperAdminRole(user);

    // Return user data
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isBanned: user.isBanned,
        subscription: user.subscription,
        profile: user.profile,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error in /me endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message
    });
  }
});

// ============================================================================
// NEW SECURITY ENDPOINTS - Day 4 Implementation
// ============================================================================

const {
  createTokenPair,
  refreshTokens,
  revokeToken,
  revokeAllUserTokens,
  getUserSessions,
  verifyTokenMiddleware
} = require('../middleware/refreshTokenSystem');

const {
  generateTwoFactorSecret,
  verifyAndEnable2FA,
  verify2FACode,
  disable2FA,
  is2FAEnabled,
  regenerateBackupCodes,
  get2FAStats
} = require('../middleware/twoFactorAuth');

/**
 * POST /api/auth/refresh
 * Refrescar access token usando refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }

    const deviceInfo = {
      userAgent: req.get('user-agent'),
      ip: req.ip
    };

    const result = refreshTokens(refreshToken, deviceInfo);

    if (!result.success) {
      if (result.critical) {
        return res.status(401).json({
          error: 'Token reuse detected',
          code: 'TOKEN_REUSE',
          message: 'All sessions have been terminated for security reasons'
        });
      }

      return res.status(401).json({
        error: 'Invalid refresh token',
        reason: result.reason
      });
    }

    res.json({
      success: true,
      ...result.tokens
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout de la sesión actual
 */
router.post('/logout', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const tokenId = req.user.tokenId;

    revokeToken(tokenId, userId, 'user_logout');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout de todos los dispositivos
 */
router.post('/logout-all', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = revokeAllUserTokens(userId, 'user_logout_all');

    res.json({
      success: true,
      message: `Logged out from ${result.count} devices`
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      error: 'Logout all failed',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/sessions
 * Listar sesiones activas
 */
router.get('/sessions', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessions = getUserSessions(userId);

    res.json({
      success: true,
      sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to get sessions',
      message: error.message
    });
  }
});

/**
 * DELETE /api/auth/sessions/:tokenId
 * Revocar sesión específica
 */
router.delete('/sessions/:tokenId', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tokenId } = req.params;

    revokeToken(tokenId, userId, 'user_revoke_session');

    res.json({
      success: true,
      message: 'Session revoked'
    });

  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      message: error.message
    });
  }
});

// ============================================================================
// 2FA ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/2fa/setup
 * Iniciar configuración de 2FA
 */
router.post('/2fa/setup', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const userEmail = req.body.email || `${userId}@bezhas.com`;

    if (is2FAEnabled(userId)) {
      return res.status(400).json({
        error: '2FA already enabled'
      });
    }

    const setup = await generateTwoFactorSecret(userId, userEmail);

    res.json({
      success: true,
      ...setup,
      message: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)'
    });

  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      error: '2FA setup failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/2fa/verify
 * Verificar código y activar 2FA
 */
router.post('/2fa/verify', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Verification code required'
      });
    }

    const result = verifyAndEnable2FA(userId, code);

    if (!result.success) {
      return res.status(400).json({
        error: result.error
      });
    }

    res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes: result.backupCodes,
      warning: '⚠️ Save these backup codes in a safe place. You will need them if you lose access to your authenticator app.'
    });

  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({
      error: '2FA verification failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/2fa/disable
 * Desactivar 2FA
 */
router.post('/2fa/disable', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: '2FA code required to disable'
      });
    }

    const result = disable2FA(userId, null, code);

    if (!result.success) {
      return res.status(400).json({
        error: result.error
      });
    }

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      error: 'Failed to disable 2FA',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/2fa/backup-codes
 * Regenerar códigos de backup
 */
router.post('/2fa/backup-codes', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: '2FA code required'
      });
    }

    const result = regenerateBackupCodes(userId, code);

    if (!result.success) {
      return res.status(400).json({
        error: result.error
      });
    }

    res.json({
      success: true,
      backupCodes: result.backupCodes,
      message: 'New backup codes generated. Previous codes are now invalid.'
    });

  } catch (error) {
    console.error('Backup codes error:', error);
    res.status(500).json({
      error: 'Failed to generate backup codes',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/2fa/status
 * Obtener estado de 2FA
 */
router.get('/2fa/status', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const stats = get2FAStats(userId);

    res.json({
      success: true,
      ...stats
    });

  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({
      error: 'Failed to get 2FA status',
      message: error.message
    });
  }
});

module.exports = router;