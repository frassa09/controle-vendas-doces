import { formatWhatsApp } from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { core } from '../../../src/core';
import { CustomerForm } from '../../../src/customers/CustomerForm';
import { LoadingState } from '../../../src/ui/LoadingState';
import { useFocusQuery } from '../../../src/ui/useFocusQuery';

/** Edição dos dados do cliente, inclusive a troca do PIN. */
export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const load = useCallback(() => core.customers.getCustomer(id), [id]);
  // Lê uma vez: recarregar ao voltar o foco apagaria o que já foi digitado.
  const query = useFocusQuery(load, { once: true });

  if (!query.data) return <LoadingState query={query} />;
  const customer = query.data;

  return (
    <CustomerForm
      title="Editar cliente"
      initial={{
        name: customer.name,
        whatsapp: formatWhatsApp(customer.whatsapp),
        reference: customer.reference ?? '',
        notes: customer.notes ?? '',
        pin: customer.pin,
        consented: customer.consented,
      }}
      submitLabel="Salvar alterações"
      onSubmit={async (input) => {
        await core.customers.updateCustomer(customer.id, input);
        router.back();
      }}
    />
  );
}
