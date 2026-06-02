import React, { useEffect, useState } from 'react';
import { Box, H2, H5, Illustration, Text } from '@adminjs/design-system';
import { ApiClient } from 'adminjs';

/**
 * Dashboard Component para AdminJS
 * 
 * Este componente muestra métricas clave y estadísticas en tiempo real
 * del sistema BeZhas.
 */
const Dashboard = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        newUsersThisWeek: 0,
        activeUsers: 0,
        totalGroups: 0,
        totalPosts: 0,
        totalStaked: 0,
        transactionsVolume: 0,
        recentActivity: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            // Usar ApiClient de AdminJS para hacer requests autenticadas
            const api = new ApiClient();

            // En producción, estas rutas deben estar protegidas con el mismo middleware de admin
            const response = await fetch('/api/admin/dashboard-stats', {
                credentials: 'include' // Incluir cookies de sesión
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box variant="grey">
                <Box
                    flex
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    style={{ minHeight: '400px' }}
                >
                    <Illustration variant="Rocket" />
                    <Text mt="xl">Cargando estadísticas...</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box mb="xxl">
                <H2>Panel de Control BeZhas</H2>
                <Text opacity={0.7}>
                    Vista general de la plataforma - Actualizado en tiempo real
                </Text>
            </Box>

            {/* Stats Grid */}
            <Box
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '20px',
                    marginBottom: '40px'
                }}
            >
                {/* Widget: Usuarios */}
                <StatsCard
                    title="Usuarios"
                    value={stats.totalUsers}
                    subtitle={`+${stats.newUsersThisWeek} esta semana`}
                    icon="👥"
                    color="#6366f1"
                />

                {/* Widget: Usuarios Activos */}
                <StatsCard
                    title="Usuarios Activos"
                    value={stats.activeUsers}
                    subtitle="Últimas 24 horas"
                    icon="⚡"
                    color="#10b981"
                />

                {/* Widget: Grupos */}
                <StatsCard
                    title="Grupos Creados"
                    value={stats.totalGroups}
                    subtitle="Comunidades activas"
                    icon="🏘️"
                    color="#ec4899"
                />

                {/* Widget: Posts */}
                <StatsCard
                    title="Publicaciones"
                    value={stats.totalPosts}
                    subtitle="Contenido generado"
                    icon="✍️"
                    color="#f59e0b"
                />
            </Box>

            {/* Web3 Economics Section */}
            <Box mb="xl">
                <H5 mb="lg">Economía Web3</H5>
                <Box
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '20px'
                    }}
                >
                    <StatsCard
                        title="Total en Staking"
                        value={`${stats.totalStaked.toLocaleString()} BZH`}
                        subtitle="Tokens bloqueados"
                        icon="🔒"
                        color="#8b5cf6"
                    />

                    <StatsCard
                        title="Volumen 24h"
                        value={`${stats.transactionsVolume.toLocaleString()} BZH`}
                        subtitle="Transacciones de tokens"
                        icon="💰"
                        color="#06b6d4"
                    />
                </Box>
            </Box>

            {/* Recent Activity */}
            <Box>
                <H5 mb="lg">Actividad Reciente</H5>
                <Box
                    bg="white"
                    border="default"
                    borderRadius="default"
                    p="lg"
                >
                    {stats.recentActivity.length === 0 ? (
                        <Text opacity={0.5}>No hay actividad reciente</Text>
                    ) : (
                        <Box>
                            {stats.recentActivity.map((activity, index) => (
                                <Box
                                    key={index}
                                    pb="default"
                                    mb="default"
                                    style={{
                                        borderBottom: index < stats.recentActivity.length - 1 ? '1px solid #e5e7eb' : 'none'
                                    }}
                                >
                                    <Text fontSize="sm" fontWeight="bold">
                                        {activity.type}
                                    </Text>
                                    <Text fontSize="sm" opacity={0.7}>
                                        {activity.description}
                                    </Text>
                                    <Text fontSize="xs" opacity={0.5} mt="sm">
                                        {activity.timestamp}
                                    </Text>
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Quick Actions */}
            <Box mt="xxl">
                <H5 mb="lg">Acciones Rápidas</H5>
                <Box
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '15px'
                    }}
                >
                    <QuickActionButton
                        label="Ver Usuarios"
                        icon="👤"
                        href="/admin/resources/User"
                    />
                    <QuickActionButton
                        label="Ver Grupos"
                        icon="👥"
                        href="/admin/resources/Group"
                    />
                    <QuickActionButton
                        label="Ver Posts"
                        icon="📝"
                        href="/admin/resources/Post"
                    />
                    <QuickActionButton
                        label="Configuración"
                        icon="⚙️"
                        href="/admin/settings"
                    />
                </Box>
            </Box>
        </Box>
    );
};

/**
 * Componente reutilizable para tarjetas de estadísticas
 */
const StatsCard = ({ title, value, subtitle, icon, color }) => (
    <Box
        bg="white"
        border="default"
        borderRadius="default"
        p="lg"
        style={{
            borderLeft: `4px solid ${color}`,
            transition: 'transform 0.2s',
            cursor: 'default'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
        <Box flex alignItems="center" justifyContent="space-between" mb="default">
            <Text fontSize="sm" opacity={0.7} fontWeight="bold">
                {title}
            </Text>
            <span style={{ fontSize: '24px' }}>{icon}</span>
        </Box>
        <H2 mb="sm" style={{ color }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
        </H2>
        <Text fontSize="sm" opacity={0.5}>
            {subtitle}
        </Text>
    </Box>
);

/**
 * Botón de acción rápida
 */
const QuickActionButton = ({ label, icon, href }) => (
    <a
        href={href}
        style={{
            textDecoration: 'none',
            display: 'block'
        }}
    >
        <Box
            bg="grey20"
            borderRadius="default"
            p="default"
            flex
            alignItems="center"
            style={{
                transition: 'all 0.2s',
                cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#6366f1';
                e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = 'inherit';
            }}
        >
            <span style={{ fontSize: '20px', marginRight: '10px' }}>{icon}</span>
            <Text fontWeight="bold">{label}</Text>
        </Box>
    </a>
);

export default Dashboard;
