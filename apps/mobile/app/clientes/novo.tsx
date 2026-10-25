import { useRouter } from 'expo-router';
import { useState } from 'react';
import { core } from '../../src/core';
import { CustomerForm, type CustomerFormValues } from '../../src/customers/CustomerForm';

/** Cadastro de cliente no balcão. O PIN já vem sugerido. */
export default function NewCustomerScreen() {
  const router = useRouter();
  const [initial] = useState<CustomerFormValues>(() => ({
    name: '',
    whatsapp: '',
    reference: '',
    notes: '',
    pin: core.customers.suggestPin(),
    consented: false,
  }));

  return (
    <CustomerForm
      title="Novo cliente"
      lead="Só nome e WhatsApp são obrigatórios. O PIN já vem sorteado; troque se quiser."
      initial={initial}
      submitLabel="Cadastrar cliente"
      onSubmit={async (input) => {
        const customer = await core.customers.createCustomer(input);
        router.replace({ pathname: '/clientes/[id]', params: { id: customer.id } });
      }}
    />
  );
}
