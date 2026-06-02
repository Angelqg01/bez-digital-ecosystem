import React, { useState, useEffect } from 'react';
import { useQualityEscrow } from '../../hooks/useQualityEscrow';
import { useWeb3Context } from '../../context/Web3Context';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Badge } from '../ui/Badge';
import {
    Clock,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Plus,
    RefreshCw,
    Loader2,
    TrendingUp,
    TrendingDown,
    Info
} from 'lucide-react';

const StatCard = ({ value, label, loading, trend }) => (
    <Card className="transition-all hover:shadow-lg hover:scale-105">
        <CardContent className="pt-6">
            {loading ? (
                <div className="space-y-2">
                    <div className="h-8 w-20 bg-gray-700 animate-pulse rounded"></div>
                    <div className="h-4 w-24 bg-gray-700 animate-pulse rounded"></div>
                </div>
            ) : (
                <>
                    <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-bold">{value}</div>
                        {trend && (
                            <div className={`text-xs flex items-center gap-1 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(trend)}%
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                </>
            )}
        </CardContent>
    </Card>
);

const QualityEscrowManager = () => {
    const { address, isConnected } = useWeb3Context();
    const {
        createService,
        finalizeService,
        raiseDispute,
        loadUserServices,
        getStats,
        services,
        loading,
        isConfigured
    } = useQualityEscrow();

    // Form state for creating service
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [clientWallet, setClientWallet] = useState('');
    const [collateralAmount, setCollateralAmount] = useState('');
    const [initialQuality, setInitialQuality] = useState(80);

    // Form state for finalizing service
    const [finalizeServiceId, setFinalizeServiceId] = useState('');
    const [finalQuality, setFinalQuality] = useState(80);

    // Stats and UI state
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isConnected && isConfigured) {
            loadStats();
        }
    }, [isConnected, isConfigured, services]);

    const loadStats = async () => {
        try {
            setLoadingStats(true);
            setError(null);
            const statsData = await getStats();
            setStats(statsData);
        } catch (err) {
            setError('Failed to load statistics');
            console.error('Error loading stats:', err);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleCreateService = async (e) => {
        e.preventDefault();
        try {
            setError(null);
            const serviceId = await createService(clientWallet, collateralAmount, initialQuality);
            if (serviceId) {
                setShowCreateForm(false);
                setClientWallet('');
                setCollateralAmount('');
                setInitialQuality(80);
            }
        } catch (err) {
            setError('Failed to create service: ' + err.message);
        }
    };

    const handleFinalizeService = async (serviceId) => {
        const success = await finalizeService(serviceId, finalQuality);
        if (success) {
            setFinalizeServiceId('');
            setFinalQuality(80);
        }
    };

    const handleRaiseDispute = async (serviceId) => {
        await raiseDispute(serviceId);
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'CREATED': { variant: 'secondary', icon: Clock, text: 'Created' },
            'IN_PROGRESS': { variant: 'default', icon: Clock, text: 'In Progress' },
            'COMPLETED': { variant: 'success', icon: CheckCircle, text: 'Completed' },
            'DISPUTED': { variant: 'destructive', icon: AlertCircle, text: 'Disputed' },
            'CANCELLED': { variant: 'outline', icon: AlertTriangle, text: 'Cancelled' }
        };

        const config = statusConfig[status] || statusConfig['CREATED'];
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {config.text}
            </Badge>
        );
    };

    if (!isConnected) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Quality Escrow Manager</CardTitle>
                    <CardDescription>Connect your wallet to manage quality escrow services</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Please connect your wallet to continue</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!isConfigured) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Quality Escrow Manager</CardTitle>
                    <CardDescription>Configuration Required</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                        <p className="text-muted-foreground">Quality Escrow system is not configured. Please contact an administrator.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Error Alert */}
            {error && (
                <Card className="border-red-500 bg-red-500/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-sm font-medium">{error}</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto"
                                onClick={() => setError(null)}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatCard value={stats?.totalServices || 0} label="Total Services" loading={loadingStats} trend={5} />
                <StatCard value={stats?.userServices || 0} label="Your Services" loading={loadingStats} />
                <StatCard value={stats?.activeServices || 0} label="Active" loading={loadingStats} />
                <StatCard value={stats?.completedServices || 0} label="Completed" loading={loadingStats} trend={12} />
                <StatCard value={stats?.disputedServices || 0} label="Disputed" loading={loadingStats} />
            </div>

            {/* Create Service Card */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Quality Escrow Services</CardTitle>
                            <CardDescription>Create and manage quality-guaranteed services</CardDescription>
                        </div>
                        <Button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            variant={showCreateForm ? "outline" : "default"}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {showCreateForm ? 'Cancel' : 'New Service'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {showCreateForm && (
                        <form onSubmit={handleCreateService} className="space-y-4 mb-6 p-4 border rounded-lg bg-gray-800/50 backdrop-blur-sm">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="clientWallet">Client Wallet Address</Label>
                                    <div className="group relative">
                                        <Info className="w-4 h-4 text-gray-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-xs rounded shadow-lg z-10">
                                            The wallet address of the client receiving the service
                                        </div>
                                    </div>
                                </div>
                                <Input
                                    id="clientWallet"
                                    type="text"
                                    placeholder="0x..."
                                    value={clientWallet}
                                    onChange={(e) => setClientWallet(e.target.value)}
                                    className="transition-all focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="collateralAmount">Collateral Amount (BEZ)</Label>
                                    <div className="group relative">
                                        <Info className="w-4 h-4 text-gray-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-xs rounded shadow-lg z-10">
                                            Amount of BEZ tokens locked as collateral. Will be returned based on quality score.
                                        </div>
                                    </div>
                                </div>
                                <Input
                                    id="collateralAmount"
                                    type="number"
                                    step="0.01"
                                    placeholder="100"
                                    value={collateralAmount}
                                    onChange={(e) => setCollateralAmount(e.target.value)}
                                    className="transition-all focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="initialQuality">Initial Quality Score</Label>
                                        <div className="group relative">
                                            <Info className="w-4 h-4 text-gray-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-xs rounded shadow-lg z-10">
                                                Expected quality level for this service (1-100%)
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-bold text-blue-400">{initialQuality}%</span>
                                </div>
                                <input
                                    id="initialQuality"
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={initialQuality}
                                    onChange={(e) => setInitialQuality(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>1%</span>
                                    <span>50%</span>
                                    <span>100%</span>
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full transition-all hover:scale-105">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Service
                                    </>
                                )}
                            </Button>
                        </form>
                    )}

                    {/* Services List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Your Services</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadUserServices}
                                disabled={loading}
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>

                        {services.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                                    <Clock className="w-8 h-8 text-gray-600" />
                                </div>
                                <p className="text-lg font-medium">No services found</p>
                                <p className="text-sm mt-2">Create your first quality escrow service to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {services.map((service) => (
                                    <Card key={service.id} className="transition-all hover:shadow-lg hover:border-blue-500/50">
                                        <CardContent className="pt-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="text-sm font-medium flex items-center gap-2">
                                                        Service #{service.id}
                                                        {service.status === 'COMPLETED' && service.finalQuality >= 90 && (
                                                            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                                                                High Quality
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {service.timestamp.toLocaleDateString()}
                                                    </p>
                                                </div>
                                                {getStatusBadge(service.status)}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                <div>
                                                    <p className="text-muted-foreground">Collateral</p>
                                                    <p className="font-medium">{service.collateralAmount} BEZ</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Initial Quality</p>
                                                    <p className="font-medium">{service.initialQuality}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Final Quality</p>
                                                    <p className="font-medium">
                                                        {service.finalQuality > 0 ? `${service.finalQuality}%` : 'Pending'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Your Role</p>
                                                    <p className="font-medium">
                                                        {service.businessWallet.toLowerCase() === address.toLowerCase()
                                                            ? 'Business'
                                                            : 'Client'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {service.status === 'IN_PROGRESS' &&
                                                service.businessWallet.toLowerCase() === address.toLowerCase() && (
                                                    <div className="space-y-2">
                                                        <div className="flex gap-2 items-end">
                                                            <div className="flex-1">
                                                                <Label htmlFor={`finalQuality-${service.id}`}>
                                                                    Final Quality: {finalizeServiceId === service.id ? finalQuality : 80}%
                                                                </Label>
                                                                {finalizeServiceId === service.id && (
                                                                    <input
                                                                        id={`finalQuality-${service.id}`}
                                                                        type="range"
                                                                        min="1"
                                                                        max="100"
                                                                        value={finalQuality}
                                                                        onChange={(e) => setFinalQuality(Number(e.target.value))}
                                                                        className="w-full"
                                                                    />
                                                                )}
                                                            </div>
                                                            <Button
                                                                onClick={() => {
                                                                    if (finalizeServiceId === service.id) {
                                                                        handleFinalizeService(service.id);
                                                                    } else {
                                                                        setFinalizeServiceId(service.id);
                                                                    }
                                                                }}
                                                                disabled={loading}
                                                                size="sm"
                                                            >
                                                                {finalizeServiceId === service.id ? 'Confirm' : 'Finalize'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}

                                            {service.status === 'IN_PROGRESS' &&
                                                service.clientWallet.toLowerCase() === address.toLowerCase() && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleRaiseDispute(service.id)}
                                                        disabled={loading}
                                                    >
                                                        <AlertCircle className="w-4 h-4 mr-2" />
                                                        Raise Dispute
                                                    </Button>
                                                )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default QualityEscrowManager;
