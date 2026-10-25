import { describe, expect, it } from 'vitest';
import { buildPixCopyAndPaste, crc16, isCoreError, normalizePixKey } from '../src';

describe('Pix copia-e-cola estático (BR Code)', () => {
  it('o CRC16 bate com o valor de referência e com os exemplos oficiais do Banco Central', () => {
    expect(crc16('123456789')).toBe('29B1');

    const official = [
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865406100.505802BR5913Fulano de Tal6008BRASILIA62070503***80740014br.gov.bcb.pix2552pix.example.com/rec/2353c790eefb11eaadc10242ac12000263042875',
      '00020126180014br.gov.bcb.pix5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***80740014br.gov.bcb.pix2552pix.example.com/rec/2353c790eefb11eaadc10242ac1200026304F2DA',
    ];
    for (const payload of official) {
      expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4));
    }
  });

  it('chave de telefone, nome e cidade com acento, valor com centavos', () => {
    expect(
      buildPixCopyAndPaste({
        key: '+5561912345678',
        name: 'Doces da Júlia',
        city: 'São Paulo',
        amountCents: 1550,
      }),
    ).toBe(
      '00020126360014br.gov.bcb.pix0114+5561912345678520400005303986540515.505802BR5914DOCES DA JULIA6009SAO PAULO62070503***6304D0CB',
    );
  });

  it('corta nome (25) e cidade (15), tira símbolos e aceita valor inteiro', () => {
    expect(
      buildPixCopyAndPaste({
        key: 'fulano_da_silva.recebedor@example.com',
        name: 'Confeitaria Açúcar & Afeto Ltda',
        city: 'Ribeirão das Neves',
        amountCents: 800,
      }),
    ).toBe(
      '00020126590014br.gov.bcb.pix0137fulano_da_silva.recebedor@example.com52040000530398654048.005802BR5924CONFEITARIA ACUCAR AFETO6015RIBEIRAO DAS NE62070503***63041CE9',
    );
  });

  it('chave aleatória com valor R$ 100,50 (exemplo oficial com o nome em maiúsculas)', () => {
    expect(
      buildPixCopyAndPaste({
        key: '123e4567-e12b-12d1-a456-426655440000',
        name: 'FULANO DE TAL',
        city: 'BRASILIA',
        amountCents: 10050,
      }),
    ).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865406100.505802BR5913FULANO DE TAL6008BRASILIA62070503***630488B1',
    );
  });

  it('um txid alfanumérico entra no campo 62 e o CRC continua correto', () => {
    const payload = buildPixCopyAndPaste({
      key: 'julia@example.com',
      name: 'Julia',
      city: 'BH',
      amountCents: 600,
      txid: 'COBRANCA',
    });
    expect(payload).toContain('62120508COBRANCA6304');
    expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4));
  });

  it('recusa dados que o padrão não aceita, com mensagem por campo', () => {
    try {
      buildPixCopyAndPaste({ key: ' ', name: '!!!', city: '', amountCents: 0 });
      expect.unreachable();
    } catch (error) {
      expect(isCoreError(error)).toBe(true);
      expect(isCoreError(error) && error.fieldErrors).toEqual({
        key: 'Informe a chave Pix da loja.',
        name: 'Informe o nome da loja.',
        city: 'Informe a cidade da loja.',
        amountCents: 'Informe um valor maior que zero.',
      });
    }
  });
});

describe('chave Pix no formato do Banco Central', () => {
  it('normaliza telefone, CPF, CNPJ, e-mail e chave aleatória como cadastrados pela loja', () => {
    const cases: [string, string][] = [
      ['(61) 91234-5678', '+5561912345678'],
      ['61912345678', '+5561912345678'],
      ['6133334444', '+556133334444'],
      ['5561912345678', '+5561912345678'],
      ['+55 61 91234-5678', '+5561912345678'],
      ['529.982.247-25', '52998224725'],
      ['52998224725', '52998224725'],
      ['11.222.333/0001-81', '11222333000181'],
      [' Loja@Exemplo.com ', 'loja@exemplo.com'],
      ['123E4567-E12B-12D1-A456-426655440000', '123e4567-e12b-12d1-a456-426655440000'],
    ];
    for (const [cadastrada, esperada] of cases) {
      expect(normalizePixKey(cadastrada), cadastrada).toBe(esperada);
    }
  });

  it('o copia-e-cola usa a chave normalizada', () => {
    expect(
      buildPixCopyAndPaste({
        key: '(61) 91234-5678',
        name: 'Doces da Júlia',
        city: 'São Paulo',
        amountCents: 1550,
      }),
    ).toBe(
      '00020126360014br.gov.bcb.pix0114+5561912345678520400005303986540515.505802BR5914DOCES DA JULIA6009SAO PAULO62070503***6304D0CB',
    );
  });
});
