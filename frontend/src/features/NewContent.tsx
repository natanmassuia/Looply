import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useClients, useTeam, useCreateContent, type CreateContentPayload } from "../lib/api";
import { FORMAT_LABEL } from "../lib/format";
import type { ContentFormat } from "../lib/types";
import { Card, ErrorState, PageHeader, Spinner } from "../components/common";
import { ApiError } from "../lib/api";

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
  const { data: clients, isLoading: cLoading } = useClients();
  const { data: team, isLoading: tLoading } = useTeam();
  const create = useCreateContent();
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim() || !form.clientId || !form.caption.trim()) {
      setFormError("Preencha título, cliente e legenda.");
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
      setFormError(err instanceof ApiError ? err.message : "Falha ao criar conteúdo.");
    }
  };

  if (cLoading || tLoading) return <Spinner label="Carregando…" />;

  return (
    <div className="mx-auto max-w-3xl px-6 py-7">
      <PageHeader
        title="Novo conteúdo"
        crumbs={[{ label: "Conteúdos", to: "/contents" }, { label: "Novo conteúdo" }]}
      />

      {clients && clients.length === 0 && <ErrorState message="Cadastre um cliente primeiro." />}

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Título</label>
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
                <option value="">Selecione…</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Formato</label>
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Rede / Canal</label>
              <input
                className="input"
                value={form.channel}
                onChange={(e) => set("channel", e.target.value)}
                placeholder="Instagram, TikTok…"
              />
            </div>
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
          </div>

          <div>
            <label className="label">Data prevista de publicação</label>
            <input
              type="date"
              className="input"
              value={form.publicationTarget}
              onChange={(e) => set("publicationTarget", e.target.value)}
            />
          </div>

          <div>
            <label className="label">Legenda</label>
            <textarea
              className="input min-h-[120px]"
              value={form.caption}
              onChange={(e) => set("caption", e.target.value)}
              placeholder="Legenda do conteúdo…"
            />
          </div>

          <div>
            <label className="label">URL da mídia (demo)</label>
            <input
              className="input"
              value={form.mediaUrl}
              onChange={(e) => set("mediaUrl", e.target.value)}
              placeholder="https://… (opcional)"
            />
          </div>

          {formError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => navigate("/contents")}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? "Criando…" : "Criar conteúdo"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
