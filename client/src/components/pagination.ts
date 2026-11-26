export const pageItems = <T>(items: T[], page: number, pageSize: number) =>
  items.slice(
    (Math.min(page, Math.max(1, Math.ceil(items.length / pageSize))) - 1) * pageSize,
    Math.min(page, Math.max(1, Math.ceil(items.length / pageSize))) * pageSize,
  )
