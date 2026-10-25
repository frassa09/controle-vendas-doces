/** Tipo de movimento do livro de pontos. Por enquanto só o crédito por venda quitada. */
export type PointsMovementKind = 'saleCredit';

/** Um movimento do livro de pontos do cliente. */
export interface PointsMovement {
  id: string;
  kind: PointsMovementKind;
  /** Pontos do movimento; positivo é crédito. */
  points: number;
  /** Venda que gerou o movimento. */
  saleId: string | null;
  createdAt: string;
}

/** Saldo e extrato de pontos de um cliente. O saldo é a soma dos movimentos. */
export interface CustomerPoints {
  customerId: string;
  balance: number;
  /** Do movimento mais novo para o mais antigo. */
  movements: PointsMovement[];
}
