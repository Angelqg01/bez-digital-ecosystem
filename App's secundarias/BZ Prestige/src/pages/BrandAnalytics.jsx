import React from 'react'
import { BarChart3, TrendingUp, DollarSign, Activity } from 'lucide-react'

const BrandAnalytics = () => {
  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Brand Treasury</h2>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Panel de control de ingresos generados automáticamente en el mercado secundario (EIP-2981).
        </p>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16, background: '#080808' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
             <DollarSign size={16} color="var(--bz-primary)" />
             <span style={{ fontSize: 10, color: 'var(--bz-secondary)', fontWeight: 800 }}>+12.4%</span>
           </div>
           <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Royalties Mensuales</p>
           <h3 style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Space Grotesk', marginTop: 4 }}>$245,600</h3>
        </div>
        
        <div className="card" style={{ padding: 16, background: '#080808' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
             <TrendingUp size={16} color="#a855f7" />
             <span style={{ fontSize: 10, color: 'var(--bz-secondary)', fontWeight: 800 }}>+8.2%</span>
           </div>
           <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>Volumen Secundario</p>
           <h3 style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Space Grotesk', marginTop: 4 }}>$4.9M</h3>
        </div>
      </div>

      {/* Analytics Chart Placeholder */}
      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bz-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Secondary Market Activity</h3>
          <Activity size={14} color="var(--bz-text-muted)" />
        </div>
        <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '20px 20px 0', borderBottom: '1px solid var(--bz-border)' }}>
          {/* Mock Bars */}
          {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
            <div key={i} style={{ flex: 1, background: i === 5 ? 'var(--bz-primary)' : '#222', height: `${h}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, position: 'relative' }}>
               {i === 5 && <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 800, color: 'var(--bz-primary)' }}>MAX</div>}
            </div>
          ))}
        </div>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--bz-text-muted)', fontWeight: 800 }}>
          <span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span><span>DOM</span>
        </div>
      </div>

      {/* Recent Royalties Stream */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Live Royalty Stream</h3>
        <div className="card" style={{ padding: 0 }}>
          <TransactionItem item="Rolex Daytona" id="9A8B7C" amount="$1,625.00" time="2 min ago" />
          <TransactionItem item="LV Keepall 55" id="3F2E1D" amount="$120.00" time="14 min ago" />
          <TransactionItem item="Patek Nautilus" id="7B8C9D" amount="$4,500.00" time="1 hr ago" />
        </div>
      </div>
    </div>
  )
}

const TransactionItem = ({ item, id, amount, time }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--bz-border)' }}>
    <div>
      <p style={{ fontSize: 12, fontWeight: 800 }}>{item}</p>
      <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>ID: {id}</p>
    </div>
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 12, fontWeight: 900, color: 'var(--bz-primary)' }}>+{amount}</p>
      <p style={{ fontSize: 9, color: 'var(--bz-text-muted)', marginTop: 2 }}>{time}</p>
    </div>
  </div>
)

export default BrandAnalytics
