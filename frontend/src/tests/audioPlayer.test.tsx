import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AudioPlayer from "../components/AudioPlayer";

describe("AudioPlayer component", () => {
  beforeEach(() => {
    // Mock HTMLMediaElement methods
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  it("renders error state when url is null", () => {
    render(<AudioPlayer url={null} />);
    expect(screen.getByText("Não foi possível carregar o áudio.")).toBeTruthy();
  });

  it("renders waveform bars, play button, and initial time", () => {
    render(<AudioPlayer url="https://example.com/audio.ogg" />);
    expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Progresso do áudio" })).toBeTruthy();
    expect(screen.getByText("1×")).toBeTruthy();
    expect(screen.getByText("0:00")).toBeTruthy();
  });

  it("toggles play and pause on button click", async () => {
    render(<AudioPlayer url="https://example.com/audio.ogg" />);
    const playBtn = screen.getByRole("button", { name: "Reproduzir áudio" });

    fireEvent.click(playBtn);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // After play starts, button changes label
    const audio = document.querySelector("audio")!;
    fireEvent.play(audio);
    expect(screen.getByRole("button", { name: "Pausar áudio" })).toBeTruthy();

    const pauseBtn = screen.getByRole("button", { name: "Pausar áudio" });
    fireEvent.click(pauseBtn);
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("cycles speed from 1x to 1.5x to 2x and back to 1x", () => {
    render(<AudioPlayer url="https://example.com/audio.ogg" />);
    const speedBtn = screen.getByRole("button", { name: "Alterar velocidade do áudio" });
    expect(speedBtn.textContent).toBe("1×");

    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("1.5×");

    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("2×");

    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("1×");
  });

  it("handles infinite duration hack for OGG/Opus audio", () => {
    render(<AudioPlayer url="https://example.com/audio.ogg" />);
    const audio = document.querySelector("audio")!;

    // Set duration to Infinity simulating OGG stream without Content-Length
    Object.defineProperty(audio, "duration", { value: Infinity, configurable: true, writable: true });
    fireEvent.loadedMetadata(audio);

    // Seek to end was triggered to force browser to calculate real duration
    expect(audio.currentTime).toBe(1e101);

    // When seek completes, duration is resolved to real finite value
    Object.defineProperty(audio, "duration", { value: 65, configurable: true });
    fireEvent.seeked(audio);

    expect(audio.currentTime).toBe(0);
    expect(screen.getByText("1:05")).toBeTruthy();
  });

  it("handles seek via waveform click and keyboard arrows", () => {
    render(<AudioPlayer url="https://example.com/audio.ogg" />);
    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "duration", { value: 100, configurable: true });
    fireEvent.loadedMetadata(audio);

    const waveform = screen.getByRole("slider", { name: "Progresso do áudio" });
    vi.spyOn(waveform, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      right: 200,
      bottom: 20,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.click(waveform, { clientX: 100 });
    expect(audio.currentTime).toBe(50);

    fireEvent.keyDown(waveform, { key: "ArrowRight" });
    expect(audio.currentTime).toBe(55);

    fireEvent.keyDown(waveform, { key: "ArrowLeft" });
    expect(audio.currentTime).toBe(50);
  });

  it("renders download button and triggers download when clicked", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["audio data"], { type: "audio/ogg" })),
    } as any);

    const { rerender } = render(
      <AudioPlayer
        url="https://example.com/audio.ogg"
        downloadUrl="https://example.com/audio.ogg?download=1"
        downloadFilename="my-recording.ogg"
      />,
    );

    const downloadBtn = screen.getByRole("button", { name: "Baixar áudio" });
    expect(downloadBtn).toBeTruthy();

    fireEvent.click(downloadBtn);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/audio.ogg?download=1",
        expect.objectContaining({ credentials: "omit" }),
      );
    });

    rerender(
      <AudioPlayer
        url="/api/media/123"
        downloadUrl="/api/media/123?download=1"
        downloadFilename="local-recording.ogg"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Baixar áudio" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/media/123?download=1",
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });
});
