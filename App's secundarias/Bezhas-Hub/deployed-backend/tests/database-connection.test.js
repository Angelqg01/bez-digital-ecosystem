/**
 * ============================================================================
 * DATABASE CONNECTION TESTS
 * ============================================================================
 * 
 * Tests para validar la conexión a MongoDB y operaciones básicas
 */

const mongoose = require('mongoose');

describe('Database Connection Tests', () => {
    beforeAll(async () => {
        // Conectar a MongoDB antes de los tests
        const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/bezhas_test';

        try {
            await mongoose.connect(DATABASE_URL, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Connected to test database');
        } catch (error) {
            console.error('❌ Failed to connect to database:', error.message);
            throw error;
        }
    });

    afterAll(async () => {
        // Cerrar conexión después de los tests
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    });

    describe('Connection Validation', () => {
        test('should connect to MongoDB successfully', () => {
            expect(mongoose.connection.readyState).toBe(1); // 1 = connected
        });

        test('should have correct database name', () => {
            const dbName = mongoose.connection.db.databaseName;
            expect(dbName).toMatch(/bezhas/);
        });

        test('should be able to ping database', async () => {
            const result = await mongoose.connection.db.admin().ping();
            expect(result.ok).toBe(1);
        });
    });

    describe('CRUD Operations', () => {
        // Modelo de prueba simple
        const TestSchema = new mongoose.Schema({
            name: String,
            value: Number,
            createdAt: { type: Date, default: Date.now }
        });

        const TestModel = mongoose.model('Test', TestSchema);

        beforeEach(async () => {
            // Limpiar colección antes de cada test
            await TestModel.deleteMany({});
        });

        test('should create a document', async () => {
            const doc = await TestModel.create({
                name: 'test-document',
                value: 42
            });

            expect(doc).toBeDefined();
            expect(doc.name).toBe('test-document');
            expect(doc.value).toBe(42);
            expect(doc._id).toBeDefined();
        });

        test('should read a document', async () => {
            // Crear documento
            const created = await TestModel.create({
                name: 'read-test',
                value: 100
            });

            // Leer documento
            const found = await TestModel.findById(created._id);

            expect(found).toBeDefined();
            expect(found.name).toBe('read-test');
            expect(found.value).toBe(100);
        });

        test('should update a document', async () => {
            // Crear documento
            const doc = await TestModel.create({
                name: 'update-test',
                value: 50
            });

            // Actualizar
            doc.value = 75;
            await doc.save();

            // Verificar actualización
            const updated = await TestModel.findById(doc._id);
            expect(updated.value).toBe(75);
        });

        test('should delete a document', async () => {
            // Crear documento
            const doc = await TestModel.create({
                name: 'delete-test',
                value: 25
            });

            // Eliminar
            await TestModel.findByIdAndDelete(doc._id);

            // Verificar eliminación
            const deleted = await TestModel.findById(doc._id);
            expect(deleted).toBeNull();
        });

        test('should query multiple documents', async () => {
            // Crear múltiples documentos
            await TestModel.create([
                { name: 'doc1', value: 10 },
                { name: 'doc2', value: 20 },
                { name: 'doc3', value: 30 }
            ]);

            // Consultar todos
            const docs = await TestModel.find({});
            expect(docs).toHaveLength(3);

            // Consultar con filtro
            const filtered = await TestModel.find({ value: { $gte: 20 } });
            expect(filtered).toHaveLength(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle connection errors gracefully', async () => {
            // Intentar conectar a URL inválida
            const invalidConnection = mongoose.createConnection('mongodb://invalid:27017/test', {
                serverSelectionTimeoutMS: 1000
            });

            await expect(
                invalidConnection.asPromise()
            ).rejects.toThrow();

            await invalidConnection.close();
        });

        test('should handle validation errors', async () => {
            const StrictSchema = new mongoose.Schema({
                requiredField: { type: String, required: true },
                email: {
                    type: String,
                    required: true,
                    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                }
            });

            const StrictModel = mongoose.model('Strict', StrictSchema);

            // Test campo requerido faltante
            await expect(
                StrictModel.create({ email: 'test@example.com' })
            ).rejects.toThrow();

            // Test email inválido
            await expect(
                StrictModel.create({ requiredField: 'test', email: 'invalid-email' })
            ).rejects.toThrow();
        });
    });

    describe('Performance Tests', () => {
        const PerfSchema = new mongoose.Schema({
            data: String,
            timestamp: Date
        });

        const PerfModel = mongoose.model('Performance', PerfSchema);

        beforeEach(async () => {
            await PerfModel.deleteMany({});
        });

        test('should handle bulk inserts efficiently', async () => {
            const startTime = Date.now();

            // Insertar 100 documentos
            const docs = Array.from({ length: 100 }, (_, i) => ({
                data: `Document ${i}`,
                timestamp: new Date()
            }));

            await PerfModel.insertMany(docs);

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Debe completarse en menos de 1 segundo
            expect(duration).toBeLessThan(1000);

            // Verificar que se insertaron todos
            const count = await PerfModel.countDocuments();
            expect(count).toBe(100);
        });

        test('should handle concurrent operations', async () => {
            // Ejecutar múltiples operaciones en paralelo
            const operations = Array.from({ length: 10 }, (_, i) =>
                PerfModel.create({ data: `Concurrent ${i}`, timestamp: new Date() })
            );

            const results = await Promise.all(operations);

            expect(results).toHaveLength(10);
            results.forEach(doc => {
                expect(doc._id).toBeDefined();
            });
        });
    });

    describe('Index and Query Optimization', () => {
        const IndexedSchema = new mongoose.Schema({
            userId: { type: String, index: true },
            email: { type: String, unique: true },
            createdAt: { type: Date, default: Date.now, index: true }
        });

        const IndexedModel = mongoose.model('Indexed', IndexedSchema);

        beforeEach(async () => {
            await IndexedModel.deleteMany({});
        });

        test('should create indexes correctly', async () => {
            const indexes = await IndexedModel.collection.getIndexes();

            // Debe tener índices en userId, email, y createdAt
            expect(indexes).toHaveProperty('userId_1');
            expect(indexes).toHaveProperty('email_1');
            expect(indexes).toHaveProperty('createdAt_1');
        });

        test('should enforce unique constraint', async () => {
            await IndexedModel.create({
                userId: 'user1',
                email: 'unique@example.com'
            });

            // Intentar crear documento con email duplicado
            await expect(
                IndexedModel.create({
                    userId: 'user2',
                    email: 'unique@example.com'
                })
            ).rejects.toThrow();
        });
    });
});

// Test de conexión standalone (puede ejecutarse independientemente)
describe('Standalone Connection Test', () => {
    test('should connect to DATABASE_URL from environment', async () => {
        const DATABASE_URL = process.env.DATABASE_URL;

        if (!DATABASE_URL) {
            console.warn('⚠️ DATABASE_URL not set, skipping test');
            return;
        }

        const connection = await mongoose.createConnection(DATABASE_URL, {
            serverSelectionTimeoutMS: 5000
        }).asPromise();

        expect(connection.readyState).toBe(1);

        await connection.close();
    });
});
