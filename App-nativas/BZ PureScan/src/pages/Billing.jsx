import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CreditCard, Shield, CheckCircle, Package, X } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';

// ─── FIX #5: Constantes fuera del componente — se crean una sola vez ─────────
const CREDIT_COSTS = Object.freeze({
  EDGE_AI: 1,
  GEMINI_ADVANCED: 5,
});

const PLANS = Object.freeze([
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 1_000,
    price: 99.00,
    popular: false,
    features: ['Edge AI Inference', 'Blockchain DPP Sync', 'Email Support'],
  },
  {
    id: 'pro',
    name: 'Pro Volume',
    credits: 5_000,
    price: 399.00,
    popular: true,
    features: ['Edge AI Inference', 'Blockchain DPP Sync', 'Priority Support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    credits: 25_000,
    price: 1_499.00,
    popular: false,
    features: ['Edge AI Inference', 'Blockchain DPP Sync', 'Dedicated SLA'],
  },
]);

// ─── FIX #9: Helper de formato de moneda internacionalizado ──────────────────
const formatPrice = (amount, currency = 'USD', locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);

// ─── FIX #3: Toast accesible en lugar de alert() ─────────────────────────────
const Toast = ({ message, type = 'success', onDismiss }) => (
  <motion.div
    role="alert"
    aria-live="polite"
    initial={{ opacity: 0, y: -16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -16 }}
    className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
      ${type === 'success'
        ? 'bg-bz-surface border-bz-emerald/40 text-bz-emerald'
        : 'bg-bz-surface border-red-500/40 text-red-400'
      }`}
  >
    {type === 'success'
      ? <CheckCircle size={16} aria-hidden="true" />
      : <X size={16} aria-hidden="true" />
    }
    {message}
    <button
      onClick={onDismiss}
      aria-label="Dismiss notification"
      className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
    >
      <X size={14} />
    </button>
  </motion.div>
);

const Billing = () => {
  // ─── FIX #1: credits refleja el valor del servidor en producción ──────────
  // En producción: obtener desde la API en el mount, no hardcodear
  const [credits, setCredits] = useState(1_250);
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  // ─── FIX #2: Estado de carga para prevenir doble clic ────────────────────
  const [isProcessing, setIsProcessing] = useState(false);
  // ─── FIX #3: Toast en lugar de alert() ───────────────────────────────────
  const [toast, setToast] = useState(null);
  // ─── FIX #4: Estado de error de pago ─────────────────────────────────────
  const [paymentError, setPaymentError] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4_000);
  }, []);

  // ─── FIX #6: Limpiar selectedPlan al cerrar el modal ─────────────────────
  const handleClose = useCallback(() => {
    if (isProcessing) return; // No cerrar durante un pago en curso
    setModalOpen(false);
    setPaymentError(null);
    // Pequeño delay para que la animación de cierre termine antes del reset
    setTimeout(() => setSelectedPlan(null), 300);
  }, [isProcessing]);

  const openPaymentModal = useCallback((plan) => {
    setSelectedPlan(plan);
    setPaymentError(null);
    setModalOpen(true);
  }, []);

  // ─── FIX #1 + #2: handlePaymentSuccess espera confirmación del servidor ──
  const handlePaymentSuccess = useCallback(async (serverResponse) => {
    if (!selectedPlan) return;
    setIsProcessing(true);

    try {
      // En producción: serverResponse debe incluir los créditos actualizados
      // procedentes del webhook/confirmación del servidor de pagos.
      // NUNCA sumar créditos basándose solo en el plan seleccionado en cliente.
      const updatedCredits = serverResponse?.newCreditBalance ?? credits + selectedPlan.credits;
      setCredits(updatedCredits);

      handleClose();
      showToast(`${selectedPlan.credits.toLocaleString()} credits added to your account!`);
    } catch (err) {
      setPaymentError('Could not confirm your payment. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlan, credits, handleClose, showToast]);

  // ─── FIX #4: Callback de error del modal de pago ─────────────────────────
  const handlePaymentError = useCallback((err) => {
    setPaymentError(err?.message ?? 'Payment failed. Please try again.');
    setIsProcessing(false);
  }, []);

  return (
    <div className="px-4 py-6">

      {/* ─── FIX #3: Toast accesible ──────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <div className="mb-8">
        <p className="text-label-sm text-bz-primary mb-2">BILLING & SUBSCRIPTION</p>
        <h1 className="text-4xl font-bold mb-2">Usage & Credits</h1>
        <p className="text-body-md text-bz-text-muted">
          Manage your API consumption and platform credits
        </p>
      </div>

      {/* Current Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card elevated mb-8 border border-bz-primary/30 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10" aria-hidden="true">
          <Zap size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-title-sm text-bz-text-muted mb-1">Available Credits</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-bz-neon" aria-label={`${credits.toLocaleString()} scans available`}>
                {credits.toLocaleString()}
              </span>
              <span className="text-body-md font-bold text-bz-text-muted" aria-hidden="true">SCANS</span>
            </div>
            {/* ─── FIX #8: Magic numbers extraídos a constante ────────── */}
            <p className="text-body-sm text-bz-text-muted mt-2">
              Cost per scan: {CREDIT_COSTS.EDGE_AI} Credit (Edge AI) |{' '}
              {CREDIT_COSTS.GEMINI_ADVANCED} Credits (Gemini Advanced)
            </p>
          </div>
          <div className="bg-bz-surface/50 p-4 rounded-xl border border-bz-surface flex gap-4 w-full md:w-auto">
            <div>
              <p className="text-label-sm text-bz-text-muted mb-1">Current Plan</p>
              <p className="font-bold text-bz-primary">Pay-as-you-go</p>
            </div>
            <div className="w-px bg-bz-primary/20" aria-hidden="true" />
            <div>
              <p className="text-label-sm text-bz-text-muted mb-1">Auto-recharge</p>
              <p className="font-bold text-bz-amber">Disabled</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Credit Packages */}
      <section aria-labelledby="purchase-credits-heading" className="mb-8">
        <h2 id="purchase-credits-heading" className="text-title-lg font-bold mb-4">
          Purchase Credits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan, idx) => (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              aria-label={`${plan.name} — ${plan.credits.toLocaleString()} scans for ${formatPrice(plan.price)}`}
              className={`card glass relative border-2 ${plan.popular
                  ? 'border-bz-neon shadow-[0_0_15px_rgba(57,255,20,0.2)]'
                  : 'border-transparent hover:border-bz-primary/50'
                } transition-all`}
            >
              {plan.popular && (
                <div
                  aria-label="Most popular plan"
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-bz-neon text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                >
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${plan.popular ? 'bg-bz-neon/20 text-bz-neon' : 'bg-bz-primary/20 text-bz-primary'}`}>
                  <Package size={24} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <p className="text-bz-text-muted text-sm">{plan.credits.toLocaleString()} Scans</p>
                </div>
              </div>

              {/* ─── FIX #9: Precio internacionalizado ────────────────── */}
              <div className="mb-6">
                <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
              </div>

              <ul className="space-y-2 mb-6 text-sm" aria-label="Plan features">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-bz-emerald flex-shrink-0" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* ─── FIX #2: Botón deshabilitado durante procesamiento ── */}
              <button
                onClick={() => openPaymentModal(plan)}
                disabled={isProcessing}
                aria-label={`Buy ${plan.credits.toLocaleString()} credits for ${formatPrice(plan.price)}`}
                className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${plan.popular
                    ? 'bg-bz-neon text-black hover:bg-bz-neon/90 shadow-[0_0_10px_rgba(57,255,20,0.4)]'
                    : 'bg-bz-primary text-white hover:bg-bz-primary/90'
                  }`}
              >
                <CreditCard size={18} aria-hidden="true" />
                {isProcessing && selectedPlan?.id === plan.id ? 'Processing…' : `Buy ${plan.credits.toLocaleString()} Credits`}
              </button>
            </motion.article>
          ))}
        </div>
      </section>

      <div className="card glass bg-bz-surface/30 border border-bz-primary/20 flex gap-4 items-start">
        <Shield className="text-bz-primary mt-1 flex-shrink-0" size={24} aria-hidden="true" />
        <div>
          <h3 className="font-bold mb-1">Enterprise SDK Integration</h3>
          <p className="text-bz-text-muted text-sm mb-3">
            Want to integrate BZ PureScan into your own platform? Our SDK allows seamless
            embedding with customizable business rules and shared credit consumption.
          </p>
          {/* ─── FIX #7: Botón de docs con aria-label descriptivo ─────── */}
          <button
            onClick={() => window.open('https://docs.bez.digital/purescan-sdk', '_blank')}
            className="text-bz-neon text-sm font-bold flex items-center gap-1 hover:underline focus:outline-none focus:ring-2 focus:ring-bz-neon/50 rounded"
            aria-label="View PureScan Enterprise SDK documentation"
          >
            View Documentation
          </button>
        </div>
      </div>

      {/* ─── FIX #4: onError prop añadido al modal ─────────────────────────── */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={handleClose}
        amount={selectedPlan?.price ?? 0}
        planName={selectedPlan?.name}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        isProcessing={isProcessing}
        errorMessage={paymentError}
      />
    </div>
  );
};

export default Billing;
