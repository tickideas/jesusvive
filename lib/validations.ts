import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

export const registrationSchema = z.object({
  firstName: z
    .string()
    .min(2, 'Por favor, informe seu nome.')
    .max(50, 'Nome muito longo.')
    .trim(),
  lastName: z
    .string()
    .min(2, 'Por favor, informe seu sobrenome.')
    .max(50, 'Sobrenome muito longo.')
    .trim(),
  whatsapp: z
    .string()
    .min(8, 'Informe um número de WhatsApp válido.')
    .refine((val) => {
      try {
        return isValidPhoneNumber(val, 'BR');
      } catch {
        return false;
      }
    }, 'Número de WhatsApp inválido.')
    .transform((val) => {
      try {
        return parsePhoneNumber(val, 'BR').number;
      } catch {
        return val;
      }
    }),
  email: z
    .email('E-mail inválido.')
    .optional()
    .or(z.literal('')),
  city: z.string().min(1, 'Por favor, escolha sua cidade.'),
  language: z.enum(['pt-BR', 'en']).default('pt-BR'),
  lgpdConsent: z.literal(true, {
    error: () => 'É necessário concordar com a Política de Privacidade.',
  }),
  // Hidden / auto fields
  cellId: z.string(),
  source: z.enum(['pre-reg', 'event-walk-in']).default('pre-reg'),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
});

export type RegistrationInput = z.input<typeof registrationSchema>;
