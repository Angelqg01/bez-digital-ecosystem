/**
 * Unit tests: kinaxis_supply_chain
 * Mostly simulated/mock data — minimal external dependencies.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';
import { registerKinaxisMcp } from '../../tools/kinaxisMcp.js';

describe('kinaxis_supply_chain', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerKinaxisMcp(server as any);
        handler = getHandler('kinaxis_supply_chain')!;
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('ingest_telemetry', () => {
        it('should ingest IoT telemetry data', async () => {
            const response = await handler({
                action: 'ingest_telemetry',
                deviceId: 'sensor-001',
                sensorData: {
                    temperature: 25.5,
                    humidity: 60,
                    battery: 85,
                    signal: 92,
                },
            });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
            expect(result).toHaveProperty('data');
        });

        it('should FAIL without deviceId or sensorData', async () => {
            const response = await handler({ action: 'ingest_telemetry' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'FAILED');
        });
    });

    describe('track_shipment', () => {
        it('should track a shipment', async () => {
            const response = await handler({
                action: 'track_shipment',
                shipmentId: 'SHIP-2026-001',
            });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('inventory_status', () => {
        it('should return inventory levels', async () => {
            const response = await handler({ action: 'inventory_status' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('fleet_overview', () => {
        it('should return fleet data', async () => {
            const response = await handler({ action: 'fleet_overview' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('sensor_analysis', () => {
        it('should analyze sensor data', async () => {
            const response = await handler({ action: 'sensor_analysis' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('supply_forecast', () => {
        it('should generate supply forecast', async () => {
            const response = await handler({ action: 'supply_forecast' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('response format', () => {
        it('all actions should return valid MCP content format', async () => {
            const actions = ['ingest_telemetry', 'track_shipment', 'inventory_status', 'fleet_overview', 'sensor_analysis', 'supply_forecast'];
            for (const action of actions) {
                const response = await handler({ action });
                expect(response.content).toHaveLength(1);
                expect(response.content[0].type).toBe('text');
                expect(() => JSON.parse(response.content[0].text)).not.toThrow();
            }
        });
    });
});
