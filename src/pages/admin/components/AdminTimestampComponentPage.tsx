import { Timestamp, type TimestampSize, type TimestampType } from "@/components/ui/timestamp"

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout"

const sizes: TimestampSize[] = ["large", "medium", "small"]
const sizeLabels: Record<TimestampSize, string> = {
  large: "Large",
  medium: "Medium",
  small: "Small",
}

const examples: Array<{
  type: TimestampType
  label: string
  date?: string
  time?: string
  relativeText?: string
}> = [
  { type: "full", label: "Full", date: "14 Sep 2026", time: "10:30" },
  { type: "today", label: "Today", relativeText: "Today", time: "10:30" },
  { type: "date-only", label: "Date Only", date: "14 Sep 2026" },
  { type: "time-only", label: "Time Only", time: "10:30" },
  { type: "some-time-ago", label: "Some Time Ago", relativeText: "3 hours ago" },
]

type AdminTimestampComponentPageProps = {
  embedded?: boolean
}

export default function AdminTimestampComponentPage({
  embedded = false,
}: AdminTimestampComponentPageProps) {
  return (
    <ComponentShowcaseLayout
      title="Timestamp"
      description="Inspect the five timestamp types, three sizes, destructive color, and optional timezone content. All displayed values are passed in by the caller."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Types, sizes, and destructive state"
        criterion="Each type is shown at all three sizes in its default and destructive colors."
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-5">
          {examples.map(({ type, label, date, time, relativeText }) => (
            <div
              key={type}
              className="min-w-0 space-y-3 rounded-md border border-border-subtle p-3"
            >
              <h3 className="text-label-medium font-medium">{label}</h3>
              {sizes.map((size) => (
                <div key={size} className="space-y-2 border-t border-border-subtle pt-2">
                  <p className="text-body-small text-foreground-muted">{sizeLabels[size]}</p>
                  <div className="flex flex-col items-start gap-2">
                    <Timestamp
                      type={type}
                      size={size}
                      date={date}
                      time={time}
                      relativeText={relativeText}
                    />
                    <Timestamp
                      type={type}
                      size={size}
                      date={date}
                      time={time}
                      relativeText={relativeText}
                      destructive
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="Optional timezone"
        criterion="Timezone text is supplied by the call site and follows the time."
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <Timestamp
            type="full"
            date="14 Sep 2026"
            time="10:30"
            timezone="UTC+7"
          />
          <Timestamp type="time-only" time="10:30" timezone="UTC+7" />
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  )
}
