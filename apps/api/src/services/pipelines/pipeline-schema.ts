import { z } from "zod";

export const flutterPipelineSchema = z.object({
  branch: z.string().min(1),

  trigger: z.object({
    push: z.boolean(),
    pullRequest: z.boolean(),
    manual: z.boolean(),
  }),

  checks: z.object({
    analyze: z.boolean(),
    test: z.boolean(),
  }),

  android: z.object({
    enabled: z.boolean(),
    apk: z.boolean(),
    aab: z.boolean(),
  }),

  ios: z.object({
    enabled: z.boolean(),
    unsignedBuild: z.boolean(),
  }),
});

export type FlutterPipelineConfig =
  z.infer<typeof flutterPipelineSchema>;