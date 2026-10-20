import { useState } from "react";
import ModalOrSheet from "./ModalOrSheet";
import ImageUpload from "./ImageUpload";
import ChannelPicker from "./ChannelPicker";
import PhoneInput, { hydratePhone } from "./PhoneInput";
import {
  useCreateClient,
  useUpdateClient,
  useUploadClientLogo,
  useDeleteClientLogo,
  ApiError,
} from "../lib/api";
import type { Client, ClientStatus } from "../lib/types";

// F14.1.1 — canonical reusable client editor. BOTH entry points use this:
//   Clients list → "Editar"  (edit mode) and "Novo cliente" (create mode)
//   Client Detail → "Editar cliente" (edit mode)
// Single form state, single mutation path, image upload + channels included.

const blankForm = {
  name: "",
  brandColor: "#f06d55",
  status: "ACTIVE" as ClientStatus,
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  channels: ["Instagram"] as string[],
};

function initialForm(client?: Client | null) {
  if (!client) return blankForm;
  return {
    name: client.name,
    brandColor: client.brandColor ?? "#f06d55",
    status: client.status ?? "ACTIVE",
    primaryContactName: client.primaryContactName ?? "",
    primaryContactEmail: client.primaryContactEmail ?? "",
    primaryContactPhone: hydratePhone(client.primaryContactPhone),
    channels: client.channels ?? [],
  };
}

export interface ClientEditorProps {
  isOpen: boolean;
  onClose: () => void;
  /** null/undefined → create mode; otherwise the client being edited. */
  client?: Client | null;
  onSaved?: (saved: Client, created: boolean) => void;
}

export default function ClientEditor({ isOpen, onClose, client, onSaved }: ClientEditorProps) {
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const uploadLogo = useUploadClientLogo(client?.id ?? "");
  const deleteLogo = useDeleteClientLogo(client?.id ?? "");

  const isEdit = Boolean(client?.id);
  const isPending =
    createClient.isPending || updateClient.isPending || uploadLogo.isPending || deleteLogo.isPending;

  const close = () => onClose();

  const submit = async (
    form: ReturnType<typeof initialForm>,
    setErr: (m: string | null) => void,
  ) => {
    setErr(null);
    if (!form.name.trim()) {
      setErr("Informe o nome do cliente.");
      return;
    }
    const channels = form.channels.map((s) => s.trim()).filter(Boolean);
    const body = {
      name: form.name.trim(),
      brandColor: form.brandColor,
      status: form.status,
      primaryContactName: form.primaryContactName || undefined,
      primaryContactEmail: form.primaryContactEmail || undefined,
      primaryContactPhone: form.primaryContactPhone || undefined,
      channels,
    };
    try {
      if (client?.id) {
        const saved = await updateClient.mutateAsync({ id: client.id, body });
        close();
        onSaved?.(saved, false);
      } else {
        const saved = await createClient.mutateAsync(body);
        close();
        onSaved?.(saved, true);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao salvar cliente.");
    }
  };

  return (
    <ModalOrSheet
      isOpen={isOpen}
      onClose={close}
      title={isEdit ? "Editar cliente" : "Novo cliente"}
      subtitle={
        isEdit
          ? "Atualize os dados principais deste cliente"
          : "Cadastre uma nova marca ou empresa"
      }
      maxWidth="max-w-xl"
    >
      {/* Keyed per client so the form + ChannelPicker initialize synchronously
          with the correct values on open (no effect-order races). */}
      {isOpen && (
        <ClientEditorForm
          key={client?.id ?? "new"}
          client={client}
          isEdit={isEdit}
          isPending={isPending}
          uploadLogo={uploadLogo}
          deleteLogo={deleteLogo}
          onSubmit={submit}
          onClose={close}
        />
      )}
    </ModalOrSheet>
  );
}

function ClientEditorForm({
  client,
  isEdit,
  isPending,
  uploadLogo,
  deleteLogo,
  onSubmit,
  onClose,
}: {
  client?: Client | null;
  isEdit: boolean;
  isPending: boolean;
  uploadLogo: ReturnType<typeof useUploadClientLogo>;
  deleteLogo: ReturnType<typeof useDeleteClientLogo>;
  onSubmit: (form: ReturnType<typeof initialForm>, setErr: (m: string | null) => void) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => initialForm(client));
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof typeof blankForm>(k: K, v: (typeof blankForm)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3.5">
      {isEdit && (
        <div>
          <p className="label mb-2">Logo do cliente</p>
          <ImageUpload
            currentUrl={client?.logoUrl}
            initials={(form.name.trim() || client?.name || "?").slice(0, 2).toUpperCase()}
            shape="square"
            size="w-16 h-16"
            onUpload={(file) => uploadLogo.mutateAsync(file)}
            onDelete={() => deleteLogo.mutateAsync()}
            disabled={uploadLogo.isPending || deleteLogo.isPending}
          />
        </div>
      )}

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
          <PhoneInput
            className="input w-full"
            value={form.primaryContactPhone}
            onChange={(v) => set("primaryContactPhone", v)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Canais</label>
          <ChannelPicker value={form.channels} onChange={(next) => set("channels", next)} />
        </div>
      </div>

      {err && (
        <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
          {err}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
        <button className="btn-secondary btn-sm" onClick={onClose} disabled={isPending}>
          Cancelar
        </button>
        <button className="btn-primary btn-sm" onClick={() => onSubmit(form, setErr)} disabled={isPending}>
          {isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar"}
        </button>
      </div>
    </div>
  );
}
