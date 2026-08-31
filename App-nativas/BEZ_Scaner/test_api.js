const axios = require('axios');
require('dotenv').config();

const apiUrl = process.env.CLI_API_URL || 'http://localhost:3000/api';
const apiKey = process.env.API_KEY;

describe('API BEZ_Scaner', () => {
    it('debe rechazar sin API KEY', async () => {
        try {
            await axios.get(`${apiUrl}/sensor/CONTAINER-001`);
            throw new Error('No debería permitir acceso sin API KEY');
        } catch (err) {
            expect(err.response.status).toBe(401);
        }
    });

    it('debe consultar datos de sensor con API KEY', async () => {
        const res = await axios.get(`${apiUrl}/sensor/CONTAINER-001`, { headers: { 'x-api-key': apiKey } });
        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('data');
    });

    // Puedes agregar más pruebas para mint, transfer y registro de sensor
});
