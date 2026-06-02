/**
 * BeZhas VIP Panel - Complete System
 * Sistema completo de membresías VIP con beneficios y recompensas
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getBeZhasSDK } from '../../../sdk/bezhas-enterprise-sdk';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    Button,
    Chip,
    LinearProgress,
    Divider,
    Tab,
    Tabs,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Avatar
} from '@mui/material';
import {
    Diamond,
    Star,
    LocalShipping,
    Support,
    EarlyAccess,
    CardGiftcard,
    TrendingUp,
    Verified,
    Hotel,
    Flight,
    ShoppingCart,
    CheckCircle
} from '@mui/icons-material';
import './VIPPanel.css';

const VIPPanel = () => {
    const { user } = useAuth();
    const [vipStatus, setVipStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const [selectedTier, setSelectedTier] = useState(null);
    const [savings, setSavings] = useState(null);

    const sdk = getBeZhasSDK();

    useEffect(() => {
        loadVIPStatus();
        loadSavings();
    }, []);

    const loadVIPStatus = async () => {
        try {
            setLoading(true);
            const status = await sdk.vip.getStatus();
            if (status.success) {
                setVipStatus(status);
            }
        } catch (error) {
            console.error('Error loading VIP status:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSavings = async () => {
        try {
            const savingsData = await sdk.vip.getSavingsHistory();
            if (savingsData.success) {
                setSavings(savingsData);
            }
        } catch (error) {
            console.error('Error loading savings:', error);
        }
    };

    const handleUpgrade = async (tier) => {
        try {
            const result = await sdk.vip.subscribe({
                tier: tier,
                duration: 12,
                paymentMethod: 'stripe',
                autoRenew: true
            });

            if (result.success) {
                await loadVIPStatus();
                setShowUpgradeDialog(false);
                alert('¡Bienvenido al nivel VIP ' + tier.toUpperCase() + '!');
            }
        } catch (error) {
            console.error('Error upgrading:', error);
            alert('Error al actualizar membresía');
        }
    };

    const VIPTierCard = ({ tier, benefits, isCurrentTier }) => {
        const tierColors = {
            bronze: '#CD7F32',
            silver: '#C0C0C0',
            gold: '#FFD700',
            platinum: '#E5E4E2'
        };

        const tierIcons = {
            bronze: '🥉',
            silver: '🥈',
            gold: '🥇',
            platinum: '💎'
        };

        return (
            <Card
                className={`vip-tier-card ${isCurrentTier ? 'current-tier' : ''}`}
                sx={{
                    border: isCurrentTier ? `3px solid ${tierColors[tier]}` : '1px solid #ddd',
                    position: 'relative',
                    '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: 6
                    },
                    transition: 'all 0.3s'
                }}
            >
                {isCurrentTier && (
                    <Chip
                        label="TU PLAN ACTUAL"
                        color="primary"
                        size="small"
                        sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            fontWeight: 'bold'
                        }}
                    />
                )}

                <CardContent>
                    <Box textAlign="center" mb={3}>
                        <Typography variant="h1" sx={{ fontSize: '60px', mb: 1 }}>
                            {tierIcons[tier]}
                        </Typography>
                        <Typography
                            variant="h4"
                            fontWeight="bold"
                            sx={{ color: tierColors[tier], textTransform: 'uppercase' }}
                        >
                            {tier}
                        </Typography>
                        <Typography variant="h5" color="primary" fontWeight="bold" mt={2}>
                            €{benefits.monthlyPrice}/mes
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <ShoppingCart sx={{ color: tierColors[tier] }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={`${benefits.discount}% descuento en compras`}
                                primaryTypographyProps={{ fontWeight: 'bold' }}
                            />
                        </ListItem>

                        <ListItem>
                            <ListItemIcon>
                                <LocalShipping sx={{ color: tierColors[tier] }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={`${benefits.shippingDiscount}% descuento en envíos`}
                                secondary={
                                    benefits.freeShipping !== 'none' &&
                                    `Envío gratis ${benefits.freeShipping}`
                                }
                            />
                        </ListItem>

                        {benefits.prioritySupport && (
                            <ListItem>
                                <ListItemIcon>
                                    <Support sx={{ color: tierColors[tier] }} />
                                </ListItemIcon>
                                <ListItemText primary="Soporte prioritario 24/7" />
                            </ListItem>
                        )}

                        {benefits.earlyAccess && (
                            <ListItem>
                                <ListItemIcon>
                                    <EarlyAccess sx={{ color: tierColors[tier] }} />
                                </ListItemIcon>
                                <ListItemText primary="Acceso anticipado" />
                            </ListItem>
                        )}

                        {benefits.nftBonus > 0 && (
                            <ListItem>
                                <ListItemIcon>
                                    <TrendingUp sx={{ color: tierColors[tier] }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={`+${benefits.nftBonus}% bonus BEZ-Coin`}
                                />
                            </ListItem>
                        )}

                        {benefits.concierge && (
                            <ListItem>
                                <ListItemIcon>
                                    <Star sx={{ color: tierColors[tier] }} />
                                </ListItemIcon>
                                <ListItemText primary="Servicio Concierge" />
                            </ListItem>
                        )}

                        {benefits.loungeAccess && (
                            <ListItem>
                                <ListItemIcon>
                                    <Hotel sx={{ color: tierColors[tier] }} />
                                </ListItemIcon>
                                <ListItemText primary="Acceso a Lounges VIP" />
                            </ListItem>
                        )}

                        {benefits.personalShopper && (
                            <ListItem>
                                <ListItemIcon>
                                    <Diamond sx={{ color: tierColors[tier] }} />
                                </ListItemIcon>
                                <ListItemText primary="Personal Shopper" />
                            </ListItem>
                        )}

                        {benefits.exclusiveEvents && (
                            <ListItem>
                                <ListItemIcon>
                                    <CardGiftcard sx={{ color: tierColors[tier] }} />
                                </ListItemIcon>
                                <ListItemText primary="Eventos Exclusivos" />
                            </ListItem>
                        )}
                    </List>

                    <Box mt={3}>
                        {!isCurrentTier ? (
                            <Button
                                variant="contained"
                                fullWidth
                                size="large"
                                onClick={() => {
                                    setSelectedTier(tier);
                                    setShowUpgradeDialog(true);
                                }}
                                sx={{
                                    backgroundColor: tierColors[tier],
                                    '&:hover': {
                                        backgroundColor: tierColors[tier],
                                        filter: 'brightness(1.2)'
                                    }
                                }}
                            >
                                {vipStatus?.tier ? 'Mejorar a ' : 'Suscribirse a '}{tier.toUpperCase()}
                            </Button>
                        ) : (
                            <Button
                                variant="outlined"
                                fullWidth
                                size="large"
                                disabled
                                startIcon={<CheckCircle />}
                            >
                                Plan Actual
                            </Button>
                        )}
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const BenefitsOverview = () => (
        <Box>
            <Typography variant="h5" fontWeight="bold" mb={3}>
                Resumen de Beneficios
            </Typography>

            {vipStatus?.isActive ? (
                <>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" mb={2}>
                                        <TrendingUp sx={{ fontSize: 40, color: '#4caf50', mr: 2 }} />
                                        <Box>
                                            <Typography variant="h4" fontWeight="bold" color="primary">
                                                €{savings?.totalSavings?.toFixed(2) || '0.00'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Ahorro Total
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={75}
                                        sx={{ height: 8, borderRadius: 5 }}
                                    />
                                    <Typography variant="caption" color="text.secondary" mt={1}>
                                        Tu membresía ya se ha pagado sola
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" mb={2}>
                                        <Diamond sx={{ fontSize: 40, color: '#FFD700', mr: 2 }} />
                                        <Box>
                                            <Typography variant="h4" fontWeight="bold" color="primary">
                                                {vipStatus.benefits?.discount}%
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Descuento Activo
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Typography variant="body2">
                                        + {vipStatus.benefits?.shippingDiscount}% en envíos
                                    </Typography>
                                    <Typography variant="body2">
                                        + {vipStatus.benefits?.nftBonus}% bonus BEZ-Coin
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" fontWeight="bold" mb={2}>
                                        Desglose de Ahorros Mensuales
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {savings?.savingsByCategory && Object.entries(savings.savingsByCategory).map(([category, amount]) => (
                                            <Grid item xs={6} md={3} key={category}>
                                                <Box textAlign="center" p={2} bgcolor="#f5f5f5" borderRadius={2}>
                                                    <Typography variant="h6" color="primary" fontWeight="bold">
                                                        €{amount.toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {category}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" fontWeight="bold" mb={2}>
                                        Tu Badge NFT Exclusivo
                                    </Typography>
                                    <Box display="flex" alignItems="center">
                                        <Avatar
                                            sx={{
                                                width: 100,
                                                height: 100,
                                                bgcolor: vipStatus.tier === 'platinum' ? '#E5E4E2' :
                                                    vipStatus.tier === 'gold' ? '#FFD700' :
                                                        vipStatus.tier === 'silver' ? '#C0C0C0' : '#CD7F32',
                                                fontSize: 50
                                            }}
                                        >
                                            {vipStatus.tier === 'platinum' ? '💎' :
                                                vipStatus.tier === 'gold' ? '🥇' :
                                                    vipStatus.tier === 'silver' ? '🥈' : '🥉'}
                                        </Avatar>
                                        <Box ml={3}>
                                            <Typography variant="h6" fontWeight="bold">
                                                {vipStatus.tier.toUpperCase()} Member Badge
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" mb={1}>
                                                NFT ID: {vipStatus.nftBadge || 'Generando...'}
                                            </Typography>
                                            <Chip
                                                label="Verificado en Blockchain"
                                                icon={<Verified />}
                                                color="success"
                                                size="small"
                                            />
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </>
            ) : (
                <Alert severity="info">
                    No tienes una membresía VIP activa. ¡Suscríbete ahora y empieza a ahorrar!
                </Alert>
            )}
        </Box>
    );

    const ExclusivePerks = () => (
        <Box>
            <Typography variant="h5" fontWeight="bold" mb={3}>
                Beneficios Exclusivos
            </Typography>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <Hotel sx={{ fontSize: 40, color: '#2196f3', mr: 2 }} />
                                <Typography variant="h6" fontWeight="bold">
                                    Descuentos en Hoteles
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Hasta 30% de descuento en cadenas premium
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="Marriott Hotels - 25% OFF" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Hilton Hotels - 20% OFF" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Barceló Hotels - 30% OFF" />
                                </ListItem>
                            </List>
                            <Button variant="outlined" fullWidth>
                                Ver Ofertas
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <Flight sx={{ fontSize: 40, color: '#ff9800', mr: 2 }} />
                                <Typography variant="h6" fontWeight="bold">
                                    Viajes y Vuelos
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Acceso a tarifas exclusivas
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="Priority Boarding" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Lounge Access" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Extra Baggage" />
                                </ListItem>
                            </List>
                            <Button variant="outlined" fullWidth>
                                Explorar
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" mb={2}>
                                Próximos Eventos Exclusivos
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                    <Box p={2} bgcolor="#f5f5f5" borderRadius={2}>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            BeZhas Gala 2026
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            15 de Febrero, Madrid
                                        </Typography>
                                        <Button size="small" sx={{ mt: 1 }}>
                                            Más Info
                                        </Button>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box p={2} bgcolor="#f5f5f5" borderRadius={2}>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            VIP Shopping Night
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            1 de Marzo, Barcelona
                                        </Typography>
                                        <Button size="small" sx={{ mt: 1 }}>
                                            Más Info
                                        </Button>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box p={2} bgcolor="#f5f5f5" borderRadius={2}>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            NFT Art Exhibition
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            20 de Marzo, Valencia
                                        </Typography>
                                        <Button size="small" sx={{ mt: 1 }}>
                                            Más Info
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <LinearProgress />
                <Typography align="center" sx={{ mt: 2 }}>
                    Cargando información VIP...
                </Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box mb={4}>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                    BeZhas VIP
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Desbloquea beneficios exclusivos y ahorra en cada compra
                </Typography>
            </Box>

            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 4 }}>
                <Tab label="Planes VIP" />
                <Tab label="Mis Beneficios" />
                <Tab label="Ventajas Exclusivas" />
            </Tabs>

            {activeTab === 0 && (
                <Grid container spacing={3}>
                    {['bronze', 'silver', 'gold', 'platinum'].map(async (tier) => {
                        const benefits = await sdk.vip.getBenefits(tier);
                        return (
                            <Grid item xs={12} md={6} lg={3} key={tier}>
                                <VIPTierCard
                                    tier={tier}
                                    benefits={benefits.benefits}
                                    isCurrentTier={vipStatus?.tier === tier}
                                />
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {activeTab === 1 && <BenefitsOverview />}
            {activeTab === 2 && <ExclusivePerks />}

            {/* Upgrade Dialog */}
            <Dialog
                open={showUpgradeDialog}
                onClose={() => setShowUpgradeDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Mejorar a {selectedTier?.toUpperCase()}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" gutterBottom>
                        ¿Estás seguro de que quieres mejorar tu membresía a {selectedTier?.toUpperCase()}?
                    </Typography>
                    <Alert severity="info" sx={{ mt: 2 }}>
                        Se aplicará un cargo prorrateado basado en tu suscripción actual.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowUpgradeDialog(false)}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => handleUpgrade(selectedTier)}
                    >
                        Confirmar Mejora
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default VIPPanel;
