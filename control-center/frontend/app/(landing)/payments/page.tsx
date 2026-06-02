import CopyButton from '@/components/CopyButton';
import { STRIPE_PAYMENT_LINKS } from '@/lib/stripe-payment-links';

export default function PaymentsPage() {
  return (
    <>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/*  Hero Section  */}
        <section className="mb-20 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 mb-6 glass-panel px-4 py-1 rounded-none border border-primary/30">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                <span className="text-[10px] tracking-[0.3em] font-bold text-primary uppercase">Protocol V4.0 Stable</span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-[0.9]">
                BeZhas <span className="text-primary">Pay</span>
              </h1>
              <p className="text-xl text-on-surface-variant max-w-xl mb-8 leading-relaxed">
                Industrial-grade gasless settlement for the global economy. Instant cross-border logistics clearing with zero friction.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="/developers#api" className="bg-primary text-white px-8 py-4 font-bold italic tracking-widest uppercase hover:shadow-[0_0_30px_rgba(13,51,242,0.4)] transition-all inline-flex items-center">
                  INTEGRATE NOW
                </a>
                <a href="/developers" className="glass-panel border border-white/10 text-white px-8 py-4 font-bold italic tracking-widest uppercase hover:bg-white/5 transition-all inline-flex items-center">
                  API DOCS
                </a>
                <a href={STRIPE_PAYMENT_LINKS.tokenPurchase} target="_blank" rel="noopener noreferrer" className="glass-panel border border-primary/30 text-primary px-8 py-4 font-bold italic tracking-widest uppercase hover:bg-primary hover:text-white transition-all inline-flex items-center">
                  BUY BEZ
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square glass-panel border border-white/10 rounded-xl overflow-hidden shadow-2xl p-4">
                <img className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700" data-alt="Futuristic digital visualization of complex blockchain transaction nodes connecting globally with glowing blue energy lines on dark background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwQZ5DKTm3tpjNOT4T16dTF7_NeH140U3mp_-T7-xP-Br_AnU4D2CdroAM85jXiPOuD0V5wlotQCkK5StUJzCufQwOlkanWFsT2viZ2Pzqr82ZKzGxEyWSE1cUsr8yI_nFovTpK53f8MEMsc1Cd5jAz4zkSkrKLxq8zdrFR6rZPvoIyfCb3u-cdjRgtiEq-C9yf8tAbIOFFIKYFlDVA0QnCMYS1WCnFRj_S95E9y71FPZ31zciOGtVoDfirsRmPOEv3HIC67PvwWA" />
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="glass-panel p-6 border border-white/20">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-2">Network Load</p>
                        <div className="flex gap-1 items-end h-8">
                          <div className="w-2 bg-primary h-4"></div>
                          <div className="w-2 bg-primary h-6"></div>
                          <div className="w-2 bg-primary h-3"></div>
                          <div className="w-2 bg-primary h-8"></div>
                          <div className="w-2 bg-primary h-5"></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">Avg Settlement</p>
                        <p className="text-2xl font-black italic text-white">1.2s</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/*  Bento Grid Features  */}
        <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-20">
          {/*  Gasless  */}
          <div className="md:col-span-2 glass-panel p-8 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
              <span className="material-symbols-outlined text-9xl" data-icon="ev_station">ev_station</span>
            </div>
            <span className="material-symbols-outlined text-primary mb-4" data-icon="local_fire_department">local_fire_department</span>
            <h3 className="text-2xl font-bold italic tracking-tight uppercase mb-4">Gasless Transactions</h3>
            <p className="text-on-surface-variant leading-relaxed mb-6">Remove the friction of gas fees for your users. BeZhas Pay abstracts complex smart contract interactions into seamless one-click settlements.</p>
            <div className="flex items-center gap-2 text-primary font-bold italic text-xs tracking-widest uppercase">
              LEARN MORE <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
            </div>
          </div>
          {/*  Multi-Currency  */}
          <div className="glass-panel p-8 border border-white/5 hover:border-primary/30 transition-all">
            <span className="material-symbols-outlined text-primary mb-4" data-icon="currency_exchange">currency_exchange</span>
            <h3 className="text-2xl font-bold italic tracking-tight uppercase mb-4">Multi-Asset</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">Native support for FIAT-backed stablecoins, CBDCs, and industrial credit tokens.</p>
          </div>
          {/*  Logistics  */}
          <div className="glass-panel p-8 border border-white/5 hover:border-primary/30 transition-all">
            <span className="material-symbols-outlined text-primary mb-4" data-icon="trolley">trolley</span>
            <h3 className="text-2xl font-bold italic tracking-tight uppercase mb-4">Logistics</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">Smart escrow for shipping containers. Funds release automatically on GPS geofence arrival.</p>
          </div>
          {/*  Settlement Visualizer  */}
          <div className="lg:col-span-3 glass-panel p-1 border border-white/5 overflow-hidden">
            <div className="bg-surface-container-low p-8 h-full">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold italic tracking-tight uppercase">Real-Time Settlement Flow</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span className="text-[10px] tracking-widest uppercase text-gray-400">Initiated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    <span className="text-[10px] tracking-widest uppercase text-gray-400">Clearing</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-4 border-l-4 border-primary">
                  <span className="material-symbols-outlined text-gray-500" data-icon="terminal">terminal</span>
                  <div className="flex-1">
                    <p className="text-xs font-mono text-primary">TX_ID: 0x82...f9a2</p>
                    <p className="text-sm font-bold uppercase tracking-widest">Cargo Release Order - Rotterdam Port</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black italic">420,000 USDC</p>
                    <p className="text-[10px] text-green-500 uppercase">Confirmed</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 border-l-4 border-cyan-400">
                  <span className="material-symbols-outlined text-gray-500" data-icon="terminal">terminal</span>
                  <div className="flex-1">
                    <p className="text-xs font-mono text-cyan-400">TX_ID: 0x41...e2c8</p>
                    <p className="text-sm font-bold uppercase tracking-widest">Iron Ore Futures - Shanghai Hub</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black italic">1.2M EURT</p>
                    <p className="text-[10px] text-cyan-400 uppercase">Processing</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/*  API Panel  */}
          <div className="glass-panel p-8 border border-white/10 bg-primary/5">
            <h3 className="text-xl font-bold italic tracking-tight uppercase mb-4">REST API</h3>
            <div className="font-mono text-[10px] space-y-2 text-gray-400">
              <p className="text-primary">POST /v1/settle</p>
              <p className="text-gray-500">&#123;</p>
              <p className="pl-4">"asset": "USDC",</p>
              <p className="pl-4">"amount": "10000",</p>
              <p className="pl-4">"dest": "0x..."</p>
              <p className="text-gray-500">&#125;</p>
            </div>
            <CopyButton
              text='POST /v1/settle\n{\n  "asset": "USDC",\n  "amount": "10000",\n  "dest": "0x..."\n}'
              label="COPY KEY"
              className="mt-8 w-full border border-white/20 py-2 text-[10px] font-bold tracking-widest uppercase hover:bg-white/10 transition-all"
            />
          </div>
        </section>
        {/*  Fee Structure & Comparison  */}
        <section className="mb-20">
          <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Estructura de <span className="text-primary">Comisiones</span></h2>
          <p className="text-on-surface-variant max-w-2xl mb-8">Comisión plana del 2.5% sin fees ocultos. Más competitivo que los procesadores tradicionales para cualquier volumen.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-panel p-8 border border-primary/30 rounded-xl bg-primary/5 relative">
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1">BEZHAS</div>
              <span className="material-symbols-outlined text-primary text-4xl mb-4">bolt</span>
              <h3 className="text-2xl font-bold italic uppercase tracking-tight mb-2">BeZhas Pay</h3>
              <div className="text-5xl font-black italic text-primary mb-2">2.5%</div>
              <p className="text-on-surface-variant text-sm mb-6">Comisión plana. Sin fee por transacción. Gasless para usuarios finales.</p>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Settlement en ~1.2 segundos</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Multi-currency (40+ stablecoins)</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> Smart escrow para logística</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check_circle</span> APIs REST + SDK integrado</li>
              </ul>
            </div>

            <div className="glass-panel p-8 border border-white/5 rounded-xl opacity-60">
              <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-4">credit_card</span>
              <h3 className="text-2xl font-bold italic uppercase tracking-tight mb-2">Stripe</h3>
              <div className="text-5xl font-black italic mb-2">2.9%</div>
              <p className="text-on-surface-variant text-sm mb-6">+ $0.30 por transacción. Fees adicionales por conversión de moneda.</p>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-on-surface-variant text-sm">remove_circle</span> Settlement en 2-7 días</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-on-surface-variant text-sm">remove_circle</span> +1% conversión internacional</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-on-surface-variant text-sm">remove_circle</span> Sin escrow nativo</li>
              </ul>
            </div>

            <div className="glass-panel p-8 border border-white/5 rounded-xl opacity-60">
              <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-4">account_balance</span>
              <h3 className="text-2xl font-bold italic uppercase tracking-tight mb-2">SWIFT</h3>
              <div className="text-5xl font-black italic mb-2">1-3%</div>
              <p className="text-on-surface-variant text-sm mb-6">+ fees bancarios intermediarios. $25-50 por wire transfer.</p>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-on-surface-variant text-sm">remove_circle</span> Settlement en 3-5 días hábiles</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-on-surface-variant text-sm">remove_circle</span> Bancos intermediarios</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-on-surface-variant text-sm">remove_circle</span> Sin trazabilidad on-chain</li>
              </ul>
            </div>
          </div>

          {/* Per-Segment Benefits */}
          <div className="glass-panel p-8 border border-white/5 rounded-xl">
            <h3 className="text-2xl font-bold italic uppercase tracking-tighter mb-6">Ahorro por <span className="text-primary">Segmento</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/5 p-4 rounded-lg text-center">
                <span className="material-symbols-outlined text-primary text-2xl mb-2">corporate_fare</span>
                <div className="font-bold italic uppercase tracking-tight text-sm mb-1">Empresas</div>
                <div className="text-2xl font-black text-tertiary">~$27K</div>
                <p className="text-[10px] text-on-surface-variant uppercase">Ahorro anual / $500K vol.</p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg text-center">
                <span className="material-symbols-outlined text-primary text-2xl mb-2">local_shipping</span>
                <div className="font-bold italic uppercase tracking-tight text-sm mb-1">Aduanas</div>
                <div className="text-2xl font-black text-tertiary">~$48K</div>
                <p className="text-[10px] text-on-surface-variant uppercase">Ahorro con escrow + compliance</p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg text-center">
                <span className="material-symbols-outlined text-primary text-2xl mb-2">account_balance</span>
                <div className="font-bold italic uppercase tracking-tight text-sm mb-1">Instituciones</div>
                <div className="text-2xl font-black text-tertiary">~$60K</div>
                <p className="text-[10px] text-on-surface-variant uppercase">Ahorro bridge vs SWIFT / $1M vol.</p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg text-center">
                <span className="material-symbols-outlined text-primary text-2xl mb-2">person</span>
                <div className="font-bold italic uppercase tracking-tight text-sm mb-1">Retail</div>
                <div className="text-2xl font-black text-tertiary">Gasless</div>
                <p className="text-[10px] text-on-surface-variant uppercase">Transacciones sin gas fees</p>
              </div>
            </div>
          </div>
        </section>
        {/*  Industrial Giants Section  */}
        <section className="py-20 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4">TRUSTED BY INDUSTRY</h2>
            <p className="text-gray-500 tracking-[0.3em] uppercase text-xs">Processing $12B+ in annual logistics volume</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 items-center justify-items-center opacity-40 grayscale">
            <div className="text-2xl font-bold italic tracking-tighter">MAERSK_L</div>
            <div className="text-2xl font-bold italic tracking-tighter">COFCO</div>
            <div className="text-2xl font-bold italic tracking-tighter">GLENCORE</div>
            <div className="text-2xl font-bold italic tracking-tighter">VITOL_GRP</div>
            <div className="text-2xl font-bold italic tracking-tighter">BHP_S</div>
            <div className="text-2xl font-bold italic tracking-tighter">RIO_TINTO</div>
          </div>
        </section>
        {/*  Bottom CTA  */}
        <section className="relative rounded-xl overflow-hidden mb-20">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm"></div>
          <img className="w-full h-[400px] object-cover mix-blend-overlay" data-alt="Hyper-modern data center with sleek server racks and neon blue ambient lighting, representing high-performance computational power" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB05ApVEEJ6XkZGs1MVDKD2ibNpUACykQJyVMeAsDwfN6JDn0pcHPn_IsoanlZtQag_YERht9Phozx2Faqt62XTk8ibS7Kxleg6RbAxgMcpJP0dDY7sd0zbSOF3qAUQtFlm7dKvafZ2h-DQBFKQ3XL5UjYJwS8zI5c_dzHjsikvIVeDjc78dV5wKRbcEKklg3xrY_HJvpRk6W1t6lPLxYZFZBSgajGXDumUlvWqXWzpuQO1BZuvlHvygAUC2PIE8xGq8YYzpznzGuc" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
            <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-6 leading-tight">Ready to Automate your<br />Global Settlements?</h2>
            <p className="text-xl text-white/80 max-w-2xl mb-10">Join the industrial revolution. Deploy your payment gateway on the BeZhas network in under 10 minutes.</p>
            <a href="/developers#api" className="bg-white text-black px-12 py-5 font-black italic tracking-widest uppercase hover:bg-primary hover:text-white transition-all duration-300 inline-flex items-center">
              GET API ACCESS
            </a>
          </div>
        </section>
      </div>

    </>
  );
}
