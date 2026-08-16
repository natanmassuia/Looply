import { useState } from "react";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, ApiError } from "../lib/api";
import type { Client, ClientStatus } from "../lib/types";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import { IconPlus, IconX, IconEdit, IconTrash } from "../components/Icons";

const CLIENT_STATUS: Record<ClientStatus, { label: string; cls: string }> = {
  ACTIVE: {
    label: "Ativo",
    cls: "bg-[var(--looply-color-status-success)]/10 text-[var(--looply-color-status-success)] ring-[var(--looply-color-status-success)]/30",
  },
  INACTIVE: {
    label: "Inativo",
    cls: "bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-muted)] ring-[var(--looply-color-border-default)]",
  },
  PROSPECT: {
    label: "Prospect",
    cls: "bg-[var(--looply-color-status-warning)]/10 text-[var(--looply-color-status-warning)] ring-[var(--looply-color-status-warning)]/30",
  },
};

const blankForm = {
  name: "",
  brandColor: "#2563eb",
  status: "ACTIVE" as ClientStatus,
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  channels: "Instagram",
};

export default function Clients() {
  const { data: clients, isLoading, isError, error } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blankForm);
  const [err, setErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const set = <K extends keyof typeof blankForm>(k: K, v: (typeof blankForm)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditingClient(null);
    setForm(blankForm);
    setErr(null);
    setShowForm(true);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setForm({
      name: c.name,
      brandColor: c.brandColor ?? "#2563eb",
      status: c.status ?? "ACTIVE",
      primaryContactName: c.primaryContactName ?? "",
      primaryContactEmail: c.primaryContactEmail ?? "",
      primaryContactPhone: c.primaryContactPhone ?? "",
      channels: (c.channels ?? []).join(", "),
    });
    setErr(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingClient(null);
    setErr(null);
  };

  const submit = async () => {
    setErr(null);
    setSuccessNotice(null);
    if (!form.name.trim()) {
      setErr("Informe o nome do cliente.");
      return;
    }
    const channels = form.channels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingClient) {
        await updateClient.mutateAsync({
          id: editingClient.id,
          body: {
            name: form.name.trim(),
            brandColor: form.brandColor,
            status: form.status,
            primaryContactName: form.primaryContactName || undefined,
            primaryContactEmail: form.primaryContactEmail || undefined,
            primaryContactPhone: form.primaryContactPhone || undefined,
            channels,
          },
        });
        const clientName = form.name.trim();
        closeForm();
        setSuccessNotice(`Cliente "${clientName}" atualizado com sucesso.`);
        setTimeout(() => setSuccessNotice(null), 4000);
      } else {
        await createClient.mutateAsync({
          name: form.name.trim(),
          brandColor: form.brandColor,
          status: form.status,
          primaryContactName: form.primaryContactName || undefined,
          primaryContactEmail: form.primaryContactEmail || undefined,
          primaryContactPhone: form.primaryContactPhone || undefined,
          channels,
        });
        const clientName = form.name.trim();
        closeForm();
        setSuccessNotice(`Cliente "${clientName}" cadastrado com sucesso.`);
        setTimeout(() => setSuccessNotice(null), 4000);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao salvar cliente.");
    }
  };

  const confirmDelete = async () => {
    if (!deletingClient) return;
    setDeleteErr(null);
    try {
      await deleteClient.mutateAsync(deletingClient.id);
      const name = deletingClient.name;
      setDeletingClient(null);
      setSuccessNotice(`Cliente "${name}" excluído com sucesso.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (e) {
      setDeleteErr(e instanceof ApiError ? e.message : "Falha ao excluir cliente.");
    }
  };

  const filteredClients = (clients ?? []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.primaryContactName?.toLowerCase().includes(q) ?? false) ||
      (c.primaryContactEmail?.toLowerCase().includes(q) ?? false) ||
      c.channels.some((ch) => ch.toLowerCase().includes(q))
    );
  });

  const isPending = createClient.isPending || updateClient.isPending;

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Marcas e empresas atendidas"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <IconPlus className="h-4 w-4" />
            Novo cliente
          </button>
        }
      />

      {successNotice && (
        <div className="mb-5 rounded-lg bg-[var(--looply-color-status-success)]/10 px-3.5 py-2.5 text-sm text-[var(--looply-color-status-success)]">
          {successNotice}
        </div>
      )}

      {showForm && (
        <Card className="mb-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">
              {editingClient ? "Editar cliente" : "Novo cliente"}
            </h3>
            <button className="btn-ghost btn-sm" onClick={closeForm} aria-label="Fechar formulário">
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nome</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex.: Restaurante Aurora"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Cor da marca</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded-lg border border-[var(--looply-color-border-default)]"
                  value={form.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)}
                />
                <span className="text-xs font-mono text-[var(--looply-color-text-muted)]">
                  {form.brandColor}
                </span>
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => set("status", e.target.value as ClientStatus)}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="PROSPECT">Prospect</option>
              </select>
            </div>
            <div>
              <label className="label">Contato principal</label>
              <input
                className="input"
                value={form.primaryContactName}
                onChange={(e) => set("primaryContactName", e.target.value)}
              />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                value={form.primaryContactEmail}
                onChange={(e) => set("primaryContactEmail", e.target.value)}
                type="email"
              />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input
                className="input"
                value={form.primaryContactPhone}
                onChange={(e) => set("primaryContactPhone", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Canais (separados por vírgula)</label>
              <input
                className="input"
                value={form.channels}
                onChange={(e) => set("channels", e.target.value)}
                placeholder="Instagram, TikTok"
              />
            </div>
          </div>
          {err && (
            <div className="mt-3 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
              {err}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
            <button className="btn-secondary" onClick={closeForm}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={isPending} onClick={submit}>
              {isPending
                ? "Salvando…"
                : editingClient
                  ? "Salvar alterações"
                  : "Salvar cliente"}
            </button>
          </div>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-looply-lg">
            <h3 className="section-title text-[var(--looply-color-status-danger)]">
              Excluir cliente
            </h3>
            <p className="mt-2 text-sm text-[var(--looply-color-text-primary)]">
              Tem certeza que deseja excluir o cliente{" "}
              <strong className="font-semibold">{deletingClient.name}</strong>?
            </p>
            <p className="mt-1 text-xs text-[var(--looply-color-text-muted)]">
              Esta ação remove o cadastro do cliente. Clientes com conteúdos vinculados não podem ser excluídos.
            </p>
            {deleteErr && (
              <div className="mt-3 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
                {deleteErr}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
              <button
                type="button"
                className="btn-secondary"
                disabled={deleteClient.isPending}
                onClick={() => {
                  setDeletingClient(null);
                  setDeleteErr(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleteClient.isPending}
                onClick={confirmDelete}
              >
                {deleteClient.isPending ? "Excluindo…" : "Excluir cliente"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Search toolbar */}
      {clients && clients.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <input
              className="input pl-9"
              placeholder="Buscar clientes por nome, contato ou canal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--looply-color-text-muted)]">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {isLoading && <Spinner label="Carregando clientes…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {clients && clients.length === 0 && (
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Cadastre seu primeiro cliente para começar a organizar jobs e publicações."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <IconPlus className="h-4 w-4" />
              Novo cliente
            </button>
          }
        />
      )}

      {clients && clients.length > 0 && filteredClients.length === 0 && (
        <EmptyState
          title="Nenhum resultado encontrado"
          description={`Nenhum cliente corresponde ao termo "${search}".`}
        />
      )}

      {clients && clients.length > 0 && filteredClients.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((c) => {
            const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.ACTIVE;
            return (
              <Card key={c.id} className="transition-shadow hover:shadow-looply-md">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: c.brandColor ?? "#475569" }}
                  >
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--looply-color-text-primary)]">
                        {c.name}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    {c.primaryContactName && (
                      <div className="mt-0.5 text-xs text-[var(--looply-color-text-muted)]">
                        {c.primaryContactName}
                      </div>
                    )}
                  </div>
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--looply-color-text-muted)]">Jobs ativos</dt>
                    <dd className="font-semibold text-[var(--looply-color-text-primary)]">
                      {c.activeContents ?? 0}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--looply-color-text-muted)]">Canais</dt>
                    <dd className="text-[var(--looply-color-text-primary)]">
                      {c.channels.join(", ") || "—"}
                    </dd>
                  </div>
                  {c.primaryContactEmail && (
                    <div className="flex justify-between">
                      <dt className="text-[var(--looply-color-text-muted)]">E-mail</dt>
                      <dd className="truncate text-[var(--looply-color-text-primary)]">
                        {c.primaryContactEmail}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Card Actions: Edit & Delete */}
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-3">
                  <button
                    type="button"
                    className="btn-ghost btn-sm flex items-center gap-1"
                    aria-label={`Editar ${c.name}`}
                    onClick={() => openEdit(c)}
                  >
                    <IconEdit className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm flex items-center gap-1 text-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-status-danger)]/10"
                    aria-label={`Excluir ${c.name}`}
                    onClick={() => {
                      setDeleteErr(null);
                      setDeletingClient(c);
                    }}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
