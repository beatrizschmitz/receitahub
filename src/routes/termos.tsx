import { createFileRoute, Link } from "@tanstack/react-router";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — receitahub" },
      {
        name: "description",
        content:
          "Condições de uso do receitahub: planos, pagamentos, uso das receitas e do plano alimentar gerados por inteligência artificial.",
      },
      { property: "og:title", content: "Termos de Uso — receitahub" },
      { property: "og:type", content: "website" },
    ],
  }),
});

const h2 = "font-display italic text-2xl text-blush mt-10";
const p = "text-cream/70 leading-relaxed mt-3";
const li = "text-cream/70 leading-relaxed";

function TermsPage() {
  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <main className="max-w-3xl mx-auto px-6 lg:px-10 py-14">
        <h1 className="font-display italic text-4xl text-blush">Termos de Uso</h1>
        <p className="text-sm text-cream/50 mt-2">Última atualização: 14 de outubro de 2026</p>

        <p className={p}>
          Ao criar uma conta ou usar o receitahub, você concorda com estes termos. O receitahub é um
          projeto acadêmico do Centro Universitário de Brasília (CEUB), desenvolvido no Projeto
          Integrador III.
        </p>

        <h2 className={h2}>1. O que o receitahub oferece</h2>
        <p className={p}>
          Receitas, uma despensa virtual com controle de validade, um chef virtual por inteligência
          artificial, reconhecimento de ingredientes por foto e planos alimentares personalizados,
          conforme o plano contratado (gratuito, básico ou premium).
        </p>

        <h2 className={h2}>2. Conteúdo gerado por inteligência artificial</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li className={li}>
            Receitas, custos e substituições são{" "}
            <strong className="text-cream">estimativas geradas por IA</strong> e podem conter erros.
            Confira ingredientes, quantidades e validade dos alimentos antes de consumir.
          </li>
          <li className={li}>
            Calorias e nutrientes de receitas e planos alimentares são calculados com a Tabela
            Brasileira de Composição de Alimentos (TACO, NEPA/UNICAMP, 4ª edição, 2011). A tabela
            traz valores médios por 100 g, e as medidas caseiras (colher, xícara, unidade) são
            convertidas em gramas de forma aproximada. Alimentos sem correspondente na tabela ficam
            de fora do cálculo, e nesses casos a estimativa pode vir da IA.
          </li>
          <li className={li}>
            Se você tem alergia ou intolerância, informe nas restrições e <em>sempre</em> leia o
            rótulo dos produtos: a IA pode errar.
          </li>
          <li className={li}>
            Os preços exibidos são estimativas baseadas em pesquisas de refeição no Brasil e não
            representam valores reais de mercado.
          </li>
        </ul>

        <h2 className={h2}>3. O plano alimentar não é consulta nutricional</h2>
        <p className={p}>
          O plano alimentar calcula suas metas com fórmulas padronizadas e monta um cardápio a
          partir delas. Ele <strong className="text-cream">não substitui</strong> a avaliação de um
          nutricionista ou médico. Em caso de doença, gravidez, uso de medicamentos, transtorno
          alimentar ou qualquer condição de saúde, procure acompanhamento profissional antes de
          seguir qualquer plano. Não nos responsabilizamos por decisões de saúde tomadas apenas com
          base no conteúdo do site.
        </p>

        <h2 className={h2}>4. Sua conta</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li className={li}>
            Você é responsável pelos dados que informa e por manter sua senha em sigilo.
          </li>
          <li className={li}>
            Você pode apagar seus dados ou excluir sua conta a qualquer momento em{" "}
            <Link to="/perfil" className="underline hover:text-blush">
              Perfil
            </Link>
            . A exclusão da conta é definitiva.
          </li>
          <li className={li}>
            Não use o site para fins ilegais, nem tente acessar dados de outras pessoas, burlar
            limites dos planos ou sobrecarregar o serviço.
          </li>
        </ul>

        <h2 className={h2}>5. Planos e pagamento</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li className={li}>
            Os planos básico e premium são pagos por cartão de crédito. Os valores e os recursos de
            cada plano estão na página{" "}
            <Link to="/planos" className="underline hover:text-blush">
              Planos
            </Link>
            .
          </li>
          <li className={li}>
            Os dados do cartão são enviados ao gateway de pagamento e não ficam salvos no
            receitahub.
          </li>
          <li className={li}>
            Você pode cancelar quando quiser em{" "}
            <Link to="/minha-assinatura" className="underline hover:text-blush">
              Minha assinatura
            </Link>
            . O acesso continua até o fim do período já pago.
          </li>
          <li className={li}>
            Por ser um projeto acadêmico, a cobrança pode ser simulada (modo de demonstração), sem
            débito real no cartão e com períodos de assinatura mais curtos que o normal.
          </li>
        </ul>

        <h2 className={h2}>6. Disponibilidade e responsabilidade</h2>
        <p className={p}>
          O serviço é oferecido "como está". Podemos alterar, suspender ou encerrar funcionalidades
          a qualquer momento, e o site pode ficar indisponível por manutenção ou por falhas de
          terceiros (hospedagem, banco de dados, provedor de IA). Na extensão permitida pela lei,
          não respondemos por danos indiretos decorrentes do uso do site.
        </p>

        <h2 className={h2}>7. Propriedade intelectual</h2>
        <p className={p}>
          O código, o design e a marca receitahub pertencem à equipe do projeto. As receitas que
          você importa ou salva continuam sendo suas. As fotos de receitas vêm de bancos de imagens
          e mantêm os créditos dos seus autores.
        </p>

        <h2 className={h2}>8. Privacidade</h2>
        <p className={p}>
          O tratamento dos seus dados pessoais está descrito na{" "}
          <Link to="/privacidade" className="underline hover:text-blush">
            Política de Privacidade
          </Link>
          .
        </p>

        <h2 className={h2}>9. Mudanças e contato</h2>
        <p className={p}>
          Podemos atualizar estes termos; a data no topo mostra a última revisão. Continuar usando o
          site depois de uma mudança significa que você concorda com ela.{" "}
          {CONTACT_EMAIL && (
            <>
              Dúvidas:{" "}
              <a className="underline hover:text-blush" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </>
          )}
        </p>
        <p className={p}>Estes termos seguem a legislação brasileira.</p>
      </main>
    </div>
  );
}
