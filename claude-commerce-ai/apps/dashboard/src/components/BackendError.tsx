import { BackendError } from "@/lib/api";

export function ErrorPanel({ error }: { error: unknown }) {
  const msg = error instanceof BackendError ? error.message : "Erro inesperado ao carregar dados.";
  const status = error instanceof BackendError ? error.status : undefined;
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-5 text-sm">
      <div className="font-semibold text-danger">Não foi possível carregar os dados{status ? ` (HTTP ${status})` : ""}</div>
      <p className="mt-1 text-text/80">{msg}</p>
      <p className="mt-2 text-muted">
        Rode <code>.\scripts\start.ps1</code> e <code>.\scripts\health.ps1</code>. Confira <code>BACKEND_URL</code> e{" "}
        <code>BACKEND_API_TOKEN</code> em <code>apps/dashboard/.env.local</code> (gerado pelo setup.ps1).
      </p>
    </div>
  );
}

/** Executa o carregamento e devolve [dados, erro] para renderização segura no servidor. */
export async function load<T>(p: Promise<T>): Promise<[T, null] | [null, unknown]> {
  try {
    return [await p, null];
  } catch (e) {
    return [null, e];
  }
}
