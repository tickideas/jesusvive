/**
 * City → Cell mapping
 *
 * Each /city route maps to a cell. The cell_id is what gets stored in the DB
 * so Outreach Leads can filter their registrations.
 *
 * Adjust the mapping as cell assignments evolve.
 */

export type CellSlug = 'saopaulo' | 'rio' | 'brasilia';

export interface CellConfig {
  slug: CellSlug;
  cellId: string;
  cityLabel: string;
  state: string;
  heroHeadline: string;
  heroSubheadline: string;
  whatsappGreeting: string;
}

export const CELL_CONFIG: Record<CellSlug, CellConfig> = {
  saopaulo: {
    slug: 'saopaulo',
    cellId: 'cell-1',
    cityLabel: 'São Paulo',
    state: 'SP',
    heroHeadline: 'Jesus está vivo — e Ele está em São Paulo.',
    heroSubheadline: 'Inscreva-se gratuitamente para o encontro online de 16 de maio.',
    whatsappGreeting: 'Olá! Acabei de me inscrever em Jesus Vive Brasil (São Paulo). Quero saber mais.',
  },
  rio: {
    slug: 'rio',
    cellId: 'cell-2',
    cityLabel: 'Rio de Janeiro',
    state: 'RJ',
    heroHeadline: 'Jesus está vivo — e Ele está no Rio.',
    heroSubheadline: 'Inscreva-se gratuitamente para o encontro online de 16 de maio.',
    whatsappGreeting: 'Olá! Acabei de me inscrever em Jesus Vive Brasil (Rio). Quero saber mais.',
  },
  brasilia: {
    slug: 'brasilia',
    cellId: 'cell-3',
    cityLabel: 'Brasília',
    state: 'DF',
    heroHeadline: 'Jesus está vivo — e Ele está em Brasília.',
    heroSubheadline: 'Inscreva-se gratuitamente para o encontro online de 16 de maio.',
    whatsappGreeting: 'Olá! Acabei de me inscrever em Jesus Vive Brasil (Brasília). Quero saber mais.',
  },
};

export const CITY_OPTIONS = [
  { value: 'sao-paulo', label: 'São Paulo' },
  { value: 'rio-de-janeiro', label: 'Rio de Janeiro' },
  { value: 'brasilia', label: 'Brasília' },
  { value: 'salvador', label: 'Salvador' },
  { value: 'fortaleza', label: 'Fortaleza' },
  { value: 'belo-horizonte', label: 'Belo Horizonte' },
  { value: 'manaus', label: 'Manaus' },
  { value: 'curitiba', label: 'Curitiba' },
  { value: 'recife', label: 'Recife' },
  { value: 'porto-alegre', label: 'Porto Alegre' },
  { value: 'other', label: 'Outra cidade' },
];

/**
 * If user picks a different city in the dropdown, we keep the original
 * cell assignment from the URL route — the page they clicked from.
 * If they hit the generic / route, we round-robin by hashing their submission.
 */
export function resolveCellForGenericRoute(whatsapp: string): string {
  const cells = ['cell-1', 'cell-2', 'cell-3'];
  let hash = 0;
  for (let i = 0; i < whatsapp.length; i++) {
    hash = (hash << 5) - hash + whatsapp.charCodeAt(i);
    hash |= 0;
  }
  return cells[Math.abs(hash) % cells.length];
}
