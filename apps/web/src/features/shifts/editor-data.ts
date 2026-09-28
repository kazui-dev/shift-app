import type * as v from "valibot"
import type { activityEditorResponseSchema } from "@workspace/shared/shifts"

export type EditorData = v.InferOutput<typeof activityEditorResponseSchema>
