import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  ArrowRight,
  Activity,
  AlertTriangle,
  PackageCheck,
  TrendingUp,
  BarChart3,
  Eye,
  ExternalLink
} from 'lucide-react'
import { getAnalytics } from '../api'
import { useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true)
      try {
        const data = await getAnalytics('30d')
        setAnalytics(data)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <p className="text-label-sm text-bz-primary mb-2 font-bold uppercase tracking-wider">Oracle Inspector Dashboard</p>
        <h1 className="text-4xl font-bold mb-2">Operations Overview</h1>
        <p className="text-body-md text-bz-text-muted">Real-time food supply chain monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card glass"
        >
          <Activity size={20} className="text-bz-neon mb-3" />
          <h3 className="text-3xl font-bold mb-1">{analytics?.total_scans || 0}</h3>
          <p className="text-label-sm text-bz-text-muted font-bold uppercase tracking-wider">Total Scans</p>
          <div className="mt-3 flex items-center gap-1 text-bz-neon text-label-sm font-bold">
            <TrendingUp size={14} />
            +12% this month
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card glass"
        >
          <ShieldCheck size={20} className="text-bz-primary mb-3" />
          <h3 className="text-3xl font-bold mb-1">{analytics?.accuracy_rate || 0}%</h3>
          <p className="text-label-sm text-bz-text-muted font-bold uppercase tracking-wider">Accuracy Rate</p>
          <div className="mt-3 flex items-center gap-1 text-bz-primary text-label-sm font-bold">
            <Eye size={14} />
            Ultra-reliable
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card glass"
        >
          <PackageCheck size={20} className="text-bz-emerald mb-3" />
          <h3 className="text-3xl font-bold text-bz-emerald mb-1">{analytics?.verified_batches || 0}</h3>
          <p className="text-label-sm text-bz-text-muted font-bold uppercase tracking-wider">Verified Batches</p>
          <div className="mt-3 flex items-center gap-1 text-bz-emerald text-label-sm font-bold">
            <ShieldCheck size={14} />
            On-chain confirmed
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card glass"
        >
          <BarChart3 size={20} className="text-bz-amber mb-3" />
          <h3 className="text-3xl font-bold text-bz-amber mb-1">{analytics?.risk_detected || 0}</h3>
          <p className="text-label-sm text-bz-text-muted font-bold uppercase tracking-wider">Risk Alerts</p>
          <div className="mt-3 text-label-sm font-bold">
            {analytics?.pending_review || 0} pending
          </div>
        </motion.div>
      </div>

      {/* Recent Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-8"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-title-lg font-bold">Recent Anomaly Events</h2>
          <a href="#" className="text-label-sm text-bz-primary font-bold hover:text-bz-primary-alt transition-colors">
            VIEW ALL
          </a>
        </div>

        <div className="card glass border-l-4 border-l-red-500">
          <div className="flex gap-4">
            <AlertTriangle size={24} className="text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-label-lg font-bold mb-1">Fungal Risk Detected: ID-402</h4>
              <p className="text-body-sm text-bz-text-muted mb-3">
                Gemini detected signatures of Botrytis in Batch 402. Payment halted on-chain pending review.
              </p>
              <div className="flex gap-2">
                <button className="text-label-sm text-bz-primary font-bold hover:text-bz-primary-alt">
                  Review Details
                </button>
                <span className="text-bz-text-muted">·</span>
                <button className="text-label-sm text-bz-primary font-bold hover:text-bz-primary-alt">
                  View on Chain
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* RWA Manifests */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-8"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-title-lg font-bold">DPP Manifests (NFT)</h2>
          <span className="text-label-sm text-bz-text-muted font-bold">24 TOTAL</span>
        </div>

        <div className="space-y-3">
          <ManifestItem id="#8829-XP" product="Avocados - 180kg" status="Verified" date="2 mins ago" />
          <ManifestItem id="#8810-AB" product="Tomatoes - 120kg" status="Verified" date="1 hr ago" />
          <ManifestItem id="#8799-CC" product="Lettuce - 95kg" status="Pending" date="3 hrs ago" />
        </div>
      </motion.div>

      {/* System Health */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mb-8"
      >
        <h2 className="text-title-lg font-bold mb-4">System Health</h2>

        <div className="space-y-2">
          <HealthIndicator label="Edge AI Nodes" value="4/4 Active" status="healthy" />
          <HealthIndicator label="Blockchain Sync" value="Synchronized" status="healthy" />
          <HealthIndicator label="API Gateway" value="Online" status="healthy" />
          <HealthIndicator label="Database" value="99.9% Uptime" status="healthy" />
        </div>
      </motion.div>

      {/* Processing Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card glass mb-8"
      >
        <h3 className="text-title-md font-bold mb-4">Avg Processing Time</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-bz-neon">{analytics?.avg_processing_time || 0}</span>
          <span className="text-body-md text-bz-text-muted">seconds per scan</span>
        </div>
        <div className="mt-4 h-1 bg-bz-surface rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-bz-primary to-bz-neon" style={{ width: '85%' }} />
        </div>
        <p className="text-label-sm text-bz-text-muted mt-2">Optimization: -15% vs last month</p>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3">
        <button onClick={() => navigate('/storage')} className="btn btn-primary w-full justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp size={18} />
            View Analytics
          </span>
          <ArrowRight size={18} />
        </button>

        <button 
          onClick={() => {
            if (!analytics) return;
            const data = JSON.stringify(analytics, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
          }}
          className="btn btn-secondary w-full justify-start gap-2"
        >
          <ExternalLink size={18} />
          Export Report
        </button>
      </div>

      <div className="mt-8 p-4 rounded-xl bg-bz-primary/5 border border-bz-primary/20">
        <p className="text-label-sm text-bz-primary font-bold mb-2">💡 TIP</p>
        <p className="text-body-sm text-bz-text-muted">
          Set up automatic alerts for anomalies. Go to Settings → Notifications to configure thresholds.
        </p>
      </div>
    </div>
  )
}

const ManifestItem = ({ id, product, status, date }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="card glass hover:shadow-glow transition-all cursor-pointer"
  >
    <div className="flex justify-between items-start">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 bg-bz-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
          <PackageCheck size={20} className="text-bz-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-label-lg font-bold mb-1">{id}</p>
          <p className="text-body-sm text-bz-text-muted mb-1">{product}</p>
          <p className="text-label-sm text-bz-text-muted">{date}</p>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <span className={`status-badge ${status === 'Verified' ? 'verified' : 'pending'}`}>
          {status}
        </span>
        <ArrowRight size={16} className="mt-2 opacity-30 ml-auto" />
      </div>
    </div>
  </motion.div>
)

const HealthIndicator = ({ label, value, status }) => (
  <div className="flex items-center justify-between p-3 bg-bz-surface rounded-lg">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${status === 'healthy' ? 'bg-bz-neon' : 'bg-bz-amber'}`} />
      <span className="text-body-md text-bz-text-muted">{label}</span>
    </div>
    <span className={`font-bold ${status === 'healthy' ? 'text-bz-neon' : 'text-bz-amber'}`}>{value}</span>
  </div>
)

export default Dashboard

