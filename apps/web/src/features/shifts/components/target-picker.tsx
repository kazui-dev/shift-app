import { MemberAvatar } from "@/features/members/components/member-avatar"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { SearchableList } from "@/components/searchable-list"
type Targets = ActivityEditorInput["responsibles"]
export function TargetPicker({
  label,
  roles,
  members,
  value,
  onChange,
}: {
  label: string
  roles: { id: string; name: string }[]
  members: { id: string; displayName: string; image: string | null }[]
  value: Targets
  onChange: (value: Targets) => void
}) {
  const targets = [
    ...roles.map((role) => ({
      targetType: "role" as const,
      targetId: role.id,
      name: role.name,
    })),
    ...members.map((member) => ({
      targetType: "member" as const,
      targetId: member.id,
      name: member.displayName,
      image: member.image,
    })),
  ]
  const names = targets
    .filter((target) =>
      value.some(
        (item) =>
          item.targetType === target.targetType &&
          item.targetId === target.targetId
      )
    )
    .map((target) => target.name)
  return (
    <details className="rounded-md border px-3 py-2">
      <summary className="cursor-pointer text-sm">
        {label}
        <span className="ml-3 text-muted-foreground">
          {names.join("、") || "未設定"}
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        <SearchableList
          label={label}
          items={targets}
          getSearchText={(target) => target.name}
        >
          {(target) => (
            <label
              key={`${target.targetType}:${target.targetId}`}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={value.some(
                  (item) =>
                    item.targetType === target.targetType &&
                    item.targetId === target.targetId
                )}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [
                          ...value,
                          {
                            targetType: target.targetType,
                            targetId: target.targetId,
                          },
                        ]
                      : value.filter(
                          (item) =>
                            item.targetType !== target.targetType ||
                            item.targetId !== target.targetId
                        )
                  )
                }
              />
              {target.targetType === "member" && (
                <MemberAvatar name={target.name} image={target.image} />
              )}
              {target.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {target.targetType === "role" ? "ロール" : "メンバー"}
              </span>
            </label>
          )}
        </SearchableList>
      </div>
    </details>
  )
}
