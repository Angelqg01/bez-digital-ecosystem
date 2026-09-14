/**
 * Pruebas del API de feed.
 *
 * Las tres pruebas devolvían 500 tras diez segundos de espera: las rutas usan
 * el modelo `Post` de Mongoose y aquí no hay MongoDB, así que cada consulta se
 * quedaba en el búfer hasta agotar el `bufferTimeoutMS` y el handler caía al
 * `catch`. No era un fallo de las rutas, sino una suite que exigía una base de
 * datos que la CI no levanta.
 *
 * Se sustituye el modelo por un almacén en memoria con la misma interfaz que
 * usan las rutas (`new Post(...)`, `save`, `find().sort().limit().lean()`,
 * `findById`). Así se ejercita de verdad la lógica del router —validación de
 * campos, códigos de estado, filtrado de ocultos, idempotencia del «me gusta»—
 * sin depender del entorno. La persistencia real la cubre
 * `tests/database-connection.test.js`, que solo corre con `RUN_DB_TESTS=true`.
 */

// Ojo: funciones y clases planas, no `jest.fn()`. La configuración del
// proyecto activa `resetMocks`, que vaciaría la implementación antes de cada
// prueba y dejaría el modelo devolviendo `undefined`.
jest.mock('../models/post.model', () => {
    const almacen = new Map();
    let secuencia = 0;

    class Post {
        constructor(datos = {}) {
            Object.assign(this, {
                likes: [],
                comments: [],
                hidden: false,
                pinned: false,
                validated: false,
                ...datos,
            });
            this._id = datos._id || `post_${++secuencia}`;
            this.createdAt = datos.createdAt || new Date();
        }

        async save() {
            almacen.set(String(this._id), this);
            return this;
        }

        toJSON() {
            return { ...this };
        }

        static async findById(id) {
            return almacen.get(String(id)) || null;
        }

        /** Encadenable como en Mongoose: find().sort().limit().lean() */
        static find(query = {}) {
            let filas = Array.from(almacen.values());

            // Única condición que usa la ruta: ocultar los posts marcados.
            if (query.hidden && query.hidden.$ne === true) {
                filas = filas.filter((p) => p.hidden !== true);
            }

            const cadena = {
                sort(criterio = {}) {
                    const campos = Object.entries(criterio);
                    filas = [...filas].sort((a, b) => {
                        for (const [campo, dir] of campos) {
                            const x = a[campo] ?? 0;
                            const y = b[campo] ?? 0;
                            if (x < y) return dir === -1 ? 1 : -1;
                            if (x > y) return dir === -1 ? -1 : 1;
                        }
                        return 0;
                    });
                    return cadena;
                },
                limit(n) {
                    filas = filas.slice(0, n);
                    return cadena;
                },
                lean() {
                    return Promise.resolve(filas.map((p) => ({ ...p })));
                },
                then(resolve, reject) {
                    return Promise.resolve(filas).then(resolve, reject);
                },
            };

            return cadena;
        }

        /** Utilidad de la propia prueba, no parte de la interfaz de Mongoose. */
        static __reset() {
            almacen.clear();
            secuencia = 0;
        }
    }

    return Post;
});

const request = require('supertest');
const Post = require('../models/post.model');
const { app, server } = require('../server');

describe('Feed API', () => {
    beforeEach(() => {
        Post.__reset();
    });

    afterAll((done) => {
        try { server.close(() => done()); } catch (_) { done(); }
    });

    describe('GET /api/feed', () => {
        it('devuelve un array', async () => {
            const res = await request(app).get('/api/feed');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('no expone los posts ocultos a quien no es administrador', async () => {
            await new Post({ author: '0xa', content: 'visible' }).save();
            await new Post({ author: '0xb', content: 'oculto', hidden: true }).save();

            const res = await request(app).get('/api/feed');
            expect(res.status).toBe(200);
            const contenidos = res.body.map((p) => p.content);
            expect(contenidos).toContain('visible');
            expect(contenidos).not.toContain('oculto');
        });

        it('coloca los posts fijados por delante', async () => {
            await new Post({ author: '0xa', content: 'normal' }).save();
            await new Post({ author: '0xb', content: 'fijado', pinned: true }).save();

            const res = await request(app).get('/api/feed');
            expect(res.body[0].content).toBe('fijado');
        });
    });

    describe('POST /api/feed', () => {
        it('crea un post', async () => {
            const payload = { author: '0xabc', content: 'Hello from test' };
            const res = await request(app).post('/api/feed').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('content', payload.content);
            expect(res.body).toHaveProperty('author', payload.author);
        });

        it('nace sin validar y sin fijar: eso lo decide el administrador', async () => {
            const res = await request(app).post('/api/feed').send({ author: '0xabc', content: 'x' });
            expect(res.body.validated).toBe(false);
            expect(res.body.pinned).toBe(false);
            expect(res.body.hidden).toBe(false);
        });

        it('rechaza con 400 si falta autor o contenido', async () => {
            await request(app).post('/api/feed').send({ content: 'sin autor' }).expect(400);
            await request(app).post('/api/feed').send({ author: '0xabc' }).expect(400);
            await request(app).post('/api/feed').send({}).expect(400);
        });
    });

    describe('POST /api/feed/:id/like y /comment', () => {
        async function crearPost() {
            const res = await request(app).post('/api/feed').send({ author: '0xdef', content: 'Like me' });
            return res.body._id || res.body.id;
        }

        it('registra el me gusta y el comentario', async () => {
            const id = await crearPost();

            const like = await request(app).post(`/api/feed/${id}/like`).send({ author: '0xdef' });
            expect(like.status).toBe(200);
            expect(like.body.likes).toContain('0xdef');

            const comment = await request(app)
                .post(`/api/feed/${id}/comment`)
                .send({ author: '0xdef', content: 'Nice!' });
            expect(comment.status).toBe(200);
            expect(comment.body.comments).toHaveLength(1);
            expect(comment.body.comments[0]).toMatchObject({ author: '0xdef', content: 'Nice!' });
        });

        it('el me gusta es idempotente: dos veces no cuenta dos', async () => {
            const id = await crearPost();
            await request(app).post(`/api/feed/${id}/like`).send({ author: '0xdef' });
            const segundo = await request(app).post(`/api/feed/${id}/like`).send({ author: '0xdef' });
            expect(segundo.body.likes).toEqual(['0xdef']);
        });

        it('unlike retira el me gusta', async () => {
            const id = await crearPost();
            await request(app).post(`/api/feed/${id}/like`).send({ author: '0xdef' });
            const res = await request(app).post(`/api/feed/${id}/unlike`).send({ author: '0xdef' });
            expect(res.status).toBe(200);
            expect(res.body.likes).not.toContain('0xdef');
        });

        it('devuelve 404 sobre un post que no existe', async () => {
            await request(app).post('/api/feed/no-existe/like').send({ author: '0xdef' }).expect(404);
            await request(app)
                .post('/api/feed/no-existe/comment')
                .send({ author: '0xdef', content: 'hola' })
                .expect(404);
        });

        it('devuelve 400 si falta el autor', async () => {
            const id = await crearPost();
            await request(app).post(`/api/feed/${id}/like`).send({}).expect(400);
            await request(app).post(`/api/feed/${id}/comment`).send({ content: 'sin autor' }).expect(400);
        });
    });
});
