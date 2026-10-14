import { createFileRoute, Link } from "@tanstack/react-router";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — receitahub" },
      {
        name: "description",
        content:
          "Saiba quais dados o receitahub coleta, para que usamos, com quem compartilhamos e como exercer seus direitos pela LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — receitahub" },
      { property: "og:type", content: "website" },
    ],
  }),
});

const h2 = "font-display italic text-2xl text-blush mt-10";
const p = "text-cream/70 leading-relaxed mt-3";
const li = "text-cream/70 leading-relaxed";

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <main className="max-w-3xl mx-auto px-6 lg:px-10 py-14">
        <h1 className="font-display italic text-4xl text-blush">Política de Privacidade</h1>
        <p className="text-sm text-cream/50 mt-2">Última atualização: 14 de outubro de 2026</p>

        <p className={p}>
          O receitahub é um projeto acadêmico (Projeto Integrador III, Centro Universitário de
          Brasília — CEUB). Esta página explica, de forma direta, quais dados pessoais usamos, por
          quê, e quais são os seus direitos conforme a Lei Geral de Proteção de Dados (LGPD, Lei
          13.709/2018).
        </p>

        <h2 className={h2}>1. Quem é o responsável</h2>
        <p className={p}>
          A equipe do projeto receitahub é a controladora dos dados tratados neste site.{" "}
          {CONTACT_EMAIL ? (
            <>
              Para qualquer pedido sobre seus dados, escreva para{" "}
              <a className="underline hover:text-blush" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            <>
              Você pode exercer a maior parte dos seus direitos diretamente no app, em{" "}
              <Link to="/perfil" className="underline hover:text-blush">
                Perfil
              </Link>{" "}
              (apagar dados e excluir conta).
            </>
          )}
        </p>

        <h2 className={h2}>2. Quais dados coletamos</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li className={li}>
            <strong className="text-cream">Conta:</strong> e-mail, nome de exibição e senha (a senha
            é guardada de forma criptografada pelo serviço de autenticação; nós não a vemos). Se
            você entrar com o Google, recebemos o e-mail e o nome da sua conta Google.
          </li>
          <li className={li}>
            <strong className="text-cream">Despensa e receitas:</strong> os ingredientes, as
            validades, as receitas que você salva, notas, avaliações e o registro do que você marcou
            como "Comi isso" (com as calorias estimadas).
          </li>
          <li className={li}>
            <strong className="text-cream">Dados de saúde (plano alimentar):</strong> sexo
            biológico, idade, peso, altura, nível de atividade física, objetivo, restrições
            alimentares, se está gestante ou amamentando e as observações que você escrever. São
            dados pessoais <em>sensíveis</em> pela LGPD, e só são tratados se você os informar.
          </li>
          <li className={li}>
            <strong className="text-cream">Fotos:</strong> as imagens que você envia ao Chef
            Despensa para reconhecer ingredientes, guardadas em um espaço privado, acessível apenas
            pela sua conta.
          </li>
          <li className={li}>
            <strong className="text-cream">Assinatura e pagamento:</strong> o plano contratado, o
            período e o identificador da transação. Os dados do cartão são enviados ao gateway de
            pagamento no momento da compra e{" "}
            <strong className="text-cream">não ficam salvos</strong> por nós.
          </li>
          <li className={li}>
            <strong className="text-cream">Uso do chat:</strong> a quantidade de mensagens por dia
            (para o limite do plano gratuito).
          </li>
        </ul>

        <h2 className={h2}>3. Para que usamos</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li className={li}>Criar e manter a sua conta e o acesso ao plano contratado.</li>
          <li className={li}>
            Gerar receitas, responder no chat, reconhecer ingredientes em fotos e montar o plano
            alimentar com base nos seus dados.
          </li>
          <li className={li}>Calcular as suas metas de calorias e nutrientes.</li>
          <li className={li}>Processar a cobrança e manter o histórico da assinatura.</li>
        </ul>
        <p className={p}>
          As bases legais são a execução do serviço que você pediu e, para os dados de saúde, o seu
          consentimento — que você dá ao preencher o formulário do plano alimentar e pode retirar a
          qualquer momento apagando os dados.
        </p>

        <h2 className={h2}>4. Com quem compartilhamos</h2>
        <p className={p}>
          Usamos prestadores de serviço que processam dados em nosso nome, apenas para fazer o site
          funcionar:
        </p>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li className={li}>
            <strong className="text-cream">Hospedagem do site:</strong> Vercel.
          </li>
          <li className={li}>
            <strong className="text-cream">Banco de dados, autenticação e arquivos:</strong>{" "}
            Supabase.
          </li>
          <li className={li}>
            <strong className="text-cream">Inteligência artificial:</strong> o texto das suas
            mensagens, os ingredientes, as fotos que você envia ao chef e os dados do formulário do
            plano alimentar são enviados a um provedor de IA (por padrão, o Google Gemini) para
            gerar a resposta. Não envie informações que você não queira compartilhar nesse
            processamento.
          </li>
          <li className={li}>
            <strong className="text-cream">Pagamento:</strong> o gateway de pagamento contratado.
          </li>
          <li className={li}>
            <strong className="text-cream">Fotos de receitas:</strong> buscamos imagens em um banco
            de imagens (Pexels) usando apenas o título da receita.
          </li>
        </ul>
        <p className={p}>
          Alguns desses prestadores podem processar dados fora do Brasil. Não vendemos seus dados
          nem os usamos para publicidade.
        </p>

        <h2 className={h2}>5. Por quanto tempo guardamos</h2>
        <p className={p}>
          Mantemos os dados enquanto a sua conta existir. Ao excluir a conta, apagamos o seu
          cadastro, a despensa, as receitas, os planos alimentares, o histórico de calorias, a
          assinatura e as fotos enviadas. Registros de transações podem ser mantidos pelo prazo
          exigido por obrigações legais e fiscais.
        </p>

        <h2 className={h2}>6. Seus direitos</h2>
        <p className={p}>Pela LGPD, você pode, a qualquer momento:</p>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li className={li}>confirmar que tratamos seus dados e acessá-los;</li>
          <li className={li}>corrigir dados incompletos ou desatualizados;</li>
          <li className={li}>
            apagar seus dados — em{" "}
            <Link to="/perfil" className="underline hover:text-blush">
              Perfil
            </Link>
            , "Apagar dados" remove a despensa, as receitas e o histórico de calorias, e "Excluir
            conta" remove tudo;
          </li>
          <li className={li}>pedir a portabilidade dos seus dados;</li>
          <li className={li}>retirar o consentimento dado para os dados de saúde;</li>
          <li className={li}>
            reclamar à Autoridade Nacional de Proteção de Dados (ANPD) se achar que seus direitos
            não foram respeitados.
          </li>
        </ul>

        <h2 className={h2}>7. Segurança</h2>
        <p className={p}>
          A conexão com o site é criptografada (HTTPS) e cada pessoa só consegue acessar os dados da
          própria conta. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente que
          possa afetar você, avisaremos conforme a lei.
        </p>

        <h2 className={h2}>8. Menores de idade</h2>
        <p className={p}>
          O plano alimentar calculado é destinado a maiores de 18 anos. Pessoas menores devem usar o
          site com o acompanhamento de um responsável.
        </p>

        <h2 className={h2}>9. Mudanças nesta política</h2>
        <p className={p}>
          Se mudarmos esta política, atualizamos a data no topo da página. Mudanças importantes
          serão avisadas no próprio site.
        </p>

        <p className="mt-12 text-sm text-cream/55">
          Veja também os{" "}
          <Link to="/termos" className="underline hover:text-blush">
            Termos de Uso
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
