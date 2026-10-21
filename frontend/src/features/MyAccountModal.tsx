import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMe, useUpdateProfile, useUploadUserAvatar, useDeleteUserAvatar } from "../lib/api";
import ModalOrSheet from "../components/ModalOrSheet";
import ImageUpload from "../components/ImageUpload";
import PhoneInput, { hydratePhone } from "../components/PhoneInput";
import { initials } from "../lib/format";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  CONTENT_MANAGER: "Gerente de Conteúdo",
  EDITOR: "Editor",
  SOCIAL_MEDIA: "Social Media",
  DESIGNER: "Designer",
};

export interface MyAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MyAccountModal({ isOpen, onClose }: MyAccountModalProps) {
  const { data: meData } = useMe();
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadUserAvatar();
  const deleteAvatarMutation = useDeleteUserAvatar();

  const user = meData?.user;
  const activeRole = meData?.memberships?.find(
    (m) => m.companyId === meData.activeCompanyId
  )?.role;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
      setPhone(hydratePhone(user.phone));
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError("Nome completo é obrigatório.");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || null,
      });
      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar perfil.";
      setError(msg);
    }
  };

  return (
    <ModalOrSheet
      isOpen={isOpen}
      onClose={() => {
        setIsEditing(false);
        setError(null);
        onClose();
      }}
      title="Minha Conta"
      subtitle="Dados do seu perfil e credenciais de acesso ao Looply"
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600">
            Perfil atualizado com sucesso!
          </div>
        )}

        {/* User Identity Card */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/40 p-4">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={name || "Avatar"}
              className="h-12 w-12 shrink-0 rounded-full object-cover border border-[var(--looply-color-border-default)]"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--looply-color-action-primary)]/10 text-base font-bold text-[var(--looply-color-action-primary)]">
              {name ? initials(name) : "·"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-[var(--looply-color-text-primary)]">
              {user?.name ?? "—"}
            </div>
            <div className="truncate text-xs text-[var(--looply-color-text-muted)]">
              {user?.email ?? "—"}
            </div>
            <div className="mt-1 inline-flex items-center rounded-md bg-[var(--looply-color-bg-surface)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--looply-color-text-brand)] ring-1 ring-inset ring-[var(--looply-color-border-default)]">
              {activeRole ? (ROLE_LABEL[activeRole] ?? activeRole) : "Membro"}
            </div>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn-secondary text-xs px-2.5 py-1"
            >
              Editar
            </button>
          )}
        </div>

        {/* Photo — always visible, independent of edit mode */}
        <div>
          <p className="text-xs font-semibold text-[var(--looply-color-text-muted)] mb-2">Foto de perfil</p>
          <ImageUpload
            currentUrl={user?.avatarUrl}
            initials={name ? initials(name) : "?"}
            onUpload={(file) => uploadAvatarMutation.mutateAsync(file)}
            onDelete={() => deleteAvatarMutation.mutateAsync()}
            disabled={uploadAvatarMutation.isPending || deleteAvatarMutation.isPending}
          />
        </div>

        {/* Profile Form / View */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label htmlFor="user-profile-name" className="text-xs font-semibold text-[var(--looply-color-text-muted)]">
                Nome completo
              </label>
              <input
                id="user-profile-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input mt-1"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label htmlFor="user-profile-email" className="text-xs font-semibold text-[var(--looply-color-text-muted)]">
                E-mail de acesso
              </label>
              <input
                id="user-profile-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1"
                placeholder="seu.email@empresa.com"
              />
            </div>

            <div>
              <label htmlFor="user-profile-phone" className="text-xs font-semibold text-[var(--looply-color-text-muted)]">
                Telefone pessoal
              </label>
              <PhoneInput
                id="user-profile-phone"
                className="input mt-1"
                value={phone}
                onChange={setPhone}
                placeholder="(16) 99405-0998"
              />
              <p className="mt-1 text-[11px] text-[var(--looply-color-text-muted)]">
                Telefone de contato do seu perfil de usuário.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--looply-color-border-default)]">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  if (user) {
                    setName(user.name ?? "");
                    setEmail(user.email ?? "");
                    setPhone(hydratePhone(user.phone));
                  }
                }}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="btn-primary text-xs"
              >
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar Perfil"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--looply-color-text-muted)]">
                Nome completo
              </label>
              <div className="mt-1 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-2 text-sm text-[var(--looply-color-text-primary)]">
                {user?.name ?? "—"}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--looply-color-text-muted)]">
                E-mail de acesso
              </label>
              <div className="mt-1 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-2 text-sm text-[var(--looply-color-text-primary)]">
                {user?.email ?? "—"}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--looply-color-text-muted)]">
                Telefone pessoal
              </label>
              <div className="mt-1 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-2 text-sm text-[var(--looply-color-text-primary)]">
                {user?.phone ? user.phone : <span className="text-[var(--looply-color-text-muted)]">Não informado</span>}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-t border-[var(--looply-color-border-default)] pt-4 flex items-center justify-between">
          <Link
            to="/change-password"
            onClick={onClose}
            className="text-xs font-semibold text-[var(--looply-color-action-primary)] hover:underline"
          >
            Alterar minha senha →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalOrSheet>
  );
}
