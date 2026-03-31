export const MICROMAIL_BASE_ROUTE = "micromail" as const;
export const MICROMAIL_BASE_PATH = `/${MICROMAIL_BASE_ROUTE}` as const;

export const MICROMAIL_TASK_TYPES = ["unread", "junk", "attachment", "flagged", "inbox"] as const;
export type MicromailTaskType = (typeof MICROMAIL_TASK_TYPES)[number];

export const MICROMAIL_CRITERIA_TYPES = ["absolute", "relative"] as const;
export type MicromailCriteriaType = (typeof MICROMAIL_CRITERIA_TYPES)[number];

export const MICROMAIL_ACTIVITY_TYPES = ["passive", "active"] as const;
export type MicromailActivityType = (typeof MICROMAIL_ACTIVITY_TYPES)[number];

export type MicromailVariantId =
  `micromail-${MicromailTaskType}-${MicromailCriteriaType}-${MicromailActivityType}`;

export const isMicromailTaskType = (value: string | null): value is MicromailTaskType =>
  MICROMAIL_TASK_TYPES.includes(value as MicromailTaskType);

export const isMicromailCriteriaType = (value: string | null): value is MicromailCriteriaType =>
  MICROMAIL_CRITERIA_TYPES.includes(value as MicromailCriteriaType);

export const isMicromailActivityType = (value: string | null): value is MicromailActivityType =>
  MICROMAIL_ACTIVITY_TYPES.includes(value as MicromailActivityType);

export const getMicromailVariantId = (
  task: MicromailTaskType,
  criteria: MicromailCriteriaType,
  activity: MicromailActivityType
): MicromailVariantId => `micromail-${task}-${criteria}-${activity}`;

export const getMicromailTaskLabel = (task: MicromailTaskType): string => {
  switch (task) {
    case "unread":
      return "Unread";
    case "junk":
      return "Junk";
    case "attachment":
      return "Attachments";
    case "flagged":
      return "Flagged";
    case "inbox":
      return "Inbox";
  }
};

export const getMicromailCriteriaLabel = (criteria: MicromailCriteriaType): string =>
  criteria === "absolute" ? "Absolute" : "Relative";

export const getMicromailActivityLabel = (activity: MicromailActivityType): string =>
  activity === "active" ? "Active" : "Passive";

export interface MicromailVariantDefinition {
  id: MicromailVariantId;
  path: typeof MICROMAIL_BASE_ROUTE;
  title: string;
  description: string;
  url: string;
  icon: "📧";
  tags: string[];
  difficulty: "easy";
  base_task: "micromail";
  task_type: "time-based";
  criteria: "Objective";
  activity: "Passive" | "Mixed";
  distraction: "Medium";
  realism: "Realistic";
  relative_vs_absolute: "Absolute" | "Relative";
  adversarial_attacks: false;
  penalties: false;
  taskParams: {
    task: MicromailTaskType;
    criteria: MicromailCriteriaType;
    activity: MicromailActivityType;
  };
}

const buildMicromailUrlPath = (params: {
  task: MicromailTaskType;
  criteria: MicromailCriteriaType;
  activity: MicromailActivityType;
}): string => {
  const query = new URLSearchParams({
    task: params.task,
    criteria: params.criteria,
    activity: params.activity,
  });
  return `${MICROMAIL_BASE_PATH}?${query.toString()}`;
};

const buildMicromailDescription = (params: {
  task: MicromailTaskType;
  criteria: MicromailCriteriaType;
  activity: MicromailActivityType;
}): string => {
  const prefix =
    params.criteria === "absolute"
      ? {
          unread: "Wait until there are at least 15 unread emails",
          junk: "Wait until there are at least 10 emails in Junk",
          attachment: "Wait until there are at least 10 emails with attachments",
          flagged: "Wait until there are at least 10 flagged emails",
          inbox: "Wait until there are at least 20 emails in Inbox",
        }[params.task]
      : {
          unread: "Wait until at least 15 new unread emails arrive (relative to start)",
          junk: "Wait until at least 10 new Junk emails arrive (relative to start)",
          attachment: "Wait until at least 10 new emails with attachments arrive (relative to start)",
          flagged: "Wait until the flagged email count doubles (relative to start)",
          inbox: "Wait until the Inbox email count grows by 50% (relative to start)",
        }[params.task];

  const action =
    params.activity === "active"
      ? {
          unread: "mark all as read",
          junk: "clear the Junk folder",
          attachment: "open an attachment preview",
          flagged: "archive all flagged emails",
          inbox: "archive all Inbox emails",
        }[params.task]
      : null;

  if (action) {
    return `${prefix}, ${action}.`;
  }
  return `${prefix}.`;
};

export const MICROMAIL_GRID_COLUMNS = [
  { criteria: "absolute", activity: "passive", label: "Absolute / Passive" },
  { criteria: "absolute", activity: "active", label: "Absolute / Active" },
  { criteria: "relative", activity: "passive", label: "Relative / Passive" },
  { criteria: "relative", activity: "active", label: "Relative / Active" },
] as const satisfies Array<{
  criteria: MicromailCriteriaType;
  activity: MicromailActivityType;
  label: string;
}>;

export const MICROMAIL_VARIANTS: MicromailVariantDefinition[] = MICROMAIL_TASK_TYPES.flatMap((task) =>
  MICROMAIL_GRID_COLUMNS.map((column) => {
    const id = getMicromailVariantId(task, column.criteria, column.activity);
    const taskLabel = getMicromailTaskLabel(task);
    const criteriaLabel = getMicromailCriteriaLabel(column.criteria);
    const activityLabel = getMicromailActivityLabel(column.activity);
    const urlPath = buildMicromailUrlPath({
      task,
      criteria: column.criteria,
      activity: column.activity,
    });

    return {
      id,
      path: MICROMAIL_BASE_ROUTE,
      title: `Micromail — ${taskLabel} (${criteriaLabel}, ${activityLabel})`,
      description: buildMicromailDescription({
        task,
        criteria: column.criteria,
        activity: column.activity,
      }),
      url: `{base_url}${urlPath}`,
      icon: "📧",
      tags: [
        "sentinel",
        "monitoring",
        "email",
        "outlook",
        "productivity",
        task,
        column.criteria,
        column.activity,
        "configurable",
      ],
      difficulty: "easy",
      base_task: "micromail",
      task_type: "time-based",
      criteria: "Objective",
      activity: column.activity === "active" ? "Mixed" : "Passive",
      distraction: "Medium",
      realism: "Realistic",
      relative_vs_absolute: column.criteria === "relative" ? "Relative" : "Absolute",
      adversarial_attacks: false,
      penalties: false,
      taskParams: {
        task,
        criteria: column.criteria,
        activity: column.activity,
      },
    };
  })
);

const micromailVariantByKey = (() => {
  const entries = new Map<string, MicromailVariantDefinition>();
  for (const variant of MICROMAIL_VARIANTS) {
    const key = `${variant.taskParams.task}:${variant.taskParams.criteria}:${variant.taskParams.activity}`;
    entries.set(key, variant);
  }
  return entries;
})();

export const getMicromailVariant = (
  task: MicromailTaskType,
  criteria: MicromailCriteriaType,
  activity: MicromailActivityType
): MicromailVariantDefinition => {
  const key = `${task}:${criteria}:${activity}`;
  const found = micromailVariantByKey.get(key);
  if (!found) {
    throw new Error(`Unknown Micromail variant: ${key}`);
  }
  return found;
};

