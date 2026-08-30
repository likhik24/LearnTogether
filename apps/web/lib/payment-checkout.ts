import type { BookingDto, PaymentDto } from '@learn-and-build/types';
import { createPaymentsClient } from './api';

interface CheckoutResult { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayInstance { open(): void; on(event: string, callback: (response: { error?: { description?: string } }) => void): void }
interface RazorpayConstructor { new(options: Record<string, unknown>): RazorpayInstance }
declare global { interface Window { Razorpay?: RazorpayConstructor } }

export async function runPaymentCheckout(booking: BookingDto): Promise<PaymentDto> {
  const client = createPaymentsClient();
  const intent = await client.createPaymentIntent(booking.id);
  if (intent.payment.provider === 'mock') {
    return client.verifyPayment(intent.payment.id, {
      providerOrderId: intent.providerOrderId,
      providerPaymentId: `pay_mock_${booking.id.replace(/-/g, '').slice(0, 20)}`,
      signature: 'mock_signature',
    });
  }
  await loadRazorpay();
  const result = await new Promise<CheckoutResult>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: intent.publicKey,
      amount: booking.amountMinor,
      currency: booking.currency,
      name: 'Learn & Build',
      description: booking.title,
      order_id: intent.providerOrderId,
      timeout: 1200,
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Payment was cancelled. Your seat is held for 20 minutes.')) },
      theme: { color: '#6d43d6' },
    });
    checkout.on('payment.failed', (response) => reject(new Error(response.error?.description ?? 'Payment failed. Please try again.')));
    checkout.open();
  });
  return client.verifyPayment(intent.payment.id, {
    providerOrderId: result.razorpay_order_id,
    providerPaymentId: result.razorpay_payment_id,
    signature: result.razorpay_signature,
  });
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Payment checkout could not load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Payment checkout could not load.'));
    document.head.appendChild(script);
  });
}
