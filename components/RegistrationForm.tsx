'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { registrationSchema, type RegistrationInput } from '@/lib/validations';
import { CITY_OPTIONS } from '@/lib/cells';

interface Props {
  cellId: string;
  defaultCity?: string;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function RegistrationForm({ cellId, defaultCity }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      cellId,
      city: defaultCity ?? '',
      language: 'pt-BR',
      source: 'pre-reg',
      lgpdConsent: false as unknown as true,
    },
  });

  // Capture UTM params from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
    const map: Record<typeof utmKeys[number], keyof RegistrationInput> = {
      utm_source: 'utmSource',
      utm_medium: 'utmMedium',
      utm_campaign: 'utmCampaign',
      utm_content: 'utmContent',
    };
    utmKeys.forEach((k) => {
      const v = params.get(k);
      if (v) setValue(map[k], v);
    });
  }, [setValue]);

  const onSubmit = async (data: RegistrationInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Algo deu errado. Tente novamente.');
      }
      // Meta Pixel Lead event
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead');
      }
      router.push(`/obrigado?cell=${cellId}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Erro inesperado.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="field-label">
            Nome <span className="text-brand-primary">*</span>
          </label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            className="field-input"
            placeholder="Seu nome"
            {...register('firstName')}
          />
          {errors.firstName && (
            <p className="field-error">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="field-label">
            Sobrenome <span className="text-brand-primary">*</span>
          </label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            className="field-input"
            placeholder="Seu sobrenome"
            {...register('lastName')}
          />
          {errors.lastName && (
            <p className="field-error">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="whatsapp" className="field-label">
          WhatsApp <span className="text-brand-primary">*</span>
        </label>
        <input
          id="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="field-input"
          placeholder="(11) 99999-9999"
          {...register('whatsapp')}
        />
        <p className="mt-1 text-xs text-gray-500">
          Vamos enviar a confirmação e o link do evento aqui.
        </p>
        {errors.whatsapp && (
          <p className="field-error">{errors.whatsapp.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="field-label">
          E-mail <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="field-input"
          placeholder="seu@email.com"
          {...register('email')}
        />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="city" className="field-label">
          Cidade <span className="text-brand-primary">*</span>
        </label>
        <select id="city" className="field-input" {...register('city')}>
          <option value="">Escolha sua cidade</option>
          {CITY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.city && <p className="field-error">{errors.city.message}</p>}
      </div>

      <div className="rounded-lg bg-white/60 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-orange-300"
            {...register('lgpdConsent')}
          />
          <span className="text-sm text-brand-dark">
            Concordo em receber comunicações sobre o evento e li a{' '}
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener"
              className="font-semibold text-brand-primary underline"
            >
              Política de Privacidade
            </a>
            . <span className="text-brand-primary">*</span>
          </span>
        </label>
        {errors.lgpdConsent && (
          <p className="field-error">{errors.lgpdConsent.message}</p>
        )}
      </div>

      {/* Hidden fields */}
      <input type="hidden" {...register('cellId')} />
      <input type="hidden" {...register('source')} />
      <input type="hidden" {...register('language')} />
      <input type="hidden" {...register('utmSource')} />
      <input type="hidden" {...register('utmMedium')} />
      <input type="hidden" {...register('utmCampaign')} />
      <input type="hidden" {...register('utmContent')} />

      {serverError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full text-lg">
        {submitting ? 'Enviando...' : 'Inscreva-se gratuitamente'}
      </button>

      <p className="text-center text-xs text-gray-500">
        100% gratuito • Sem compromisso • Online
      </p>
    </form>
  );
}
