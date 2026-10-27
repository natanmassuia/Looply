import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useClients, useTeam, useCreateContent, type CreateContentPayload } from "../lib/api";
import { FORMAT_LABEL } from "../lib/format";
import { MVP } from "../config/mvp";
import type { ContentFormat } from "../lib/types";
import { Card, ErrorState, PageHeader, Spinner } from "../components/common";
import { ApiError } from "../lib/api";
import { IconPlus } from "../components/Icons";

const empty = {
  title: "",
  clientId: "",
  format: "POST" as ContentFormat,
  channel: "Instagram",
  responsibleId: "",
  publicationTarget: "",
  caption: "",
  mediaUrl: "",
};

export default function NewContent() {
  const navigate = useNavigate();
  const locationState = (useLocation().state as { clientId?: string } | null);
  const { data: clients, isLoading: cLoading } = useClients();
  const { data: team, isLoading: tLoading } = useTeam();
  const create = useCreateContent();
  const [form, setForm] = useState(() => ({
    ...empty,
    clientId: locationState?.clientId ?? "",
  }));
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setFormError(null);
    if (!form.title.trim() || !form.clientId || !form.caption.trim()) {
      setFormError("Preencha título, cliente e descrição.");
      return;
    }
    const payload: CreateContentPayload = {
      title: form.title.trim(),
      clientId: form.clientId,
      format: form.format,
      channel: form.channel || undefined,
      responsibleId: form.responsibleId || undefined,
      publicationTarget: form.publicationTarget
        ? new Date(`${form.publicationTarget}T12:00:00`).toISOString()
        : undefined,
      caption: form.caption.trim(),
      mediaUrl: form.mediaUrl || undefined,
      mediaType: form.mediaUrl ? "image/jpeg" : undefined,
    };
    try {
      const created = await create.mutateAsync(payload);
      navigate(`/contents/${(created as { id: string }).id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Falha ao criar demanda.");
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  if (cLoading || tLoading) return <Spinner label="Carregando…" />;

  return (
    <div>
      <PageHeader
        title="Nova demanda"
        subtitle="Crie uma demanda e envie para revisão interna"
        crumbs={[{ label: "Demandas", to: "/contents" }, { label: "Nova demanda" }]}
      />

      {clients && clients.length === 0 && (
        <Card className="mb-5">
          <ErrorState message="Cadastre um cliente primeiro em Clientes." />
        </Card>
      )}

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Main column: content info */}
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <h3 className="section-title mb-4">Informações básicas</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Título da demanda</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Ex.: Campanha Dia dos Pais"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Cliente</label>
                  <select
                    className="input"
                    value={form.clientId}
                    onChange={(e) => set("clientId", e.target.value)}
                  >
                    <option value="">Selecione um cliente…</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!MVP.hideEditorialFields && (
                  <div>
                    <label className="label">Tipo</label>
                    <select
                      className="input"
                      value={form.format}
                      onChange={(e) => set("format", e.target.value as ContentFormat)}
                    >
                      {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Descrição</label>
                <textarea
                  className="input min-h-[140px]"
                  value={form.caption}
                  onChange={(e) => set("caption", e.target.value)}
                  placeholder="Escreva a descrição da demanda…"
                />
              </div>

              <div>
                <label className="label">Anexo (link)</label>
                <input
                  className="input"
                  value={form.mediaUrl}
                  onChange={(e) => set("mediaUrl", e.target.value)}
                  placeholder="https://… (opcional)"
                />
                <p className="mt-1 text-xs text-[var(--looply-color-text-muted)]">
                  Em produção, aqui seria o upload do arquivo.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Side column: scheduling + actions */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h3 className="section-title mb-4">Detalhes</h3>
            <div className="space-y-4">
              {!MVP.hideEditorialFields && (
                <div>
                  <label className="label">Rede / Canal</label>
                  <input
                    className="input"
                    value={form.channel}
                    onChange={(e) => set("channel", e.target.value)}
                    placeholder="Instagram, TikTok…"
                  />
                </div>
              )}

              <div>
                <label className="label">Responsável</label>
                <select
                  className="input"
                  value={form.responsibleId}
                  onChange={(e) => set("responsibleId", e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {team?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {!MVP.hideEditorialFields && (
                <div>
                  <label className="label">Prazo</label>
                  <input
                    type="date"
                    className="input"
                    value={form.publicationTarget}
                    onChange={(e) => set("publicationTarget", e.target.value)}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card>
            {formError && (
              <div className="mb-4 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-danger)]">
                {formError}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                className="btn-primary btn-lg w-full"
                disabled={create.isPending}
              >
                <IconPlus className="h-4 w-4" />
                {create.isPending ? "Criando…" : "Criar e ir para revisão"}
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => navigate("/contents")}
              >
                Cancelar
              </button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
