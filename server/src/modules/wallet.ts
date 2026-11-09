import type { PayoutMethod, WalletEntry, WalletEntryType, WalletSummary } from '../../../shared/src/index.ts';
import { PAYOUT_METHODS, PAYOUT_PROVIDERS, WITHDRAWAL_RULES } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import { Router } from '../http/router.ts';
import { badRequest, conflict } from '../http/errors.ts';
import { parse, v } from '../http/validate.ts';
import { newId, nowIso, parseJson } from '../lib/util.ts';
import type { NotificationsService } from './notifications.ts';

/**
 * Driver wallet (P10 "Pendapatan", P11–P12 "Tarik saldo"), as an append-only ledger.
 *
 * - Non-cash orders credit the driver's fee when delivered (`earning`).
 * - Cash orders are recorded as `cash_earning`: the driver already has the money,
 *   so it shows in totals but not in the withdrawable balance.
 * - A sender cancelling after acceptance pays the driver `compensation`.
 * - Withdrawals are mocked: they complete immediately. Swap `payout()` for a
 *   Xendit/Midtrans disbursement call when real money is involved.
 */

interface EntryRow {
  id: string;
  user_id: string;
  order_id: string | null;
  type: WalletEntryType;
  amount: number;
  status: WalletEntry['status'];
  note: string | null;
  meta_json: string;
  created_at: string;
  order_code?: string | null;
}

const BALANCE_TYPES = `'earning','compensation','withdrawal'`;

const toDto = (r: EntryRow): WalletEntry => {
  const meta = parseJson<{ payout?: WalletEntry['payout'] }>(r.meta_json, {});
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    status: r.status,
    orderId: r.order_id,
    orderCode: r.order_code ?? null,
    note: r.note,
    payout: meta.payout ?? null,
    createdAt: r.created_at,
  };
};

const withdrawBody = v.object({
  amount: v.int({ min: WITHDRAWAL_RULES.min, max: WITHDRAWAL_RULES.max }),
  method: v.enum(PAYOUT_METHODS),
  provider: v.string({ min: 2, max: 40 }),
  accountNumber: v.string({ min: 5, max: 30, pattern: /^[0-9 -]+$/ }),
  accountName: v.string({ min: 2, max: 80 }),
});

export function walletService(db: Db, notifications: NotificationsService) {
  async function balanceOf(tx: Db, userId: string): Promise<number> {
    const r = await tx.get<{ b: number | null }>(
      `SELECT SUM(amount) AS b FROM wallet_entries WHERE user_id = ? AND type IN (${BALANCE_TYPES}) AND status <> 'failed'`,
      [userId],
    );
    return r?.b ?? 0;
  }

  return {
    /**
     * Books an order-related credit inside the caller's transaction.
     * Idempotent per (order, type), so a retried request can't pay twice.
     */
    async credit(tx: Db, userId: string, orderId: string, type: 'earning' | 'cash_earning' | 'compensation', amount: number, note: string) {
      if (amount <= 0) return;
      await tx.run(
        `INSERT INTO wallet_entries (id, user_id, order_id, type, amount, status, note, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, '{}', ?) ON CONFLICT DO NOTHING`,
        [newId(), userId, orderId, type, amount, note, nowIso()],
      );
    },

    async summary(userId: string): Promise<WalletSummary> {
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const totals = await db.get<{ cash: number | null; earned: number | null; week: number | null; withdrawn: number | null }>(
        `SELECT SUM(CASE WHEN type = 'cash_earning' THEN amount ELSE 0 END) AS cash,
                SUM(CASE WHEN type IN ('earning','cash_earning','compensation') THEN amount ELSE 0 END) AS earned,
                SUM(CASE WHEN type IN ('earning','cash_earning','compensation') AND created_at >= ? THEN amount ELSE 0 END) AS week,
                SUM(CASE WHEN type = 'withdrawal' AND status <> 'failed' THEN -amount ELSE 0 END) AS withdrawn
           FROM wallet_entries WHERE user_id = ?`,
        [weekAgo, userId],
      );
      const rows = await db.all<EntryRow>(
        `SELECT w.*, o.code AS order_code FROM wallet_entries w LEFT JOIN orders o ON o.id = w.order_id
          WHERE w.user_id = ? ORDER BY w.created_at DESC, w.rowid DESC LIMIT 100`,
        [userId],
      );
      return {
        balance: await balanceOf(db, userId),
        cashCollected: totals?.cash ?? 0,
        totalEarned: totals?.earned ?? 0,
        earnedLast7Days: totals?.week ?? 0,
        totalWithdrawn: totals?.withdrawn ?? 0,
        entries: rows.map(toDto),
      };
    },

    /** P11–P12 "Tarik saldo" (mocked payout: completes immediately). */
    async withdraw(userId: string, input: unknown): Promise<WalletEntry> {
      const body = parse(input, withdrawBody);
      const providers = PAYOUT_PROVIDERS[body.method as PayoutMethod];
      if (!providers.includes(body.provider)) {
        throw badRequest(`Pilih salah satu: ${providers.join(', ')}`, { field: 'provider' });
      }
      const payout = { method: body.method, provider: body.provider, accountNumber: body.accountNumber.replace(/[ -]/g, ''), accountName: body.accountName };
      const row = await db.transaction(async (tx) => {
        const balance = await balanceOf(tx, userId);
        if (body.amount > balance) throw conflict('Saldo tidak cukup', { balance });
        const entry: EntryRow = {
          id: newId(), user_id: userId, order_id: null, type: 'withdrawal', amount: -body.amount, status: 'completed',
          note: `Tarik ke ${payout.provider} ${payout.accountNumber.slice(-4).padStart(payout.accountNumber.length, '•')}`,
          meta_json: JSON.stringify({ payout }), created_at: nowIso(),
        };
        await tx.run(
          'INSERT INTO wallet_entries (id, user_id, order_id, type, amount, status, note, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [entry.id, entry.user_id, entry.order_id, entry.type, entry.amount, entry.status, entry.note, entry.meta_json, entry.created_at],
        );
        return entry;
      });
      await notifications.notify(userId, 'wallet.withdrawn', 'Penarikan berhasil',
        `Rp ${body.amount.toLocaleString('id-ID')} dikirim ke ${payout.provider}`, { entryId: row.id });
      return toDto(row);
    },
  };
}

export type WalletService = ReturnType<typeof walletService>;

export function walletRoutes(svc: WalletService): Router {
  const r = new Router();
  r.get('/wallet', (ctx) => svc.summary(ctx.userId()));
  r.post('/wallet/withdraw', async (ctx) => {
    ctx.status = 201;
    return svc.withdraw(ctx.userId(), await ctx.json());
  });
  return r;
}
