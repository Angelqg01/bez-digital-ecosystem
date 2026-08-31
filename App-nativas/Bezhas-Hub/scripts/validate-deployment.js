#!/usr/bin/env node

/**
 * Pre-Deployment Validation Script
 * ================================
 * Run this script before deploying to production to validate:
 * - Environment variables
 * - Dependencies
 * - Security configurations
 * - Build artifacts
 * 
 * Usage: node scripts/validate-deployment.js [--env production|staging]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) { log('green', `✅ ${message}`); }
function error(message) { log('red', `❌ ${message}`); }
function warning(message) { log('yellow', `⚠️  ${message}`); }
function info(message) { log('blue', `ℹ️  ${message}`); }
function header(message) {
    console.log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}${message}${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

let errors = [];
let warnings = [];

// ============================================================================
// VALIDATION CHECKS
// ============================================================================

function checkRequiredEnvVars() {
    header('Checking Required Environment Variables');

    const requiredVars = [
        'NODE_ENV',
        'MONGODB_URI',
        'JWT_SECRET',
        'STRIPE_SECRET_KEY',
        'RPC_URL'
    ];

    const recommendedVars = [
        'REDIS_URL',
        'STRIPE_WEBHOOK_SECRET',
        'OPENAI_API_KEY',
        'FRONTEND_URL',
        'DISCORD_WEBHOOK_URL'
    ];

    // Check required
    for (const varName of requiredVars) {
        if (process.env[varName]) {
            success(`${varName} is set`);
        } else {
            error(`${varName} is NOT set (required)`);
            errors.push(`Missing required environment variable: ${varName}`);
        }
    }

    console.log('');

    // Check recommended
    for (const varName of recommendedVars) {
        if (process.env[varName]) {
            success(`${varName} is set`);
        } else {
            warning(`${varName} is NOT set (recommended)`);
            warnings.push(`Missing recommended environment variable: ${varName}`);
        }
    }
}

function checkSecurityConfig() {
    header('Checking Security Configuration');

    // JWT Secret length
    const jwtSecret = process.env.JWT_SECRET || '';
    if (jwtSecret.length >= 32) {
        success('JWT_SECRET has sufficient length (≥32 characters)');
    } else if (jwtSecret.length > 0) {
        warning(`JWT_SECRET is only ${jwtSecret.length} characters (recommend ≥32)`);
        warnings.push('JWT_SECRET should be at least 32 characters');
    } else {
        error('JWT_SECRET is not set');
        errors.push('JWT_SECRET is required');
    }

    // Check if default/test secrets are being used
    const dangerousPatterns = ['test', 'secret', 'password', '1234', 'default', 'change_me'];
    if (dangerousPatterns.some(p => jwtSecret.toLowerCase().includes(p))) {
        warning('JWT_SECRET may contain a weak or default value');
        warnings.push('Consider using a stronger JWT_SECRET');
    }

    // Check NODE_ENV
    if (process.env.NODE_ENV === 'production') {
        success('NODE_ENV is set to production');
    } else {
        warning(`NODE_ENV is '${process.env.NODE_ENV}' (should be 'production' for deployment)`);
    }

    // Check HTTPS enforcement
    const frontendUrl = process.env.FRONTEND_URL || '';
    if (frontendUrl.startsWith('https://')) {
        success('FRONTEND_URL uses HTTPS');
    } else if (frontendUrl) {
        warning('FRONTEND_URL should use HTTPS in production');
        warnings.push('FRONTEND_URL should start with https://');
    }
}

function checkDependencies() {
    header('Checking Dependencies');

    // Check backend dependencies
    const backendPackageJson = path.join(__dirname, '../backend/package.json');
    if (fs.existsSync(backendPackageJson)) {
        success('Backend package.json exists');

        const pkg = JSON.parse(fs.readFileSync(backendPackageJson, 'utf8'));
        const depCount = Object.keys(pkg.dependencies || {}).length;
        info(`Backend has ${depCount} dependencies`);

        // Check for security-sensitive packages
        const securityPackages = ['helmet', 'express-rate-limit', 'jsonwebtoken', 'bcryptjs'];
        for (const pkgName of securityPackages) {
            if (pkg.dependencies[pkgName]) {
                success(`Security package '${pkgName}' is installed`);
            } else {
                warning(`Security package '${pkgName}' is not in dependencies`);
            }
        }
    } else {
        error('Backend package.json not found');
        errors.push('Backend package.json is missing');
    }

    // Check frontend dependencies
    const frontendPackageJson = path.join(__dirname, '../frontend/package.json');
    if (fs.existsSync(frontendPackageJson)) {
        success('Frontend package.json exists');
    } else {
        error('Frontend package.json not found');
        errors.push('Frontend package.json is missing');
    }
}

function checkBuildArtifacts() {
    header('Checking Build Artifacts');

    // Check frontend build
    const frontendDist = path.join(__dirname, '../frontend/dist');
    if (fs.existsSync(frontendDist)) {
        success('Frontend build exists (dist/)');

        const indexHtml = path.join(frontendDist, 'index.html');
        if (fs.existsSync(indexHtml)) {
            success('index.html exists in build');
        } else {
            error('index.html missing from build');
            errors.push('Frontend build is incomplete - missing index.html');
        }
    } else {
        warning('Frontend build not found (run npm run build in frontend/)');
        warnings.push('Frontend needs to be built before deployment');
    }

    // Check Dockerfiles
    const dockerfiles = [
        { path: '../backend/Dockerfile', name: 'Backend Dockerfile' },
        { path: '../backend/Dockerfile.optimized', name: 'Backend Optimized Dockerfile' },
        { path: '../frontend/Dockerfile', name: 'Frontend Dockerfile' },
        { path: '../frontend/Dockerfile.optimized', name: 'Frontend Optimized Dockerfile' }
    ];

    for (const df of dockerfiles) {
        const fullPath = path.join(__dirname, df.path);
        if (fs.existsSync(fullPath)) {
            success(`${df.name} exists`);
        } else {
            if (df.path.includes('optimized')) {
                warning(`${df.name} not found`);
            } else {
                error(`${df.name} not found`);
                errors.push(`${df.name} is missing`);
            }
        }
    }
}

function checkGCPConfig() {
    header('Checking GCP Configuration');

    // Check service.yaml files
    const serviceYamls = [
        { path: '../backend/service.yaml', name: 'Backend Cloud Run config' },
        { path: '../frontend/service.yaml', name: 'Frontend Cloud Run config' }
    ];

    for (const sy of serviceYamls) {
        const fullPath = path.join(__dirname, sy.path);
        if (fs.existsSync(fullPath)) {
            success(`${sy.name} exists`);
        } else {
            warning(`${sy.name} not found`);
            warnings.push(`${sy.name} may need to be created for Cloud Run deployment`);
        }
    }

    // Check GitHub Actions workflow
    const workflowPath = path.join(__dirname, '../.github/workflows/deploy-gcp.yml');
    if (fs.existsSync(workflowPath)) {
        success('GitHub Actions CI/CD workflow exists');
    } else {
        warning('GitHub Actions CI/CD workflow not found');
        warnings.push('CI/CD pipeline may need to be configured');
    }

    // Check cloudbuild.yaml
    const cloudbuildPath = path.join(__dirname, '../cloudbuild.yaml');
    if (fs.existsSync(cloudbuildPath)) {
        success('Cloud Build configuration exists');
    } else {
        info('Cloud Build configuration not found (optional if using GitHub Actions)');
    }
}

function checkTests() {
    header('Checking Test Coverage');

    // Check if tests exist
    const testDirs = [
        { path: '../backend/tests', name: 'Backend tests' },
        { path: '../test', name: 'Smart contract tests' }
    ];

    for (const td of testDirs) {
        const fullPath = path.join(__dirname, td.path);
        if (fs.existsSync(fullPath)) {
            const testFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.test.js'));
            success(`${td.name} directory exists (${testFiles.length} test files)`);
        } else {
            warning(`${td.name} directory not found`);
            warnings.push(`${td.name} should be added for better coverage`);
        }
    }

    // Check Jest config
    const jestConfig = path.join(__dirname, '../backend/jest.config.js');
    if (fs.existsSync(jestConfig)) {
        success('Jest configuration exists');
    } else {
        warning('Jest configuration not found');
    }
}

function runAllChecks() {
    console.log(`\n${colors.bold}${colors.blue}`);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     BeZhas Web3 - Pre-Deployment Validation Script         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);

    info(`Running validation at ${new Date().toISOString()}`);
    info(`Environment: ${process.env.NODE_ENV || 'not set'}`);

    checkRequiredEnvVars();
    checkSecurityConfig();
    checkDependencies();
    checkBuildArtifacts();
    checkGCPConfig();
    checkTests();

    // Summary
    header('Validation Summary');

    if (errors.length === 0 && warnings.length === 0) {
        log('green', '🎉 All checks passed! Ready for deployment.');
        process.exit(0);
    } else {
        if (errors.length > 0) {
            log('red', `\n${errors.length} ERROR(S) found:`);
            errors.forEach((e, i) => log('red', `  ${i + 1}. ${e}`));
        }

        if (warnings.length > 0) {
            log('yellow', `\n${warnings.length} WARNING(S) found:`);
            warnings.forEach((w, i) => log('yellow', `  ${i + 1}. ${w}`));
        }

        if (errors.length > 0) {
            log('red', '\n⛔ Deployment NOT recommended until errors are resolved.');
            process.exit(1);
        } else {
            log('yellow', '\n⚠️  Deployment possible, but consider addressing warnings.');
            process.exit(0);
        }
    }
}

// Run validation
runAllChecks();
