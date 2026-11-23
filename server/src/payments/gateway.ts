import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  PaymentChannel,
  PaymentGatewayName,
  PaymentInstructions,
  PaymentMethod,
  PaymentTransactionStatus,
} from '../../../shared/src/index.ts';

export interface CreateChargeInput {
  orderId: string;
  orderCode: string;
  amount: number;
  method: PaymentMethod;
  channel: PaymentChannel;
  customerName: string;
  customerPhone: string;
}

export interface CreateChargeResult {
  gateway: PaymentGatewayName;
  gatewayRef: string;
  status: PaymentTransactionStatus;
  expiresAt: string;
  instructions: PaymentInstructions;
  isSandbox: boolean;
}

export interface PaymentWebhookPayload {
  gateway_ref: string;
  status_code: string;
  gross_amount: string;
  transaction_status: 'settlement' | 'pending' | 'expire' | 'failure' | 'cancel' | 'refund';
  signature_key: string;
  payment_type?: string;
  settlement_time?: string;
  failure_reason?: string;
}

export interface PaymentGatewayProvider {
  readonly name: PaymentGatewayName;
  readonly isSandbox: boolean;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  signWebhook(gatewayRef: string, statusCode: string, grossAmount: string): string;
  verifyWebhook(payload: PaymentWebhookPayload, headerSignature?: string): boolean;
  refundCharge(gatewayRef: string, amount: number, reason: string): Promise<{ refundRef: string; status: 'refunded' }>;
}

/** Standard CRC-16/CCITT-FALSE used in EMVCo / Bank Indonesia QRIS strings. */
function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, val: string): string {
  return `${tag}${String(val.length).padStart(2, '0')}${val}`;
}

/** Builds an authentic EMVCo-formatted dynamic QRIS payload string for the order & amount. */
export function buildEmvQrisPayload(gatewayRef: string, amount: number): string {
  const merchantInfo = tlv('00', 'ID.KIRIMIN.WWW') + tlv('01', '936009140000123456') + tlv('02', gatewayRef.slice(-12));
  const body =
    tlv('00', '01') + // Payload Format Indicator
    tlv('01', '12') + // Dynamic QR
    tlv('26', merchantInfo) +
    tlv('52', '4215') + // MCC: Courier Services
    tlv('53', '360') + // IDR Currency
    tlv('54', String(Math.round(amount))) +
    tlv('58', 'ID') +
    tlv('59', 'KIRIMIN BALI') +
    tlv('60', 'DENPASAR') +
    tlv('62', tlv('05', gatewayRef)) +
    '6304';
  return body + crc16Ccitt(body);
}

const VA_PREFIX: Record<string, { prefix: string; name: string; steps: string[] }> = {
  bca: {
    prefix: '3901',
    name: 'BCA Virtual Account',
    steps: [
      'Buka BCA Mobile (m-BCA) atau myBCA dan pilih menu m-Transfer.',
      'Pilih BCA Virtual Account lalu tempel nomor VA di atas.',
      'Pastikan nama penerima tertera "KIRIMIN BALI" dan nominal sesuai.',
      'Masukkan PIN m-BCA untuk menyelesaikan pembayaran.',
    ],
  },
  mandiri: {
    prefix: '89508',
    name: 'Mandiri Virtual Account',
    steps: [
      'Buka aplikasi Livin’ by Mandiri lalu pilih menu Bayar.',
      'Cari penyedia jasa "Kirimin / Midtrans" dan masukkan nomor VA.',
      'Periksa detail tagihan dan konfirmasi dengan PIN Livin’.',
    ],
  },
  bni: {
    prefix: '8810',
    name: 'BNI Virtual Account',
    steps: [
      'Buka BNI Mobile Banking atau wondr by BNI lalu pilih Transfer → Virtual Account Billing.',
      'Masukkan nomor Virtual Account di atas.',
      'Periksa nominal tagihan lalu masukkan password transaksi.',
    ],
  },
  bri: {
    prefix: '88810',
    name: 'BRI Virtual Account',
    steps: [
      'Buka aplikasi BRImo lalu pilih menu BRIVA.',
      'Masukkan nomor BRIVA di atas dan cek nominal tagihan.',
      'Konfirmasi pembayaran menggunakan PIN BRImo Anda.',
    ],
  },
};

const EWALLET_META: Record<string, { scheme: string; label: string; steps: string[] }> = {
  gopay: {
    scheme: 'gojek://gopay/merchanttransfer',
    label: 'GoPay',
    steps: [
      'Ketuk tombol "Buka Aplikasi GoPay" atau konfirmasi lewat Simulator Sandbox.',
      'Periksa rincian tagihan Kirimin Bali pada layar konfirmasi GoPay.',
      'Masukkan PIN GoPay — status pesanan akan otomatis menjadi Lunas via webhook.',
    ],
  },
  shopeepay: {
    scheme: 'shopeeid://pay',
    label: 'ShopeePay',
    steps: [
      'Ketuk tombol "Buka Aplikasi ShopeePay" untuk diarahkan ke aplikasi Shopee.',
      'Konfirmasi jumlah pembayaran Kirimin Bali dan masukkan PIN ShopeePay.',
    ],
  },
  dana: {
    scheme: 'dana://pay',
    label: 'DANA',
    steps: [
      'Ketuk tombol "Buka Aplikasi DANA" lalu verifikasi detail tagihan.',
      'Masukkan PIN DANA Anda hingga muncul bukti transaksi berhasil.',
    ],
  },
  ovo: {
    scheme: 'ovo://payment',
    label: 'OVO',
    steps: [
      'Buka notifikasi tagihan yang dikirim ke aplikasi OVO pada nomor HP terdaftar.',
      'Konfirmasi pembayaran dalam 60 detik sebelum sesi kedaluwarsa.',
    ],
  },
};

/**
 * Default Mock / Sandbox Payment Gateway Provider.
 *
 * Emulates Midtrans Core API / Xendit end-to-end:
 * - Issues unique gateway references & expiry windows
 * - Generates authentic EMVCo QRIS strings, Bank VA numbers, and E-Wallet deep links
 * - Signs & verifies webhook callbacks with SHA-512 (`timingSafeEqual`)
 *
 * To switch to real Midtrans or Xendit in production, implement this same
 * `PaymentGatewayProvider` interface using `fetch()` against their Core/Invoice API
 * and register it in `createPaymentGateway()`.
 */
export function createMockGatewayProvider(webhookSecret: string): PaymentGatewayProvider {
  const signWebhook = (gatewayRef: string, statusCode: string, grossAmount: string): string =>
    createHash('sha512')
      .update(`${gatewayRef}${statusCode}${grossAmount}${webhookSecret}`)
      .digest('hex');

  const verifyWebhook = (payload: PaymentWebhookPayload, headerSignature?: string): boolean => {
    const provided = (headerSignature || payload.signature_key || '').trim().toLowerCase();
    if (!provided || provided.length !== 128) return false;
    const expected = signWebhook(payload.gateway_ref, payload.status_code, payload.gross_amount).toLowerCase();
    try {
      return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return false;
    }
  };

  return {
    name: 'mock_gateway',
    isSandbox: true,
    signWebhook,
    verifyWebhook,

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = randomBytes(3).toString('hex').toUpperCase();
      const gatewayRef = `KRM-PAY-${dateTag}-${rand}`;
      const cleanPhone = input.customerPhone.replace(/\D/g, '').slice(-10).padStart(10, '0');

      let ttlMinutes = 15;
      let instructions: PaymentInstructions = { steps: [] };

      if (input.method === 'qris') {
        ttlMinutes = 15;
        instructions = {
          qrString: buildEmvQrisPayload(gatewayRef, input.amount),
          accountName: 'KIRIMIN BALI (QRIS)',
          checkoutUrl: `https://sandbox.kirimin.app/checkout/${gatewayRef}`,
          steps: [
            'Buka aplikasi e-wallet (GoPay, DANA, OVO, ShopeePay) atau M-Banking Anda.',
            'Pilih menu Scan QRIS dan arahkan kamera ke kode QR di atas.',
            'Pastikan merchant tertera "KIRIMIN BALI" dan nominal sudah tepat.',
            'Selesaikan pembayaran — status akan otomatis terverifikasi dalam beberapa detik.',
          ],
        };
      } else if (input.method === 'bank_va') {
        ttlMinutes = 24 * 60;
        const bank = VA_PREFIX[input.channel] || VA_PREFIX.bca;
        instructions = {
          vaNumber: `${bank.prefix}${cleanPhone}`,
          accountName: `KIRIMIN BALI / ${input.customerName.toUpperCase()}`,
          checkoutUrl: `https://sandbox.kirimin.app/va/${gatewayRef}`,
          steps: bank.steps,
        };
      } else if (input.method === 'ewallet') {
        ttlMinutes = 15;
        const wallet = EWALLET_META[input.channel] || EWALLET_META.gopay;
        instructions = {
          deepLinkUrl: `${wallet.scheme}?ref=${gatewayRef}&amount=${input.amount}`,
          checkoutUrl: `https://sandbox.kirimin.app/ewallet/${input.channel}/${gatewayRef}`,
          accountName: `${wallet.label} • KIRIMIN BALI`,
          steps: wallet.steps,
        };
      } else {
        ttlMinutes = 24 * 60;
        instructions = {
          accountName: 'Pembayaran Tunai (COD)',
          steps: [
            `Siapkan uang pas sebesar Rp ${input.amount.toLocaleString('id-ID')}.`,
            'Serahkan langsung kepada driver saat penjemputan atau serah terima paket.',
            'Pembayaran otomatis ditandai lunas saat kode 4 digit diverifikasi.',
          ],
        };
      }

      return {
        gateway: 'mock_gateway',
        gatewayRef,
        status: 'pending',
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
        instructions,
        isSandbox: true,
      };
    },

    async refundCharge(gatewayRef: string, _amount: number, _reason: string) {
      return {
        refundRef: `RF-${gatewayRef}-${randomBytes(2).toString('hex').toUpperCase()}`,
        status: 'refunded',
      };
    },
  };
}
