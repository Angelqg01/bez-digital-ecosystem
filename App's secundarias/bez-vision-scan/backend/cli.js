#!/usr/bin/env node
const inquirer = require('inquirer');
const axios = require('axios');
require('dotenv').config();

const apiUrl = process.env.CLI_API_URL || 'http://localhost:3000/api';
const apiKey = process.env.API_KEY;

async function mainMenu() {
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: '¿Qué acción deseas realizar?',
            choices: [
                { name: 'Mint NFT logístico', value: 'mint' },
                { name: 'Transferir NFT', value: 'transfer' },
                { name: 'Consultar datos de sensor', value: 'sensor_get' },
                { name: 'Registrar datos de sensor', value: 'sensor_post' },
                { name: 'Salir', value: 'exit' }
            ]
        }
    ]);

    if (action === 'mint') {
        const { to, uri, containerId } = await inquirer.prompt([
            { name: 'to', message: 'Dirección destino:' },
            { name: 'uri', message: 'URI metadata:' },
            { name: 'containerId', message: 'ID de contenedor:' }
        ]);
        try {
            const res = await axios.post(`${apiUrl}/mint`, { to, uri, containerId }, { headers: { 'x-api-key': apiKey } });
            console.log('Mint exitoso:', res.data);
        } catch (err) {
            console.error('Error:', err.response?.data || err.message);
        }
    }
    if (action === 'transfer') {
        const { tokenId, to } = await inquirer.prompt([
            { name: 'tokenId', message: 'ID del NFT:' },
            { name: 'to', message: 'Dirección destino:' }
        ]);
        try {
            const res = await axios.post(`${apiUrl}/transfer`, { tokenId, to }, { headers: { 'x-api-key': apiKey } });
            console.log('Transferencia exitosa:', res.data);
        } catch (err) {
            console.error('Error:', err.response?.data || err.message);
        }
    }
    if (action === 'sensor_get') {
        const { containerId } = await inquirer.prompt([
            { name: 'containerId', message: 'ID de contenedor:' }
        ]);
        try {
            const res = await axios.get(`${apiUrl}/sensor/${containerId}`, { headers: { 'x-api-key': apiKey } });
            console.log('Datos de sensor:', res.data);
        } catch (err) {
            console.error('Error:', err.response?.data || err.message);
        }
    }
    if (action === 'sensor_post') {
        const { containerId, temperature, status } = await inquirer.prompt([
            { name: 'containerId', message: 'ID de contenedor:' },
            { name: 'temperature', message: 'Temperatura:' },
            { name: 'status', message: 'Estado:' }
        ]);
        try {
            const res = await axios.post(`${apiUrl}/sensor`, { containerId, temperature, status }, { headers: { 'x-api-key': apiKey } });
            console.log('Registro exitoso:', res.data);
        } catch (err) {
            console.error('Error:', err.response?.data || err.message);
        }
    }
    if (action !== 'exit') {
        await mainMenu();
    }
}

mainMenu();
