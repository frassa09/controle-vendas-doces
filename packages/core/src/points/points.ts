/**
 * Tipo de movimento do livro de pontos: crédito por venda quitada, estorno (a
 * venda foi cancelada ou voltou a ficar em aberto), ajuste (a venda quitada foi
 * editada, ou foi quitada de novo depois de um estorno) resgate (pontos gastos) e vencimento (o saldo venceu sem compra paga no prazo).
 */
export type PointsMovementKind =
  'saleCredit' | 'saleReversal' | 'saleAdjustment' | 'redemption' | 'expiration';

/** Um movimento do livro de pontos do cliente. */
export interface PointsMovement {
  id: string;
  kind: PointsMovementKind;
  /** Pontos do movimento; positivo é crédito, negativo é débito. */
  points: number;
  /** Venda que gerou o movimento. */
  saleId: string | null;
  createdAt: string;
}

/** Saldo e extrato de pontos de um cliente. O saldo é a soma dos movimentos e pode ser negativo. */
export interface CustomerPoints {
  customerId: string;
  balance: number;
  /** Quando vence o saldo atual; null se a loja não tem validade ou não há saldo. */
  expiresAt: string | null;
  /** Do movimento mais novo para o mais antigo. */
  movements: PointsMovement[];
}
