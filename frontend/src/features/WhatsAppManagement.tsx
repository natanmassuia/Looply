import { useState } from "react";
import {
  useWhatsAppPhoneNumbers,
  useWhatsAppTemplates,
  useSendWhatsAppTemplate,
  type WhatsAppMessageTemplate,
} from "../lib/api";

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "APPROVED"
      ? "bg-emerald-100 text-emerald-700"
      : status === "REJECTED"
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

function SendTemplateDialog({
  template,
  onClose,
}: {
  template: WhatsAppMessageTemplate;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const sendMutation = useSendWhatsAppTemplate();

  const handleSend = () => {
    if (!to.trim()) return;
    sendMutation.mutate(
      { to: to.trim(), templateName: template.name, languageCode: template.language },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--looply-color-bg-surface,#ffffff)] rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-base font-bold text-[var(--looply-color-text-primary,#18181b)] mb-1">
          Enviar template
        </h3>
        <p className="text-sm text-[var(--looply-color-text-muted,#71717a)] mb-4">
          <strong>{template.name}</strong> ({template.language})
        </p>

        <label className="block text-sm font-medium text-[var(--looply-color-text-primary,#18181b)] mb-1">
          Número de destino (com código do país)
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="5511999998888"
          className="w-full rounded-lg border border-[var(--looply-color-border-default,#e4e4e7)] bg-[var(--looply-color-bg-canvas,#f8fafc)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--looply-color-text-brand,#2563eb)] mb-4"
        />

        {sendMutation.isError && (
          <p className="text-xs text-red-500 mb-3">Falha ao enviar template. Verifique o número e tente novamente.</p>
        )}
        {sendMutation.isSuccess && (
          <p className="text-xs text-emerald-600 mb-3">Template enviado com sucesso!</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--looply-color-border-default,#e4e4e7)] px-4 py-2 text-sm font-medium text-[var(--looply-color-text-primary,#18181b)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!to.trim() || sendMutation.isPending}
            className="rounded-lg bg-[var(--looply-color-text-brand,#2563eb)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {sendMutation.isPending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppManagement() {
  const { data: phoneData, isLoading: loadingPhones, isError: phoneError } = useWhatsAppPhoneNumbers();
  const { data: templateData, isLoading: loadingTemplates, isError: templateError } = useWhatsAppTemplates();
  const [sendingTemplate, setSendingTemplate] = useState<WhatsAppMessageTemplate | null>(null);

  const phoneNumbers = phoneData?.phoneNumbers ?? [];
  const templates = templateData?.templates ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--looply-color-text-primary,#18181b)]">
          WhatsApp Business
        </h1>
        <p className="text-sm text-[var(--looply-color-text-muted,#71717a)] mt-1">
          Números de telefone e modelos de mensagem da conta WhatsApp Business.
        </p>
      </div>

      {/* Phone Numbers */}
      <section>
        <h2 className="text-base font-semibold text-[var(--looply-color-text-primary,#18181b)] mb-3">
          Números de telefone
        </h2>
        {loadingPhones ? (
          <p className="text-sm text-[var(--looply-color-text-muted,#71717a)]">Carregando...</p>
        ) : phoneError ? (
          <p className="text-sm text-red-500">Erro ao carregar números. Verifique as credenciais da API.</p>
        ) : phoneNumbers.length === 0 ? (
          <p className="text-sm text-[var(--looply-color-text-muted,#71717a)]">Nenhum número encontrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--looply-color-border-default,#e4e4e7)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-muted,#71717a)]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Número</th>
                  <th className="text-left px-4 py-2.5 font-medium">Nome verificado</th>
                  <th className="text-left px-4 py-2.5 font-medium">Qualidade</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--looply-color-border-default,#e4e4e7)]">
                {phoneNumbers.map((pn) => (
                  <tr key={pn.id} className="text-[var(--looply-color-text-primary,#18181b)]">
                    <td className="px-4 py-2.5 font-mono">{pn.display_phone_number}</td>
                    <td className="px-4 py-2.5">{pn.verified_name}</td>
                    <td className="px-4 py-2.5">{pn.quality_rating}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={pn.status} /></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--looply-color-text-muted,#71717a)]">{pn.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Message Templates */}
      <section>
        <h2 className="text-base font-semibold text-[var(--looply-color-text-primary,#18181b)] mb-3">
          Modelos de mensagem
        </h2>
        {loadingTemplates ? (
          <p className="text-sm text-[var(--looply-color-text-muted,#71717a)]">Carregando...</p>
        ) : templateError ? (
          <p className="text-sm text-red-500">Erro ao carregar templates. Verifique as credenciais da API.</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-[var(--looply-color-text-muted,#71717a)]">Nenhum template encontrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--looply-color-border-default,#e4e4e7)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-muted,#71717a)]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Nome</th>
                  <th className="text-left px-4 py-2.5 font-medium">Idioma</th>
                  <th className="text-left px-4 py-2.5 font-medium">Categoria</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--looply-color-border-default,#e4e4e7)]">
                {templates.map((t) => (
                  <tr key={`${t.name}-${t.language}`} className="text-[var(--looply-color-text-primary,#18181b)]">
                    <td className="px-4 py-2.5 font-mono">{t.name}</td>
                    <td className="px-4 py-2.5">{t.language}</td>
                    <td className="px-4 py-2.5">{t.category}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2.5">
                      {t.status === "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => setSendingTemplate(t)}
                          className="rounded-md bg-[var(--looply-color-text-brand,#2563eb)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                        >
                          Enviar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sendingTemplate && (
        <SendTemplateDialog
          template={sendingTemplate}
          onClose={() => setSendingTemplate(null)}
        />
      )}
    </div>
  );
}
