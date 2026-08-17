import { useState, useEffect } from "react";
import ModalOrSheet from "../components/ModalOrSheet";
import { useCompanySettings, useUpdateCompanySettings, useMe, useUploadCompanyLogo, useDeleteCompanyLogo, ApiError } from "../lib/api";
import { Spinner } from "../components/common";
import ImageUpload from "../components/ImageUpload";

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília · GMT-3" },
  { value: "America/Manaus", label: "Manaus · GMT-4" },
  { value: "America/Rio_Branco", label: "Rio Branco · GMT-5" },
  { value: "America/Noronha", label: "Fernando de Noronha · GMT-2" },
  { value: "America/Fortaleza", label: "Fortaleza · GMT-3" },
  { value: "America/Cuiaba", label: "Cuiabá · GMT-4" },
  { value: "UTC", label: "UTC · GMT+0" },
];

interface EditCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditCompanyModal({ isOpen, onClose }: EditCompanyModalProps) {
  const { data: session } = useMe();
  const { data: companyData, isLoading } = useCompanySettings(isOpen);
  const updateCompany = useUpdateCompanySettings();
  const uploadLogoMutation = useUploadCompanyLogo();
  const deleteLogoMutation = useDeleteCompanyLogo();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (companyData) {
      setName(companyData.name || "");
      setTimezone(companyData.timezone || "America/Sao_Paulo");
      setPhone(companyData.phone || "");
    } else if (session?.workspace?.name) {
      setName(session.workspace.name);
    }
  }, [companyData, session]);

  const activeRole = session?.memberships?.find(
    (m) => m.companyId === session.activeCompanyId,
  )?.role;
  const isOwnerOrAdmin = activeRole === "OWNER" || activeRole === "ADMIN" || !activeRole;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    if (!name.trim()) {
      setErr("O nome da empresa não pode ser vazio.");
      return;
    }

    try {
      await updateCompany.mutateAsync({
        name: name.trim(),
        timezone,
        phone: phone.trim() || null,
      });
      setSuccess("Dados da empresa atualizados com sucesso.");
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao salvar dados da empresa.");
    }
  };

  // Company name initials for logo fallback
  const companyInitials = (companyData?.name || name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

  return (
    <ModalOrSheet isOpen={isOpen} onClose={onClose} title="Editar empresa" maxWidth="max-w-md">
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Spinner label="Carregando dados da empresa..." />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {err && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600">
              {err}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600">
              {success}
            </div>
          )}

          {/* Logo upload */}
          <div>
            <p className="label mb-2">Logo da empresa</p>
            <ImageUpload
              currentUrl={companyData?.logoUrl}
              initials={companyInitials}
              shape="square"
              size="w-16 h-16"
              onUpload={(file) => uploadLogoMutation.mutateAsync(file)}
              onDelete={() => deleteLogoMutation.mutateAsync()}
              disabled={!isOwnerOrAdmin || uploadLogoMutation.isPending || deleteLogoMutation.isPending}
            />
          </div>

          <div>
            <label htmlFor="modal-company-name" className="label">
              Nome da empresa *
            </label>
            <input
              id="modal-company-name"
              type="text"
              required
              disabled={!isOwnerOrAdmin || updateCompany.isPending}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Ex.: Minha Agência"
            />
          </div>

          <div>
            <label htmlFor="modal-company-phone" className="label">
              Telefone empresarial
            </label>
            <input
              id="modal-company-phone"
              type="tel"
              disabled={!isOwnerOrAdmin || updateCompany.isPending}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="+55 (11) 3000-0000"
            />
            <p className="mt-1 text-[11px] text-[var(--looply-color-text-muted)]">
              Usado nos dados institucionais e documentos da empresa.
            </p>
          </div>

          <div>
            <label htmlFor="modal-company-timezone" className="label">
              Fuso horário *
            </label>
            <select
              id="modal-company-timezone"
              disabled={!isOwnerOrAdmin || updateCompany.isPending}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Idioma da interface</label>
            <input
              type="text"
              className="input opacity-75 cursor-not-allowed"
              disabled
              value="Português (Brasil)"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--looply-color-border-default)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isOwnerOrAdmin || updateCompany.isPending}
              className="btn-primary text-xs"
            >
              {updateCompany.isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      )}
    </ModalOrSheet>
  );
}
