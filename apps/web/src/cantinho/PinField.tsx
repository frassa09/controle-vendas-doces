import type { Ref } from 'react';

interface PinFieldProps {
  value: string;
  onChange: (pin: string) => void;
  error: string | null;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Campo do PIN de 4 números (DESIGN.md › Inputs › PIN), com o erro em espaço reservado. */
export function PinField({ value, onChange, error, disabled = false, ref }: PinFieldProps) {
  return (
    <div className="campo">
      <label htmlFor="pin">Seu PIN de 4 números</label>
      <input
        ref={ref}
        id="pin"
        className="pin"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        pattern="[0-9]{4}"
        placeholder="••••"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby="pin-erro"
        onChange={(event) => {
          onChange(event.target.value.replace(/\D/g, '').slice(0, 4));
        }}
      />
      <p className="erro" id="pin-erro" role="alert">
        {error ?? ''}
      </p>
    </div>
  );
}
