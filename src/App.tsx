import { PreloadHighlighter } from "@/components/layout/PreloadHighlighter";
import { ScrollbarGutterVariables } from "@/components/layout/ScrollbarGutterVariables";
import { Toaster } from "@/components/atoms/Toaster";
import { WorkerPoolContext } from "@/components/layout/WorkerPoolContext";

import { HomePage } from "./pages/Home";

export function App() {
  return (
    <WorkerPoolContext>
      <ScrollbarGutterVariables />
      <HomePage />
      <Toaster />
      <PreloadHighlighter />
    </WorkerPoolContext>
  );
}
