import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useClient, useContents, useDeleteClient } from "../lib/api";
import { Card, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import ModalOrSheet from "../components/ModalOrSheet";
import ClientEditor from "../components/ClientEditor";
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconMail,
  IconPhone,
  IconUser,
  IconPlus,
} from "../components/Icons";
import type { ClientStatus } from "../lib/types";
import { FORMAT_LABEL } from "../lib/format";

const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  PROSPECT: "Prospect",
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading, error } = useClient(id || "");
  const { data: contents } = useContents();
  const deleteClientMutation = useDeleteClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const openEdit = () => {
    setIsEditOpen(true);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteClientMutation.mutateAsync(id);
      navigate("/clients");
    } catch {
      // handled
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Carregando dados do cliente..." />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
        >
          <IconArrowLeft className="h-4 w-4" />
          Voltar para Clientes
        </Link>
        <Card className="text-center py-12">
          <p className="text-sm font-semibold text-[var(--looply-color-text-primary)]">
            Cliente não encontrado
          </p>
          <p className="mt-1 text-xs text-[var(--looply-color-text-muted)]">
            O cliente solicitado não existe ou foi removido.
          </p>
          <div className="mt-4">
            <Link to="/clients" className="btn-primary text-xs">
              Ver todos os clientes
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const clientDemands = (contents || []).filter((c) => c.clientId === client.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Back Link */}
      <div>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)] transition-colors"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Clientes / <span className="text-[var(--looply-color-text-primary)]">{client.name}</span>
        </Link>
      </div>

      {/* Header Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {client.logoUrl ? (
            <img
              src={client.logoUrl}
              alt={client.name}
              className="h-12 w-12 shrink-0 rounded-xl object-cover border border-[var(--looply-color-border-default)]"
            />
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-xs"
              style={{ backgroundColor: client.brandColor || "#F06D55" }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--looply-color-text-primary)]">
                {client.name}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                  client.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : client.status === "PROSPECT"
                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    : "bg-zinc-500/10 text-zinc-600 border border-zinc-500/20"
                }`}
              >
                {CLIENT_STATUS_LABEL[client.status]}
              </span>
            </div>
            <p className="text-xs text-[var(--looply-color-text-muted)] mt-0.5">
              Cadastrado em {new Date(client.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openEdit}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <IconEdit className="h-3.5 w-3.5" />
            Editar cliente
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            className="btn-ghost text-xs text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5"
          >
            <IconTrash className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contato Principal */}
        <Card className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
            Contato Principal
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--looply-color-text-primary)]">
              <IconUser className="h-4 w-4 text-[var(--looply-color-text-muted)]" />
              <span>{client.primaryContactName || "Não informado"}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--looply-color-text-primary)]">
              <IconMail className="h-4 w-4 text-[var(--looply-color-text-muted)]" />
              <span>{client.primaryContactEmail || "Não informado"}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--looply-color-text-primary)]">
              <IconPhone className="h-4 w-4 text-[var(--looply-color-text-muted)]" />
              <span>{client.primaryContactPhone || "Não informado"}</span>
            </div>
          </div>
        </Card>

        {/* Canais Atendidos */}
        <Card className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
            Canais Atendidos
          </h3>
          {client.channels && client.channels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {client.channels.map((ch) => (
                <span
                  key={ch}
                  className="rounded-md bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--looply-color-text-primary)] border border-[var(--looply-color-border-default)]"
                >
                  {ch}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--looply-color-text-muted)]">
              Nenhum canal configurado.
            </p>
          )}
        </Card>

        {/* Resumo de Demandas */}
        <Card className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
            Resumo Operacional
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--looply-color-text-muted)]">Demandas ativas</span>
            <span className="text-sm font-bold text-[var(--looply-color-text-primary)]">
              {clientDemands.filter((d) => d.status !== "PUBLISHED" && d.lifecycleStatus !== "CANCELLED").length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--looply-color-text-muted)]">Total de demandas</span>
            <span className="text-sm font-bold text-[var(--looply-color-text-primary)]">
              {clientDemands.length}
            </span>
          </div>
        </Card>
      </div>

      {/* Demandas do Cliente */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="section-title">Demandas do Cliente</h3>
            <p className="text-xs text-[var(--looply-color-text-muted)]">
              Lista de todas as demandas vinculadas a este cliente.
            </p>
          </div>
          <Link
            to="/contents/new"
            state={{ clientId: client.id }}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Nova demanda
          </Link>
        </div>

        {clientDemands.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--looply-color-border-default)] py-8 text-center">
            <p className="text-xs text-[var(--looply-color-text-muted)]">
              Nenhuma demanda criada para este cliente ainda.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--looply-color-border-default)]">
            {clientDemands.map((demand) => (
              <Link
                key={demand.id}
                to={`/contents/${demand.id}`}
                className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-[var(--looply-color-bg-subtle)] transition-colors group"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="text-xs font-semibold text-[var(--looply-color-text-primary)] group-hover:text-brand-600 truncate">
                    {demand.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--looply-color-text-muted)]">
                    <span>{FORMAT_LABEL[demand.format]}</span>
                    <span>·</span>
                    <span>{new Date(demand.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <StatusPill status={demand.status} />
                  <span className="text-xs text-[var(--looply-color-text-muted)] group-hover:text-[var(--looply-color-text-primary)]">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Edit Client — canonical editor (same component as Clients list) */}
      <ClientEditor
        isOpen={isEditOpen}
        client={client}
        onClose={() => setIsEditOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ModalOrSheet
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Excluir Cliente"
        subtitle={`Tem certeza que deseja excluir ${client.name}?`}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--looply-color-text-muted)]">
            Esta ação não pode ser desfeita. Todas as demandas e agendamentos associados a este cliente serão preservados ou arquivados.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--looply-color-border-default)]">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteClientMutation.isPending}
              className="btn-primary text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteClientMutation.isPending ? "Excluindo..." : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      </ModalOrSheet>
    </div>
  );
}
