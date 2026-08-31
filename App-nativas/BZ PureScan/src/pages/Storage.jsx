import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Package,
    ChevronRight,
    Filter,
    Search,
    Trash2,
    MoreVertical,
    TrendingUp,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'
import { getInventory } from '../api'

const Storage = () => {
    const [inventory, setInventory] = useState([])
    const [filteredInventory, setFilteredInventory] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedFilter, setSelectedFilter] = useState('all')

    useEffect(() => {
        const loadInventory = async () => {
            setLoading(true)
            try {
                const data = await getInventory()
                setInventory(data)
                applyFilter(data, 'all', searchQuery)
            } finally {
                setLoading(false)
            }
        }

        loadInventory()
    }, [])

    useEffect(() => {
        applyFilter(inventory, selectedFilter, searchQuery)
    }, [selectedFilter, searchQuery, inventory])

    const applyFilter = (data, filter, search) => {
        let filtered = data

        // Filter by status
        if (filter !== 'all') {
            filtered = filtered.filter(item => item.status === filter)
        }

        // Search by product or SKU
        if (search) {
            filtered = filtered.filter(item =>
                item.product.toLowerCase().includes(search.toLowerCase()) ||
                item.sku.toLowerCase().includes(search.toLowerCase())
            )
        }

        setFilteredInventory(filtered)
    }

    const handleExport = () => {
        if (!inventory || inventory.length === 0) return
        
        const headers = "ID,SKU,Producto,Cantidad,Estado,Lote,Ultimo Escaneo\n"
        const rows = inventory.map(item => 
            `${item.id},${item.sku},${item.product},${item.quantity},${item.status},${item.batch},${item.last_scan}`
        ).join("\n")
        
        const blob = new Blob([headers + rows], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
    }

    const handleClearVerified = () => {
        setInventory(prev => prev.filter(item => item.status !== 'verified'))
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'verified':
                return 'verified'
            case 'pending':
                return 'pending'
            case 'warning':
                return 'error'
            default:
                return 'processing'
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'verified':
                return <CheckCircle2 size={16} />
            case 'pending':
                return <Package size={16} />
            case 'warning':
                return <AlertCircle size={16} />
            default:
                return <TrendingUp size={16} />
        }
    }

    return (
        <div className="px-4 py-6">
            {/* Header */}
            <div className="mb-8">
                <p className="text-label-sm text-bz-primary mb-2">INVENTORY MANAGEMENT</p>
                <h1 className="text-4xl font-bold mb-2">Storage</h1>
                <p className="text-body-md text-bz-text-muted">
                    {filteredInventory.length} of {inventory.length} items
                </p>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex gap-2 mb-6">
                <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-text-muted" />
                    <input
                        type="text"
                        placeholder="Search by product or SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field w-full pl-10 text-sm"
                    />
                </div>
                <button className="btn btn-secondary px-4 py-3 gap-2">
                    <Filter size={18} />
                    <span className="text-label-sm">Filter</span>
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {['all', 'verified', 'pending', 'warning'].map(status => (
                    <button
                        key={status}
                        onClick={() => setSelectedFilter(status)}
                        className={`px-4 py-2 rounded-full text-label-sm font-bold uppercase whitespace-nowrap transition-all ${selectedFilter === status
                                ? 'bg-bz-primary text-white'
                                : 'bg-bz-surface text-bz-text-muted hover:bg-bz-surface-2'
                            }`}
                    >
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="card glass">
                    <p className="text-label-sm text-bz-text-muted mb-2">VERIFIED</p>
                    <p className="text-2xl font-bold text-bz-neon">
                        {inventory.filter(i => i.status === 'verified').length}
                    </p>
                </div>
                <div className="card glass">
                    <p className="text-label-sm text-bz-text-muted mb-2">TOTAL QTY</p>
                    <p className="text-2xl font-bold text-bz-primary">
                        {inventory.reduce((sum, i) => sum + i.quantity, 0)}
                    </p>
                </div>
            </div>

            {/* Inventory List */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="card glass animate-pulse h-20" />
                    ))}
                </div>
            ) : filteredInventory.length === 0 ? (
                <div className="card glass text-center py-8">
                    <Package size={32} className="mx-auto mb-3 text-bz-text-muted opacity-50" />
                    <p className="text-bz-text-muted">No items found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence>
                        {filteredInventory.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <InventoryItem item={item} statusColor={getStatusColor(item.status)} statusIcon={getStatusIcon(item.status)} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Quick Actions */}
            {filteredInventory.length > 0 && (
                <div className="mt-8 mb-4 space-y-2">
                    <button onClick={handleExport} className="btn btn-primary w-full gap-2">
                        <TrendingUp size={18} />
                        Export Inventory Report
                    </button>
                    <button onClick={handleClearVerified} className="btn btn-secondary w-full gap-2">
                        <Trash2 size={18} />
                        Clear Verified Items
                    </button>
                </div>
            )}
        </div>
    )
}

const InventoryItem = ({ item, statusColor, statusIcon }) => (
    <div className="card glass hover:shadow-glow transition-all cursor-pointer group">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 bg-bz-primary/20 rounded-xl flex items-center justify-center group-hover:bg-bz-primary/30 transition-colors">
                    <Package size={20} className="text-bz-primary" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-bz-text truncate">{item.product}</p>
                        <span className={`status-badge ${statusColor} text-xs`}>
                            {statusIcon}
                            {item.status}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-label-sm text-bz-text-muted">
                        <span>{item.sku}</span>
                        <span className="text-bz-primary font-bold">{item.quantity} units</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="text-right">
                    <p className="text-label-sm text-bz-text-muted">Last scan</p>
                    <p className="text-body-sm font-bold">
                        {new Date(item.last_scan).toLocaleDateString()}
                    </p>
                </div>
                <button className="p-2 hover:bg-bz-surface rounded-lg transition-colors">
                    <MoreVertical size={16} className="text-bz-text-muted" />
                </button>
            </div>
        </div>
    </div>
)

export default Storage
