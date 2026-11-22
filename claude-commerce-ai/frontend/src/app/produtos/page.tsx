import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { ProductForm } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, Skeleton, SourceBadge, Table, Td } from "@/components/ui";
import { runAgent, updateProductStatus } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { fmtBRL, fmtPct, PRODUCT_STATUS } from "@/lib/format";
import type { Product } from "@/lib/types";

const CLASS_TONE = { A: "ok", B: "warn", C: "danger" } as const;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Cadastro e classificação (A = priorizar, B = testar, C = evitar). Somente fatos verificados podem ser usados em roteiros."
        actions={<ActionButton label="Reclassificar com o Pesquisador" variant="primary" action={runAgent.bind(null, "product_researcher", {})} />}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Suspense fallback={<Skeleton rows={6} />}>
            <ProductTable />
          </Suspense>
        </div>
        <Card title="Cadastrar produto">
          <ProductForm />
        </Card>
      </div>
    </>
  );
}

async function ProductTable() {
  const [products, err] = await load(apiGet<Product[]>("/products"));
  if (err || !products) return <ErrorPanel error={err} />;
  if (!products.length) return <Empty>Nenhum produto cadastrado.</Empty>;
  return (
    <Card>
      <Table head={["Produto", "Classe", "Score", "Preço", "Comissão", "Riscos", "Status", ""]}>
        {products.map((p) => (
          <tr key={p.id}>
            <Td>
              <div className="font-medium">{p.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {p.category} <SourceBadge source={p.data_source} />
              </div>
            </Td>
            <Td>{p.classification ? <Badge tone={CLASS_TONE[p.classification]}>{p.classification}</Badge> : <span className="text-muted">—</span>}</Td>
            <Td className="tabular">{p.score ?? "—"}</Td>
            <Td className="tabular whitespace-nowrap">{fmtBRL(p.price_brl)}</Td>
            <Td className="tabular">{fmtPct(p.commission_rate)}</Td>
            <Td>
              <div className="flex flex-col gap-1">
                {!p.sample_received && <Badge tone="warn">sem amostra</Badge>}
                {!p.media_rights_confirmed && <Badge tone="warn">mídia sem direitos</Badge>}
                {p.verified_claims.length === 0 && <Badge tone="warn">sem fatos verificados</Badge>}
              </div>
            </Td>
            <Td>
              <Badge>{PRODUCT_STATUS[p.status]}</Badge>
            </Td>
            <Td>
              {p.status !== "active" ? (
                <ActionButton label="Ativar" action={updateProductStatus.bind(null, p.id, "active")} />
              ) : (
                <ActionButton label="Pausar" action={updateProductStatus.bind(null, p.id, "paused")} />
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
