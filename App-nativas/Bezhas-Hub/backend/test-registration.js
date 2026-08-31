require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user.model');
const bcrypt = require('bcryptjs');

// Mock request body similar to what frontend sends
const testData = {
    email: `test_corp_${Date.now()}@example.com`,
    password: 'securePassword123',
    accountType: 'company',
    companyName: 'BeZhas Logistics Test',
    industry: 'Logistics',
    taxId: 'B-12345678',
    phone: '+34600112233',
    address: {
        street: 'Calle Test 123',
        city: 'Madrid',
        country: 'Spain'
    }
};

async function testRegistration() {
    console.log('🔄 Connecting to MongoDB...');
    try {
        const dbUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
        if (!dbUri) {
            throw new Error('MONGODB_URI or DATABASE_URL not found in environment variables');
        }
        await mongoose.connect(dbUri);
        console.log('✅ Connected.');

        // 1. Check if user exists (cleanup from previous runs if needed, though email is unique timestamped)

        // 2. Create User manually (simulating controller logic)
        console.log('🔄 Creating User...', testData);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(testData.password, salt);

        const userData = {
            ...testData,
            password: hashedPassword,
            username: testData.companyName.replace(/\s+/g, ''),
            roles: ['USER', 'VERIFIED_BUSINESS'], // Simulating logic
            'affiliate.referralCode': 'TEST' + Math.floor(Math.random() * 1000)
        };

        const user = new User(userData);
        await user.save();
        console.log('✅ User Saved Successfully:', user._id);
        console.log('   - Email:', user.email);
        console.log('   - Company:', user.companyName);
        console.log('   - Industry:', user.industry);

        // 3. Clean up
        console.log('🔄 Cleaning up test user...');
        await User.deleteOne({ _id: user._id });
        console.log('✅ Cleaned up.');

    } catch (error) {
        console.error('❌ Error during test:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testRegistration();
