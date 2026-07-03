import { Link } from "react-router-dom";
import type { ReactNode } from "react";

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bm-shell" style={{ maxWidth: 720 }}>
      <Link to="/" className="bm-btn bm-btn-ghost" style={{ textDecoration: "none", marginBottom: "1rem" }}>← Voltar</Link>
      <h1>{title}</h1>
      <div style={{ color: "var(--bm-ink)", lineHeight: 1.6 }}>{children}</div>
      <p style={{ color: "var(--bm-muted)", fontSize: ".85rem", marginTop: "2rem" }}>
        Versão da política: 2026-07-01 · Contato: privacidade@bearminds.cybersphere.com.br
      </p>
    </div>
  );
}

// Política de privacidade (PT) — alinhada à LGPD e ao referencial de IA do MEC (spec 09).
export function PoliticaPrivacidade() {
  return (
    <LegalShell title="Política de Privacidade">
      <p><b>Quem controla os dados.</b> O BearMinds é operado por Cybersphere. A conta é do responsável; a criança usa sob o perfil dele.</p>
      <h3>Que dados coletamos</h3>
      <ul>
        <li><b>Do responsável:</b> e-mail (para login) e, opcionalmente, nome (guardado criptografado).</li>
        <li><b>Da criança:</b> apenas apelido, ano de nascimento e série (mais a instituição/turma). Nada além disso.</li>
        <li><b>De estudo:</b> quais tópicos foram estudados e o progresso de memória, para agendar revisões.</li>
      </ul>
      <h3>Consentimento (LGPD art. 14)</h3>
      <p>Pedimos consentimento específico, separável e destacado, no melhor interesse da criança. Cada autorização
        (conta, geração com IA, acompanhamento de progresso, e-mail) é registrada separadamente e pode ser revogada a
        qualquer momento nas configurações.</p>
      <h3>Como usamos IA (transparência)</h3>
      <p>O conteúdo de estudo é gerado por modelos de linguagem <b>ancorados em um material verificado</b> (BNCC): o
        modelo só ensina a partir desse material e <b>recusa</b> quando não há base suficiente. Não há reconhecimento
        facial, decisão automatizada de nota sem revisão humana, nem inferência de emoções. Todo conteúdo pode ser
        revisado por humanos.</p>
      <h3>Compartilhamento e rastreadores</h3>
      <p>Não usamos SDKs de anúncios ou de analytics de terceiros. Nossas métricas são agregadas e anônimas.</p>
      <h3>Seus direitos (LGPD art. 18)</h3>
      <p>Você pode exportar todos os seus dados (JSON) e excluir a conta a qualquer momento no modo responsável. A
        exclusão é imediata (soft delete) e a remoção definitiva ocorre em até 30 dias.</p>
      <h3>Segurança</h3>
      <p>Senhas com hash bcrypt, transporte HTTPS, PII de adulto criptografada (AES-256-GCM), banco acessível apenas
        pelo serviço.</p>
      <p><Link to="/termos">Ver os Termos de Uso</Link>.</p>
    </LegalShell>
  );
}

export function Termos() {
  return (
    <LegalShell title="Termos de Uso">
      <p>O BearMinds é um companheiro de estudos alinhado à BNCC. Nosso princípio é <b>“aprender, não colar”</b>: o app
        não entrega a resposta pronta; ele guia o raciocínio.</p>
      <h3>Conta</h3>
      <p>A conta é do responsável, que é o único autorizado a criá-la e a consentir pelo uso por menores.</p>
      <h3>Uso adequado</h3>
      <p>O conteúdo é de apoio ao estudo e não substitui a escola nem avaliação profissional. Podemos limitar uso
        abusivo.</p>
      <h3>Disponibilidade</h3>
      <p>Fazemos o possível para manter o serviço no ar, mas ele é fornecido “como está” durante esta fase inicial.</p>
      <p><Link to="/politica-de-privacidade">Ver a Política de Privacidade</Link>.</p>
    </LegalShell>
  );
}
