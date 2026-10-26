import type { DbClient } from '../db/client';
import type { Coupon } from './coupon';
import { deliverCoupon } from './deliverCoupon';
import { listPendingCoupons, type ListPendingCouponsOptions } from './listPendingCoupons';

export type { Coupon, CouponOrigin, CouponStatus } from './coupon';
export type { ListPendingCouponsOptions } from './listPendingCoupons';

export interface CouponOperations {
  /** Cupons pendentes da loja, ou só os de um cliente (`customerId`). */
  listPendingCoupons(options?: ListPendingCouponsOptions): Promise<Coupon[]>;
  /** Confirma a entrega do prêmio (registra quem entregou e quando). */
  deliverCoupon(couponId: string): Promise<Coupon>;
}

export function createCouponOperations(db: DbClient): CouponOperations {
  return {
    listPendingCoupons: (options) => listPendingCoupons(db, options),
    deliverCoupon: (couponId) => deliverCoupon(db, couponId),
  };
}
