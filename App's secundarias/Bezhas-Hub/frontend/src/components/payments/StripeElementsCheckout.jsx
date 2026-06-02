import React, { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

// Validate Stripe key exists before loading
const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripeKey && stripeKey !== 'undefined' ? loadStripe(stripeKey) : null;

function CheckoutForm({ clientSecret, amount, currency, onSuccess, onCancel }) {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setSubmitting(true);
        setError(null);

        try {
            const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {},
                redirect: 'if_required',
            });

            if (confirmError) {
                setError(confirmError.message || 'Error al confirmar el pago');
                setSubmitting(false);
                return;
            }

            if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture')) {
                onSuccess?.(paymentIntent);
            } else {
                setError(`Estado de pago inesperado: ${paymentIntent?.status || 'desconocido'}`);
            }
        } catch (err) {
            setError(err.message || 'Error al procesar el pago');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={!stripe || submitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition disabled:opacity-50"
                >
                    {submitting ? 'Procesando…' : `Pagar ${amount} ${currency}`}
                </button>
            </div>
        </form>
    );
}

export default function StripeElementsCheckout({ clientSecret, amount, currency = 'USD', onSuccess, onCancel }) {
    const options = useMemo(() => ({
        clientSecret,
        appearance: {
            theme: 'stripe',
            variables: {
                colorPrimary: '#8B6FFF',
                colorText: '#1F2937',
                fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                borderRadius: '12px',
            },
        },
    }), [clientSecret]);

    if (!clientSecret) return null;

    return (
        <Elements stripe={stripePromise} options={options}>
            <CheckoutForm clientSecret={clientSecret} amount={amount} currency={currency} onSuccess={onSuccess} onCancel={onCancel} />
        </Elements>
    );
}
