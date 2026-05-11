'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import { resolveCellForGenericRoute } from '@/lib/cells';

const walkInSchema = z.object({
  firstName: z.string().min(2, 'Informe seu nome.').max(50).trim(),
  lastName: z.string().min(2, 'Informe seu sobrenome.').max(50).trim(),
  whatsapp: z
    .string()
    .min(8, 'Número inválido.')
    .refine((v) => {
      try {
        return isValidPhoneNumber(v, 'BR');
      } catch {
        return false;
      }
    }, 'Número inválido.')
    .transform((v) => {
      try {
        return parsePhoneNumber(v, 'BR').number;
      } catch {
        return v;
      }
    }),
  lgpdConsent: z.literal(true, {
    error: () => 'Aceite a Política de Privacidade.',
  }),
});

type WalkInInput = z.input<typeof walkInSchema>;

interface Props {
  label: string;
}

export function WalkInModal({ label }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WalkInInput>({
    resolver: zodResolver(walkInSchema),
    defaultValues: { lgpdConsent: false as unknown as true },
  });

  const onSubmit = async (data: WalkInInput) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          city: 'event-walk-in',
          email: '',
          language: 'pt-BR',
          source: 'event-walk-in',
          cellId: resolveCellForGenericRoute(data.whatsapp),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Falha no envio.');
      }
      setSuccess(true);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 text-brand-dark shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-brand-primary/15 flex items-center justify-center text-2xl text-brand-primary">
                  ✓
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">
                  Recebemos seus dados!
                </h3>
                <p className="mt-2 text-sm text-brand-dark/75">
                  Vamos te chamar no WhatsApp em instantes.
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-6 w-full"
                  onClick={() => {
                    setSuccess(false);
                    setOpen(false);
                  }}
                >
                  Voltar para a transmissão
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-display text-xl font-bold">
                  Receber acompanhamento
                </h3>
                <p className="mt-1 mb-4 text-sm text-brand-dark/70">
                  Deixe seus dados e falaremos com você agora mesmo.
                </p>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <input
                    className="field-input"
                    placeholder="Nome"
                    {...register('firstName')}
                  />
                  {errors.firstName && (
                    <p className="field-error">{errors.firstName.message}</p>
                  )}
                  <input
                    className="field-input"
                    placeholder="Sobrenome"
                    {...register('lastName')}
                  />
                  {errors.lastName && (
                    <p className="field-error">{errors.lastName.message}</p>
                  )}
                  <input
                    className="field-input"
                    placeholder="WhatsApp"
                    inputMode="tel"
                    {...register('whatsapp')}
                  />
                  {errors.whatsapp && (
                    <p className="field-error">{errors.whatsapp.message}</p>
                  )}
                  <label className="flex items-start gap-2 text-xs text-brand-dark/80">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      {...register('lgpdConsent')}
                    />
                    <span>
                      Aceito a{' '}
                      <a
                        href="/privacidade"
                        target="_blank"
                        rel="noopener"
                        className="underline"
                      >
                        Política de Privacidade
                      </a>
                      .
                    </span>
                  </label>
                  {errors.lgpdConsent && (
                    <p className="field-error">{errors.lgpdConsent.message}</p>
                  )}
                  {error && (
                    <div className="rounded bg-red-50 p-2 text-xs text-red-700">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full"
                  >
                    {submitting ? 'Enviando...' : 'Enviar'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
