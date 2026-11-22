import { Suspense } from "react";

import { ErrorPanel, load } from "@/components/BackendError";
import { ImportForm } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, Skeleton, Table, Td } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { ImportBatch } from "@/lib/types";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Importação de relatórios"
        subtitle="Alternativa enquanto a API oficial do TikTok Shop não está liberada: exporte o relatório no painel oficial e envie aqui. Sem scraping. Dados importados são marcados como reais (“Importado”)."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Produtos (CSV/XLSX)">
          <p className="mb-3 text-xs text-muted">
            Colunas obrigatórias: <code>nome, categoria, preco, comissao</code>. Opcionais: <code>vendedor, sku</code>. Aceita “R$ 39,90” e “12%”.
          </p>
          <ImportForm kind="products" label="Importar produtos" />
        </Card>
        <Card title="Métricas diárias (CSV/XLSX)">
          <p className="mb-3 text-xs text-muted">
            Colunas: <code>data, sku, visualizacoes, cliques, pedidos, gmv, comissao_brl</code>. Datas em AAAA-MM-DD ou DD/MM/AAAA. O SKU vincula ao produto cadastrado.
          </p>
          <ImportForm kind="metrics" label="Importar métricas" />
        </Card>
      </div>
      <p className="mt-3 text-xs text-muted">
        Modelos em <code>docs/templates/</code>. Os nomes de coluna dos relatórios oficiais do TikTok Shop precisam ser conferidos no arquivo real exportado — ajuste os aliases em{" "}
        <code>backend/app/services/importer.py</code> se necessário.
      </p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton rows={2} />}>
          <History />
        </Suspense>
      </div>
    </>
  );
}

async function History() {
  const [items, err] = await load(apiGet<ImportBatch[]>("/imports"));
  if (err || !items) return <ErrorPanel error={err} />;
  return (
    <Card title="Histórico de importações (nesta execução)">
      {items.length === 0 ? (
        <Empty>Nenhuma importação ainda.</Empty>
      ) : (
        <Table head={["Arquivo", "Tipo", "OK", "Erros", "Quando", "Detalhes"]}>
          {items.map((b) => (
            <tr key={b.id}>
              <Td>{b.filename}</Td>
              <Td>{b.kind}</Td>
              <Td>
                <Badge tone="ok">{b.rows_ok}</Badge>
              </Td>
              <Td>
                <Badge tone={b.rows_error ? "danger" : "neutral"}>{b.rows_error}</Badge>
              </Td>
              <Td className="whitespace-nowrap">{fmtDateTime(b.created_at)}</Td>
              <Td className="text-xs text-muted">{b.errors.slice(0, 5).join(" · ") || "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
