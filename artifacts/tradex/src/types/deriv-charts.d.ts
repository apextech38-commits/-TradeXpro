declare module "@deriv/deriv-charts" {
  import type { ComponentType } from "react";

  export const SmartChart: ComponentType<Record<string, unknown>>;
  export function setSmartChartsPublicPath(path: string): void;
}
