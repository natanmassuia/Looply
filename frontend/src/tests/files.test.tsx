import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ContentDetail from "../features/ContentDetail";
import * as apiModule from "../lib/api";
import type { ContentDetail as ContentDetailType, JobAttachment } from "../lib/types";

const mockJobDetail: ContentDetailType = {
  id: "job-1",
  title: "Post Campanha de Inverno",
  clientId: "cli-1",
  format: "POST",
  channel: "Instagram",
  status: "DRAFT",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  client: { id: "cli-1", name: "Restaurante Aurora", brandColor: "#e11d48", status: "ACTIVE", channels: [], createdAt: "" },
  versions: [
    {
      id: "v-1",
      contentId: "job-1",
      versionNumber: 1,
      caption: "Legenda da campanha",
      createdAt: new Date().toISOString(),
    },
  ],
};

const mockFiles: JobAttachment[] = [
  {
    id: "file-1",
    jobId: "job-1",
    originalName: "banner_principal.png",
    contentType: "image/png",
    sizeBytes: 1024 * 1024 * 2, // 2MB
    status: "AVAILABLE",
    createdAt: new Date().toISOString(),
  },
];

function renderWithProviders(ui: React.ReactElement, initialRoute = "/") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Job Files & Upload Feature — B5 Wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders attachments list from server truth with originalName and formatted size", () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);

    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({
      data: { files: mockFiles },
      isLoading: false,
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    expect(screen.getByText(/Arquivos e Anexos \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("banner_principal.png")).toBeInTheDocument();
    expect(screen.getByText(/2 MB/i)).toBeInTheDocument();
  });

  it("executes upload intent, direct storage upload, and complete endpoint on valid file selection", async () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);

    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({
      data: { files: [] },
      isLoading: false,
    } as any);

    const uploadMutate = vi.fn().mockResolvedValue({
      id: "file-new",
      jobId: "job-1",
      originalName: "foto.jpg",
      contentType: "image/jpeg",
      sizeBytes: 5000,
      status: "AVAILABLE",
    });

    vi.spyOn(apiModule, "useUploadJobAttachment").mockReturnValue({
      mutateAsync: uploadMutate,
      isPending: false,
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const testFile = new File(["dummy image content"], "foto.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(uploadMutate).toHaveBeenCalledWith(testFile);
    });
  });

  it("validates client-side file size limit (50MB) before requesting intent", async () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);

    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({
      data: { files: [] },
      isLoading: false,
    } as any);

    const uploadMutate = vi.fn();
    vi.spyOn(apiModule, "useUploadJobAttachment").mockReturnValue({
      mutateAsync: uploadMutate,
      isPending: false,
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const oversizedFile = new File(["a".repeat(100)], "huge_video.mp4", { type: "video/mp4" });
    Object.defineProperty(oversizedFile, "size", { value: 60 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/excede o limite máximo permitido de 50MB/i)).toBeInTheDocument();
      expect(uploadMutate).not.toHaveBeenCalled();
    });
  });

  it("triggers download action via GET /api/files/:id/download", async () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);

    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({
      data: { files: mockFiles },
      isLoading: false,
    } as any);

    const downloadMutate = vi.fn().mockResolvedValue({ url: "https://storage.test/download/banner.png", expiresAt: "" });
    vi.spyOn(apiModule, "useDownloadJobFile").mockReturnValue({
      mutateAsync: downloadMutate,
      isPending: false,
    } as any);

    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    const downloadBtn = screen.getByRole("button", { name: "Baixar" });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(downloadMutate).toHaveBeenCalledWith("file-1");
      expect(windowOpenSpy).toHaveBeenCalledWith("https://storage.test/download/banner.png", "_blank", "noopener,noreferrer");
    });
  });

  it("triggers deletion via DELETE /api/files/:id", async () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);

    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({
      data: { files: mockFiles },
      isLoading: false,
    } as any);

    const deleteMutate = vi.fn().mockResolvedValue(null);
    vi.spyOn(apiModule, "useDeleteJobFile").mockReturnValue({
      mutateAsync: deleteMutate,
      isPending: false,
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    const deleteBtn = screen.getByLabelText("Excluir banner_principal.png");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith("file-1");
    });
  });
});
