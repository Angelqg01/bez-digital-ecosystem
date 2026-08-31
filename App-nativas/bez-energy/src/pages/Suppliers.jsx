import React from 'react'
import { Users, Search, Filter, ArrowUpRight } from 'lucide-react'

const Suppliers = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>Energy Suppliers</h1>
        <p style={{ color: 'var(--bez-text-sec)', marginTop: 8 }}>
          Manage and monitor external energy providers and P2P marketplace nodes.
        </p>
      </header>

      <section className="card">
        <div style={{ padding: 24, borderBottom: '1px solid var(--bez-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--bez-surface-2)', borderRadius: 12, border: '1px solid var(--bez-border)' }}>
              <Search size={14} color="var(--bez-text-muted)" />
              <input type="text" placeholder="Search suppliers..." style={{ background: 'none', border: 'none', color: 'white', fontSize: 13, outline: 'none' }} />
            </div>
            <button className="btn" style={{ background: 'var(--bez-surface-3)', border: '1px solid var(--bez-border)', fontSize: 12 }}>
              <Filter size={14} /> Filter
            </button>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }}>Connect New Node</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--bez-border)', background: 'var(--bez-surface-high)' }}>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>SUPPLIER</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>TYPE</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>REPUTATION</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>LAST YIELD</th>
                <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              <SupplierRow name="SolarFarm Alpha" type="Industrial Solar" rep="99/100" yield="42.5 kWh" status="Active" color="var(--bez-solar)" />
              <SupplierRow name="P2P Node #284" type="Residential P2P" rep="85/100" yield="4.2 kWh" status="Active" color="var(--bez-secondary)" />
              <SupplierRow name="WindCentral Ltd" type="Offshore Wind" rep="94/100" yield="156.0 kWh" status="Maintenance" color="var(--bez-wind)" />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const SupplierRow = ({ name, type, rep, yield: yieldVal, status, color }) => (
  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
    <td style={{ padding: 16 }}>
      <div style={{ fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>{type}</div>
    </td>
    <td style={{ padding: 16 }}>{type}</td>
    <td style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 40, height: 4, background: 'var(--bez-surface-3)', borderRadius: 2 }}>
          <div style={{ width: rep.split('/')[0] + '%', height: '100%', background: 'var(--bez-reputation)' }}></div>
        </div>
        {rep}
      </div>
    </td>
    <td style={{ padding: 16, fontFamily: 'monospace' }}>{yieldVal}</td>
    <td style={{ padding: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: status === 'Active' ? 'var(--bez-secondary)' : 'var(--bez-solar)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 }}>
        {status}
      </span>
    </td>
  </tr>
)

export default Suppliers
