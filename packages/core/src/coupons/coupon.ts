import type { Database } from '../db/database.types';
import type { MemberRef } from '../sales';

/** De onde veio o prêmio: troca direta de pontos ou raspadinha. */
export type CouponOrigin = 'redemption' | 'scratch';

/** Pendente até um membro entregar o prêmio. */
export type CouponStatus = 'pending' | 'delivered';

/** Um prêmio do cliente, para retirar na loja. */
export interface Coupon {
  id: string;
  customer: { id: string; name: string };
  productId: string;
  /** Nome do produto na hora do prêmio. */
  productName: string;
  origin: CouponOrigin;
  status: CouponStatus;
  createdAt: string;
  deliveredAt: string | null;
  /** Quem entregou; null enquanto pendente. */
  deliveredBy: MemberRef | null;
}

type CouponRow = Database['public']['Tables']['coupons']['Row'];

export const couponColumns =
  'id, customer_id, product_id, product_name, origin, status, created_at, delivered_at, delivered_by, customer:customers!coupons_customer_fkey(name)';

export function toCoupon(
  row: Omit<CouponRow, 'store_id'>,
  customerName: string,
  deliveredBy: MemberRef | null,
): Coupon {
  return {
    id: row.id,
    customer: { id: row.customer_id, name: customerName },
    productId: row.product_id,
    productName: row.product_name,
    origin: row.origin === 'scratch' ? 'scratch' : 'redemption',
    status: row.status === 'delivered' ? 'delivered' : 'pending',
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    deliveredBy,
  };
}
