import { isCoreError, type FieldErrors } from '@cvd/core';
import { useCallback, useRef, useState } from 'react';

const fallbackMessage = 'Algo deu errado. Tente de novo.';

/**
 * Estado de envio de um formulário que chama o core: impede envio duplo e
 * separa os erros por campo (mostrados em cada campo) do erro geral.
 */
export function useCoreForm<Field extends string>() {
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await action();
    } catch (error) {
      if (isCoreError(error)) {
        const fields = error.fieldErrors as FieldErrors<Field>;
        setFieldErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? null : error.message);
      } else {
        setFormError(fallbackMessage);
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }, []);

  const clearFieldError = useCallback((field: Field) => {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      return Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== field),
      ) as FieldErrors<Field>;
    });
  }, []);

  return { submitting, fieldErrors, formError, submit, clearFieldError };
}
