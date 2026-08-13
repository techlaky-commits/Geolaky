"use client";

import { useState } from "react";
import { Camera, ImagePlus, Video } from "lucide-react";
import { CaptureClient } from "@/components/CaptureClient";
import { ImportClient } from "@/components/ImportClient";

export function PhotoIntakeClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [mode, setMode] = useState<"camera" | "video" | "import">("camera");

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-md gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setMode("camera")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
            mode === "camera" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Camera className="h-4 w-4" />
          Camera
        </button>
        <button
          onClick={() => setMode("video")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
            mode === "video" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Video className="h-4 w-4" />
          Video
        </button>
        <button
          onClick={() => setMode("import")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
            mode === "import" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ImagePlus className="h-4 w-4" />
          Importer
        </button>
      </div>

      {mode === "camera" && <CaptureClient projectId={projectId} projectName={projectName} mode="photo" />}
      {mode === "video" && <CaptureClient projectId={projectId} projectName={projectName} mode="video" />}
      {mode === "import" && <ImportClient projectId={projectId} projectName={projectName} />}
    </div>
  );
}
