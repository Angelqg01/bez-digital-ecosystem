import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Wallet as WalletIcon, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Database, 
  ShieldCheck, 
  Zap, 
  Flame, 
  Vote, 
  LayoutList,
  Factory,
  Wind,
  Sun,
  Leaf,
  Plus
} from 'lucide-react'
import { getWalletStats, buyEnergyCredit } from '../api'

const EnergyWallet = () => {
  const [stats, setStats] = useState(null)
  const [isBuying, setIsBuying] = useState(false)
  const [purchaseAmount, setPurchaseAmount] = useState(100)

  useEffect(() => {
    const fetch = async () => {
      // Mocked stats when API is not fully reachable
      try {
        const data = await getWalletStats()
        if (data && !data.error) {
          setStats({
            balance: parseFloat(data.balance) || 4892.50,
            yield: data.yieldPercentage || '+12.4',
            nodeRep: data.reputation || 98,
            staking: { principal: 50000, rewards: 1200 },
            rwa: [
              { name: 'Solar Array Alpha', fraction: 0.05, value: 12500 },
              { name: 'Wind Turbine V1', fraction: 0.02, value: 8400 }
            ],
            burn: { total: 145020, rate: 0.01 }
          })
        } else {
          throw new Error("No data")
        }
      } catch (e) {
        console.error("API error, using mock data", e)
        setStats({
          balance: 4892.50,
          yield: '+12.4',
          nodeRep: 98,
          staking: { principal: 50000, rewards: 1200 },
          rwa: [
            { name: 'Solar Array Alpha', fraction: 0.05, value: 12500 },
            { name: 'Wind Turbine V1', fraction: 0.02, value: 8400 }
          ],
          burn: { total: 145020, rate: 0.01 }
        })
      }
    }
    fetch()
    const interval = setInterval(fetch, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleWeb3Purchase = async () => {
    setIsBuying(true)
    try {
      // Simulate Web3 transaction (e.g. MetaMask interaction)
      console.log('Requesting Web3 provider to send transaction...')
      await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate block mining time
      
      const mockTxHash = '0x' + Math.random().toString(16).slice(2, 42)
      const result = await buyEnergyCredit(purchaseAmount, mockTxHash)
      
      if (result.success) {
        setStats(prev => ({ ...prev, balance: result.newBalance }))
        alert(`Successfully purchased ${purchaseAmount} BZHS! TxHash: ${mockTxHash}`)
      }
    } catch (e) {
      alert('Transaction failed: ' + e.message)
    } finally {
      setIsBuying(false)
    }
  }

  if (!stats) return <div style={{ color: 'white', padding: 40 }}>Loading Wallet Assets...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* Hero Section */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
        
        {/* Balance Card */}
        <div className="card" style={{ gridColumn: 'span 7', padding: 32, background: 'var(--bez-surface)' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: 32, opacity: 0.05 }}>
            <WalletIcon size={160} />
          </div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
              TOTAL ECONOMIC SOVEREIGNTY
            </p>
            <h2 style={{ fontSize: 48, fontWeight: 800, marginBottom: 8 }}>$BEZ {stats.balance.toLocaleString()}</h2>
            <p style={{ fontSize: 24, fontWeight: 600, color: 'var(--bez-secondary)', fontFamily: 'monospace' }}>
              ≈ €{(stats.balance * 0.92).toLocaleString()} / ${(stats.balance * 1.08).toLocaleString()}
            </p>
            
            <div style={{ display: 'flex', gap: 16, marginTop: 40, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }}><ArrowDownLeft size={18} /> Receive</button>
              <button className="btn" style={{ background: 'var(--bez-surface-3)', border: '1px solid var(--bez-border)', fontSize: 13 }}><ArrowUpRight size={18} /> Transfer</button>
              <button className="btn" style={{ background: 'var(--bez-secondary)', color: 'var(--bez-bg)', fontSize: 13 }}><Database size={18} /> Stake Assets</button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', background: 'var(--bez-surface-2)', padding: '4px 8px 4px 16px', borderRadius: 24, border: '1px solid var(--bez-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Buy Credit:</span>
                <input 
                  type="number" 
                  value={purchaseAmount} 
                  onChange={(e) => setPurchaseAmount(Number(e.target.value))}
                  style={{ width: 60, background: 'transparent', border: 'none', color: 'white', fontFamily: 'monospace', fontSize: 14, outline: 'none' }} 
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleWeb3Purchase}
                  disabled={isBuying}
                  style={{ padding: '8px 16px', fontSize: 12, borderRadius: 20 }}
                >
                  {isBuying ? 'Mining...' : <><Plus size={14} /> Web3 Pay</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Node Performance */}
        <div className="card" style={{ gridColumn: 'span 5', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>NODE VALIDATION STATUS</p>
                <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--bez-secondary)' }}>Synchronized</h3>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bez-secondary)', border: '1px solid var(--bez-secondary)', padding: '4px 12px', borderRadius: 20 }}>REPUTATION: {stats.nodeRep}%</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatRow label="Staked Principal" val={`${stats.staking.principal.toLocaleString()} $BEZ`} />
              <StatRow label="Estimated APY" val={`${stats.yield}%`} color="var(--bez-secondary)" />
              <StatRow label="Next Epoch Payout" val="4.2 days" />
            </div>
          </div>
          
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--bez-border)' }}>
            <p style={{ fontSize: 10, color: 'var(--bez-text-muted)', fontWeight: 700 }}>CUMULATIVE REWARDS</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--bez-primary-light)' }}>{stats.staking.rewards.toLocaleString()}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--bez-primary-light)' }}>$BEZ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        
        {/* RWA Energy Equipment */}
        <div className="card" style={{ gridRow: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Real-World Assets (RWA)</h3>
            <Factory size={20} color="var(--bez-primary-light)" />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {stats.rwa.map((asset, i) => (
              <RwaAsset 
                key={i}
                name={asset.name} 
                fraction={`${(asset.fraction * 100).toFixed(2)}%`} 
                val={`$${asset.value.toLocaleString()}`} 
                tag={asset.name.includes('Solar') ? 'SOLAR' : 'WIND'} 
                tagColor={asset.name.includes('Solar') ? 'var(--bez-solar)' : 'var(--bez-wind)'} 
                img={asset.name.includes('Solar') ? "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=400" : "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=400"}
              />
            ))}
          </div>
        </div>

        {/* Burn Tracker */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Burn Tracker</h3>
            <Flame size={20} color="var(--bez-aegis)" />
          </div>
          
          <div style={{ height: 96, display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 24 }}>
            {[0.4, 0.6, 0.3, 0.8, 0.5, 0.9, 0.7].map((h, i) => (
              <motion.div 
                key={i} 
                style={{ flex: 1, background: 'var(--bez-aegis)', borderRadius: '4px 4px 0 0', opacity: 0.2 + (h * 0.8) }}
                initial={{ height: 0 }}
                animate={{ height: `${h * 100}%` }}
                transition={{ delay: i * 0.1 }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StatRow label="Total $BEZ Burned" val={stats.burn.total.toLocaleString()} color="var(--bez-aegis)" />
            <StatRow label="Burn Rate (per txn)" val={`${(stats.burn.rate * 100).toFixed(1)}%`} color="var(--bez-aegis)" />
            <p style={{ fontSize: 11, color: 'var(--bez-text-muted)', fontStyle: 'italic' }}>
              Every transaction triggers a 1% burn to maintain scarcity and sovereignty.
            </p>
          </div>
        </div>

        {/* DAO Governance */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>DAO Governance</h3>
            <Vote size={20} color="var(--bez-reputation)" />
          </div>
          
          <div style={{ background: 'var(--bez-surface-2)', padding: 16, borderRadius: 12, border: '1px solid var(--bez-border)' }}>
            <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--bez-reputation)', textTransform: 'uppercase', marginBottom: 8 }}>ACTIVE PROPOSAL</p>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Adjust Burn Rate to 0.8%</h4>
            <div style={{ height: 4, width: '100%', background: 'var(--bez-surface-3)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ width: '65%', height: '100%', background: 'var(--bez-reputation)' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800 }}>
              <span>65% YES</span>
              <span>35% NO</span>
            </div>
          </div>
          <button className="btn" style={{ width: '100%', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--bez-reputation)', border: '1px solid rgba(139, 92, 246, 0.2)', fontSize: 11, marginTop: 16 }}>
            ENTER PORTAL
          </button>
        </div>

        {/* Global Ledger Activities */}
        <div className="card" style={{ gridColumn: 'span 2', padding: 0 }}>
          <div style={{ padding: 24, borderBottom: '1px solid var(--bez-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Global Ledger Activities</h3>
            <span style={{ fontSize: 11, color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>LATEST BLOCKS 12,042,109</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--bez-border)', background: 'var(--bez-surface-low)' }}>
                  <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>ACTION</th>
                  <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>HASH</th>
                  <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>AMOUNT</th>
                  <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>BURN</th>
                  <th style={{ padding: 16, color: 'var(--bez-text-muted)', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <LedgerRow action="Generation Yield" hash="0x82...f42c" amt="+1,200.00 $BEZ" burn="-12.00 $BEZ" icon={<Leaf size={14} />} />
                <LedgerRow action="Node Stake" hash="0x14...a911" amt="-50,000.00 $BEZ" burn="-500.00 $BEZ" icon={<Database size={14} />} />
                <LedgerRow action="DAO Payout" hash="0xbc...428e" amt="+450.00 $BEZ" burn="-4.50 $BEZ" icon={<Vote size={14} />} />
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  )
}

const StatRow = ({ label, val, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: 13, color: 'var(--bez-text-sec)' }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: color || 'white' }}>{val}</span>
  </div>
)

const RwaAsset = ({ name, fraction, val, tag, tagColor, img }) => (
  <motion.div 
    className="card" 
    style={{ padding: 0, background: 'var(--bez-surface-2)', border: '1px solid var(--bez-border)', marginBottom: 12 }}
    whileHover={{ borderColor: 'var(--bez-primary)' }}
  >
    <div style={{ height: 120, position: 'relative' }}>
      <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) brightness(0.6)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bez-surface-2), transparent)' }} />
      <div style={{ position: 'absolute', top: 12, right: 12, background: `${tagColor}22`, color: tagColor, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>{tag}</div>
    </div>
    <div style={{ padding: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700 }}>{name}</h4>
      <p style={{ fontSize: 11, color: 'var(--bez-text-muted)', marginTop: 2 }}>Fractional Ownership: {fraction}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>Asset Value</span>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{val}</span>
      </div>
    </div>
  </motion.div>
)

const LedgerRow = ({ action, hash, amt, burn, icon }) => (
  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
    <td style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color: 'var(--bez-primary)' }}>{icon}</div>
        {action}
      </div>
    </td>
    <td style={{ padding: 16, color: 'var(--bez-text-muted)', opacity: 0.6 }}>{hash}</td>
    <td style={{ padding: 16, fontWeight: 700 }}>{amt}</td>
    <td style={{ padding: 16, color: 'var(--bez-aegis)' }}>{burn}</td>
    <td style={{ padding: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bez-secondary)', background: 'rgba(78, 222, 163, 0.1)', border: '1px solid rgba(78, 222, 163, 0.2)', padding: '2px 8px', borderRadius: 4 }}>SYNCED</span>
    </td>
  </tr>
)

export default EnergyWallet
