import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Jesus Vive Brasil',
};

export const dynamic = 'force-static';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-brand-cream">
      <article className="mx-auto max-w-3xl px-4 py-12 prose prose-slate">
        <h1 className="font-display">Política de Privacidade</h1>
        <p>
          <strong>Última atualização:</strong> Maio de 2026
        </p>

        <p>
          Esta Política de Privacidade descreve como coletamos, usamos e
          protegemos seus dados pessoais em conformidade com a Lei Geral de
          Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
        </p>

        <h2>1. Dados que coletamos</h2>
        <ul>
          <li>Nome e sobrenome</li>
          <li>Número de WhatsApp</li>
          <li>E-mail (opcional)</li>
          <li>Cidade</li>
          <li>Dados técnicos de navegação (UTM, IP anonimizado)</li>
        </ul>

        <h2>2. Finalidade</h2>
        <p>
          Utilizamos seus dados exclusivamente para: (a) enviar confirmação e
          lembretes do evento Jesus Vive Brasil; (b) oferecer acompanhamento
          pastoral via WhatsApp; (c) melhorar a qualidade de nossas comunicações.
        </p>

        <h2>3. Compartilhamento</h2>
        <p>
          Não vendemos nem compartilhamos seus dados com terceiros para fins
          comerciais. Podemos usar processadores de dados (ex.: provedores de
          hospedagem e WhatsApp Business) que aderem à LGPD.
        </p>

        <h2>4. Seus direitos (LGPD)</h2>
        <p>Você tem direito a:</p>
        <ul>
          <li>Confirmar a existência de tratamento de dados</li>
          <li>Acessar seus dados</li>
          <li>Corrigir dados incompletos ou desatualizados</li>
          <li>Solicitar a anonimização, bloqueio ou eliminação</li>
          <li>Revogar o consentimento a qualquer momento</li>
        </ul>

        <h2>5. Retenção</h2>
        <p>
          Mantemos seus dados pelo tempo necessário para cumprir as finalidades
          descritas. Você pode solicitar a exclusão a qualquer momento.
        </p>

        <h2>6. Contato</h2>
        <p>
          Para exercer seus direitos ou esclarecer dúvidas, entre em contato
          pelo WhatsApp informado em nosso site.
        </p>
      </article>
    </main>
  );
}
