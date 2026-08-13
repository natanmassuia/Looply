import { useState } from "react";
import { useClients, useCreateClient, ApiError } from "../lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import { IconPlus } from "../components/Icons";

const CLIENT_STATUS = {
  ACTIVE: { label: "Ativo", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  INACTIVE: { label: "Inativo", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  PROSPECT: { label: "Prospect", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
} as const;

const blank = {
  name: "",
  brandColor: "#2563eb",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  channels: "Instagram",
};

export default function Clients() {
  const { data: clients, isLoading, isError, error } = useClients();
  const create = useCreateClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof typeof blank>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErr(null);
    if (!form.name.trim()) {
      setErr("Informe o nome do cliente.");
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        brandColor: form.brandColor,
        primaryContactName: form.primaryContactName || undefined,
        primaryContactEmail: form.primaryContactEmail || undefined,
        primaryContactPhone: form.primaryContactPhone || undefined,
        channels: form.channels.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setForm(blank);
      setShowForm(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao cadastrar cliente.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-7">
      <PageHeader
        title="Clientes"
        crumbs={[{ label: "Clientes" }]}
        actions={
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            <IconPlus className="h-4 w-4" />
            Novo cliente
          </button>
        }
      />

      {showForm && (
        <Card className="mb-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className="label">Cor da marca</label>
              <input type="color" className="h-10 w-16 rounded border border-slate-300" value={form.brandColor} onChange={(e) => set("brandColor", e.target.value)} />
            </div>
            <div>
              <label className="label">Contato principal</label>
              <input className="input" value={form.primaryContactName} onChange={(e) => set("primaryContactName", e.target.value)} />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" value={form.primaryContactEmail} onChange={(e) => set("primaryContactEmail", e.target.value)} />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.primaryContactPhone} onChange={(e) => set("primaryContactPhone", e.target.value)} />
            </div>
            <div>
              <label className="label">Canais (vírgula)</label>
              <input className="input" value={form.channels} onChange={(e) => set("channels", e.target.value)} />
            </div>
          </div>
          {err && <div className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={create.isPending} onClick={submit}>
              {create.isPending ? "Salvando…" : "Salvar cliente"}
            </button>
          </div>
        </Card>
      )}

      {isLoading && <Spinner label="Carregando clientes…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {clients && clients.length === 0 && (
        <EmptyState title="Nenhum cliente" description="Cadastre um cliente para começar." />
      )}
      {clients && clients.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.ACTIVE;
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: c.brandColor ?? "#475569" }}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.primaryContactName ?? "—"}</div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Conteúdos ativos</dt>
                    <dd className="font-medium text-slate-700">{c.activeContents ?? 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Canais</dt>
                    <dd className="text-slate-700">{c.channels.join(", ") || "—"}</dd>
                  </div>
                  {c.primaryContactEmail && (
                    <div className="flex justify-between">
                      <dt className="text-slate-400">E-mail</dt>
                      <dd className="truncate text-slate-700">{c.primaryContactEmail}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
