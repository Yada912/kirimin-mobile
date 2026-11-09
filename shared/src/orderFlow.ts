import type { OrderStatus } from './domain.ts';

/**
 * Order state machine. Every status change on the server goes through
 * `canTransition`, so this table is the single source of truth for who may
 * move an order where. The app can use it too, e.g. to decide which buttons to show.
 *
 *   open ──driver claims──▶ accepted
 *   requested ──driver accepts──▶ accepted        requested ──driver declines──▶ declined
 *   declined ──sender picks another driver──▶ requested / ──posts it──▶ open
 *   accepted ─▶ picked_up ─▶ in_transit ─▶ arrived ─▶ delivered
 *   (sender can cancel until pickup; driver can cancel an accepted order before pickup)
 */
export type Actor = 'sender' | 'driver' | 'system';

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  by: Actor[];
}

const T = (from: OrderStatus, to: OrderStatus, ...by: Actor[]): Transition => ({ from, to, by });

export const ORDER_TRANSITIONS: Transition[] = [
  T('open', 'accepted', 'driver'),
  T('open', 'requested', 'sender'),
  T('open', 'cancelled', 'sender'),
  T('open', 'expired', 'system'),

  T('requested', 'accepted', 'driver'),
  T('requested', 'declined', 'driver'),
  T('requested', 'open', 'sender'), //      withdraw from that driver and post publicly
  T('requested', 'cancelled', 'sender'),
  T('requested', 'expired', 'system'),

  T('declined', 'requested', 'sender'),
  T('declined', 'open', 'sender'),
  T('declined', 'cancelled', 'sender'),
  T('declined', 'expired', 'system'),

  T('accepted', 'picked_up', 'driver'),
  T('accepted', 'cancelled', 'sender'),
  T('accepted', 'open', 'driver'), //       driver drops out before pickup → back to the pool (D8)

  T('picked_up', 'in_transit', 'driver'),
  T('picked_up', 'arrived', 'driver'),
  T('in_transit', 'arrived', 'driver'),
  T('arrived', 'delivered', 'driver'),
];

export function canTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return ORDER_TRANSITIONS.some((t) => t.from === from && t.to === to && t.by.includes(actor));
}

export function nextStatuses(from: OrderStatus, actor: Actor): OrderStatus[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === from && t.by.includes(actor)).map((t) => t.to);
}
