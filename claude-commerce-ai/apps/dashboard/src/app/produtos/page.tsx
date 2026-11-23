import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { ProductForm } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, SimulatedBadge, Skeleton, Table, Td } from "@/components/ui";
import { updateProductStatus } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { fmtBRL, fmtPct, PRODUCT_STATUS } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Cadastro manual com deduplicação. A pesquisa e a pontuação automáticas (Caçador de Produtos) chegam na Sprint 2, apenas com fontes autorizadas."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Suspense fallback={<Skeleton rows={5} />}>
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
  const [items, err] = await load(apiGet<Product[]>("/products"));
  if (err || !items) return <ErrorPanel error={err} />;
  if (!items.length) return <Empty>Nenhum produto cadastrado ainda.</Empty>;
  return (
    <Card>
      <Table head={["Produto", "Preço", "Comissão", "Score", "Status", ""]}>
        {items.map((p) => (
          <tr key={p.id}>
            <Td>
              <div className="font-medium">{p.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {p.category ?? "sem categoria"} · {p.source ?? "—"} {p.external_id && `· ${p.external_id}`}
                <SimulatedBadge simulated={p.is_simulated} />
              </div>
            </Td>
            <Td className="tabular whitespace-nowrap">{fmtBRL(p.price)}</Td>
            <Td className="tabular whitespace-nowrap">
              {fmtPct(p.commission_rate)}
              {p.commission_value != null && <div className="text-xs text-muted">{fmtBRL(p.commission_value)}</div>}
            </Td>
            <Td className="tabular">{p.score ?? "—"}</Td>
            <Td>
              <Badge>{PRODUCT_STATUS[p.status] ?? p.status}</Badge>
            </Td>
            <Td>
              {p.status === "rejected" ? (
                <ActionButton label="Reconsiderar" action={updateProductStatus.bind(null, p.id, "candidate")} />
              ) : (
                <ActionButton label="Rejeitar" action={updateProductStatus.bind(null, p.id, "rejected")} />
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
