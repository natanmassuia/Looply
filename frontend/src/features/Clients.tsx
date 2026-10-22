import { useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useClients, useDeleteClient, ApiError } from "../lib/api";
import type { Client, ClientStatus } from "../lib/types";
import { Card, EmptyState, ErrorState, PageHeader, SkeletonCards } from "../components/common";
import { IconPlus, IconEdit, IconTrash, IconChevronDown, IconX, IconMoreVertical } from "../components/Icons";
import ModalOrSheet from "../components/ModalOrSheet";
import ClientEditor from "../components/ClientEditor";
import ClientDemandsModal from "./ClientDemandsModal";

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

const CHANNEL_OPTIONS = ["Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "WhatsApp", "E-mail", "Site"];

type SortKey = "name-asc" | "name-desc" | "demand-desc" | "demand-asc";

function parseSort(v: string | null): SortKey {
  return (["name-asc", "name-desc", "demand-desc", "demand-asc"] as SortKey[]).includes(v as SortKey)
    ? (v as SortKey)
    : "name-asc";
}

export default function Clients() {
  const { data: clients, isLoading, isError, error } = useClients();
  const deleteClient = useDeleteClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const demandActivity = searchParams.get("demandActivity") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const sort = parseSort(searchParams.get("sort"));
  const view = searchParams.get("view") === "list" ? "list" : "grid";

  const [editor, setEditor] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [demandsModalClient, setDemandsModalClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const openCreate = () => setEditor({ open: true, client: null });
  const openEdit = (c: Client) => setEditor({ open: true, client: c });
  const closeForm = () => setEditor({ open: false, client: null });

  const notifySaved = (clientName: string, created: boolean) => {
    setSuccessNotice(`Cliente "${clientName}" ${created ? "cadastrado" : "atualizado"} com sucesso.`);
    setTimeout(() => setSuccessNotice(null), 4000);
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

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    setSearchParams(next, { replace: true });
    setSearch("");
  };

  // Table header sort: toggles the relevant sort key for the clicked column.
  const toggleSort = (col: "name" | "demand") => {
    if (col === "name") setParam("sort", sort === "name-asc" ? "name-desc" : "name-asc");
    else setParam("sort", sort === "demand-desc" ? "demand-asc" : "demand-desc");
  };

  const appliedFilterCount =
    (status ? 1 : 0) + (demandActivity ? 1 : 0) + (channel ? 1 : 0);

  const filteredClients = useMemo(() => {
    const list = (clients ?? []).filter((c) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          c.name.toLowerCase().includes(q) ||
          (c.primaryContactName?.toLowerCase().includes(q) ?? false) ||
          (c.primaryContactEmail?.toLowerCase().includes(q) ?? false) ||
          c.channels.some((ch) => ch.toLowerCase().includes(q));
        if (!match) return false;
      }
      // Status
      if (status && c.status !== status) return false;
      // Demand activity
      if (demandActivity === "pending" && (c.activeContents ?? 0) <= 0) return false;
      if (demandActivity === "none" && (c.activeContents ?? 0) > 0) return false;
      // Channel
      if (channel && !c.channels.some((ch) => ch.toLowerCase() === channel.toLowerCase())) return false;
      return true;
    });
    // Sort
    const sorted = [...list];
    switch (sort) {
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "demand-desc":
        sorted.sort((a, b) => (b.activeContents ?? 0) - (a.activeContents ?? 0));
        break;
      case "demand-asc":
        sorted.sort((a, b) => (a.activeContents ?? 0) - (b.activeContents ?? 0));
        break;
      default: // name-asc
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [clients, search, status, demandActivity, channel, sort]);

  // Unique channels across all clients (predefined + custom).
  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    (clients ?? []).forEach((c) => c.channels.forEach((ch) => set.add(ch)));
    return [...set].sort((a, b) => {
      const ai = CHANNEL_OPTIONS.indexOf(a);
      const bi = CHANNEL_OPTIONS.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [clients]);

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

      {/* Quick Edit / Create — canonical client editor (single contract) */}
      <ClientEditor
        isOpen={editor.open}
        client={editor.client}
        onClose={closeForm}
        onSaved={(saved, created) => notifySaved(saved.name, created)}
      />

      {/* Delete Confirmation Modal */}
      <ModalOrSheet
        isOpen={!!deletingClient}
        onClose={() => setDeletingClient(null)}
        title="Excluir cliente"
        subtitle={`Confirma a exclusão de "${deletingClient?.name}"?`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--looply-color-text-muted)] leading-relaxed">
            Esta ação removerá o cliente e todo o histórico associado. Esta operação não pode ser desfeita.
          </p>
          {deleteErr && (
            <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
              {deleteErr}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-3">
            <button
              className="btn-secondary btn-sm"
              onClick={() => setDeletingClient(null)}
              disabled={deleteClient.isPending}
            >
              Cancelar
            </button>
            <button
              className="btn-sm rounded-lg bg-[var(--looply-color-status-danger)] text-white hover:opacity-90 font-medium disabled:opacity-50"
              onClick={confirmDelete}
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? "Excluindo…" : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      </ModalOrSheet>

      {/* Client Active Demands Modal */}
      <ClientDemandsModal
        client={demandsModalClient}
        isOpen={!!demandsModalClient}
        onClose={() => setDemandsModalClient(null)}
      />

      {/* Search + Filter toolbar */}
      {clients && clients.length > 0 && (
        <>
        <div className="mb-5 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <input
                className="input pl-9"
                placeholder="Buscar cliente por nome, contato, canal…"
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

          {/* Quick filter toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["", "Todos"],
                  ["ACTIVE", "Ativos"],
                  ["INACTIVE", "Inativos"],
                  ["PROSPECT", "Prospect"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setParam("status", value)}
                  className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                    status === value
                      ? "border-[var(--looply-color-text-brand)] bg-[var(--looply-color-text-brand)]/10 text-[var(--looply-color-text-brand)]"
                      : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={demandActivity === "pending"}
                onClick={() => setParam("demandActivity", demandActivity === "pending" ? "" : "pending")}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                  demandActivity === "pending"
                    ? "border-[var(--looply-color-text-brand)] bg-[var(--looply-color-text-brand)]/10 text-[var(--looply-color-text-brand)]"
                    : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                }`}
              >
                Com demandas pendentes
              </button>
            </div>

            <button
              type="button"
              aria-expanded={moreFiltersOpen}
              onClick={() => setMoreFiltersOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--looply-color-border-default)] px-3 py-1 text-[12.5px] font-medium text-[var(--looply-color-text-muted)] transition-colors hover:text-[var(--looply-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
            >
              <IconChevronDown className="h-3.5 w-3.5" />
              Mais filtros
              {appliedFilterCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--looply-color-text-brand)] px-1 text-[10px] font-bold text-white">
                  {appliedFilterCount}
                </span>
              )}
            </button>

            <div className="relative">
              <select
                aria-label="Ordenar clientes"
                value={sort}
                onChange={(e) => setParam("sort", e.target.value)}
                className="input w-auto min-w-[160px] text-[12.5px]"
              >
                <option value="name-asc">Nome A–Z</option>
                <option value="name-desc">Nome Z–A</option>
                <option value="demand-desc">Mais demandas</option>
                <option value="demand-asc">Menos demandas</option>
              </select>
            </div>

            {/* View toggle: card grid ↔ sortable list */}
            <div
              role="group"
              aria-label="Modo de visualização"
              className="ml-auto inline-flex items-center rounded-full border border-[var(--looply-color-border-default)] p-0.5"
            >
              <button
                type="button"
                aria-pressed={view === "grid"}
                onClick={() => setParam("view", "")}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                  view === "grid"
                    ? "bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)]"
                    : "text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
                Cards
              </button>
              <button
                type="button"
                aria-pressed={view === "list"}
                onClick={() => setParam("view", "list")}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                  view === "list"
                    ? "bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)]"
                    : "text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3.5" y1="6" x2="3.5" y2="6" />
                  <line x1="3.5" y1="12" x2="3.5" y2="12" />
                  <line x1="3.5" y1="18" x2="3.5" y2="18" />
                </svg>
                Lista
              </button>
            </div>

            {(appliedFilterCount > 0 || search) && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--looply-color-action-primary)] hover:underline"
              >
                <IconX className="h-3.5 w-3.5" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* More filters sheet */}
        <ModalOrSheet
          isOpen={moreFiltersOpen}
          onClose={() => setMoreFiltersOpen(false)}
          title="Filtrar clientes"
          subtitle="Combinar com busca e status"
          maxWidth="max-w-sm"
        >
          <div className="space-y-4">
            <div>
              <label className="label">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["", "Todos"],
                    ["ACTIVE", "Ativos"],
                    ["INACTIVE", "Inativos"],
                    ["PROSPECT", "Prospect"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    onClick={() => setParam("status", value)}
                    className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                      status === value
                        ? "border-[var(--looply-color-text-brand)] bg-[var(--looply-color-text-brand)]/10 text-[var(--looply-color-text-brand)]"
                        : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Demandas</label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["", "Todas"],
                    ["pending", "Com pendentes"],
                    ["none", "Sem pendentes"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={demandActivity === value}
                    onClick={() => setParam("demandActivity", value)}
                    className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                      demandActivity === value
                        ? "border-[var(--looply-color-text-brand)] bg-[var(--looply-color-text-brand)]/10 text-[var(--looply-color-text-brand)]"
                        : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Canal</label>
              <select
                aria-label="Filtrar por canal"
                value={channel}
                onChange={(e) => setParam("channel", e.target.value)}
                className="input w-full"
              >
                <option value="">Todos os canais</option>
                {availableChannels.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end border-t border-[var(--looply-color-border-default)] pt-3">
              <button type="button" className="btn-primary btn-sm" onClick={() => setMoreFiltersOpen(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </ModalOrSheet>
        </>
      )}

      {isLoading && <SkeletonCards count={6} />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {clients && clients.length === 0 && (
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Cadastre seu primeiro cliente para começar a organizar demandas e publicações."
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
        view === "list" ? (
          <ClientsTable
            clients={filteredClients}
            sort={sort}
            onToggleSort={toggleSort}
            onEdit={openEdit}
            onDelete={(c) => {
              setDeleteErr(null);
              setDeletingClient(c);
            }}
            onOpenDemands={setDemandsModalClient}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
          />
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((c) => {
            const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.ACTIVE;
            const demandCount = c.activeContents ?? 0;
            const demandCountText = demandCount === 1 ? "1 demanda" : `${demandCount} demandas`;

            return (
              <Card key={c.id} className="transition-shadow hover:shadow-looply-md">
                <div className="flex items-start gap-3">
                  {c.logoUrl ? (
                    <img
                      src={c.logoUrl}
                      alt={c.name}
                      className="h-10 w-10 shrink-0 rounded-xl object-cover border border-[var(--looply-color-border-default)]"
                    />
                  ) : (
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: c.brandColor ?? "#475569" }}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
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
                  <div className="flex justify-between items-center">
                    <dt className="text-[var(--looply-color-text-muted)]">Demandas ativas</dt>
                    <dd>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDemandsModalClient(c);
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-[var(--looply-color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] rounded px-1 -mx-1 transition-colors"
                        aria-label={`${demandCountText} ativas de ${c.name}`}
                      >
                        <span>{demandCountText}</span>
                        <span aria-hidden="true">→</span>
                      </button>
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

                {/* Card Actions: Open, Edit & Delete */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--looply-color-border-default)] pt-3">
                  <Link
                    to={`/clients/${c.id}`}
                    className="btn-ghost btn-sm font-semibold text-[var(--looply-color-action-primary)] hover:underline"
                  >
                    Abrir
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost btn-sm flex items-center gap-1"
                      aria-label={`Editar ${c.name}`}
                      onClick={() => openEdit(c)}
                    >
                      <IconEdit className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>

                    {/* Overflow menu — keeps the destructive "Excluir" off the
                        card surface (one click now opens the menu, not delete). */}
                    <div className="relative">
                      <button
                        type="button"
                        className="btn-ghost btn-sm px-1.5"
                        aria-label={`Mais ações para ${c.name}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === c.id}
                        onClick={() =>
                          setOpenMenuId((prev) => (prev === c.id ? null : c.id))
                        }
                      >
                        <IconMoreVertical className="h-4 w-4" />
                      </button>

                      {openMenuId === c.id && (
                        <>
                          <button
                            type="button"
                            aria-hidden="true"
                            tabIndex={-1}
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div
                            role="menu"
                            className="absolute bottom-full right-0 z-20 mb-1 min-w-[160px] overflow-hidden rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] py-1 shadow-[var(--looply-shadow-lg)]"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-status-danger)]/10"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeleteErr(null);
                                setDeletingClient(c);
                              }}
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        )
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.04em] transition-colors hover:text-[var(--looply-color-text-primary)] ${
        active ? "text-[var(--looply-color-text-primary)]" : "text-[var(--looply-color-text-muted)]"
      } ${align === "right" ? "ml-auto" : ""}`}
    >
      <span>{label}</span>
      <span aria-hidden="true" className={active ? "opacity-100" : "opacity-30"}>
        {active && dir === "asc" ? "↑" : "↓"}
      </span>
    </button>
  );
}

function ClientsTable({
  clients,
  sort,
  onToggleSort,
  onEdit,
  onDelete,
  onOpenDemands,
  openMenuId,
  setOpenMenuId,
}: {
  clients: Client[];
  sort: SortKey;
  onToggleSort: (col: "name" | "demand") => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
  onOpenDemands: (c: Client) => void;
  openMenuId: string | null;
  setOpenMenuId: Dispatch<SetStateAction<string | null>>;
}) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--looply-color-border-default)] text-left">
              <th className="px-4 py-2.5">
                <SortHeader
                  label="Cliente"
                  active={sort === "name-asc" || sort === "name-desc"}
                  dir={sort === "name-asc" ? "asc" : "desc"}
                  onClick={() => onToggleSort("name")}
                />
              </th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--looply-color-text-muted)]">
                Status
              </th>
              <th className="px-4 py-2.5">
                <SortHeader
                  label="Demandas"
                  active={sort === "demand-asc" || sort === "demand-desc"}
                  dir={sort === "demand-asc" ? "asc" : "desc"}
                  onClick={() => onToggleSort("demand")}
                />
              </th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--looply-color-text-muted)]">
                Canais
              </th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--looply-color-text-muted)]">
                E-mail
              </th>
              <th className="w-10 px-4 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--looply-color-border-default)]">
            {clients.map((c) => {
              const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.ACTIVE;
              const demandCount = c.activeContents ?? 0;
              const demandCountText = demandCount === 1 ? "1 demanda" : `${demandCount} demandas`;
              return (
                <tr key={c.id} className="transition-colors hover:bg-[var(--looply-color-bg-subtle)]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-lg object-cover border border-[var(--looply-color-border-default)]"
                        />
                      ) : (
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: c.brandColor ?? "#475569" }}
                        >
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <Link
                          to={`/clients/${c.id}`}
                          className="block truncate font-semibold text-[var(--looply-color-text-primary)] hover:text-[var(--looply-color-action-primary)] hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.primaryContactName && (
                          <div className="truncate text-xs text-[var(--looply-color-text-muted)]">
                            {c.primaryContactName}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenDemands(c)}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--looply-color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] rounded px-1 -mx-1"
                      aria-label={`${demandCountText} ativas de ${c.name}`}
                    >
                      <span className="tabular-nums">{demandCount}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-[var(--looply-color-text-primary)]">
                    {c.channels.join(", ") || "—"}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-[var(--looply-color-text-muted)]">
                    {c.primaryContactEmail || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="relative flex justify-end">
                      <button
                        type="button"
                        className="btn-ghost btn-sm px-1.5"
                        aria-label={`Mais ações para ${c.name}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === c.id}
                        onClick={() => setOpenMenuId((prev) => (prev === c.id ? null : c.id))}
                      >
                        <IconMoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === c.id && (
                        <>
                          <button
                            type="button"
                            aria-hidden="true"
                            tabIndex={-1}
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] py-1 shadow-[var(--looply-shadow-lg)]"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
                              onClick={() => {
                                setOpenMenuId(null);
                                onEdit(c);
                              }}
                            >
                              <IconEdit className="h-3.5 w-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-status-danger)]/10"
                              onClick={() => {
                                setOpenMenuId(null);
                                onDelete(c);
                              }}
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
