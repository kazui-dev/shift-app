export function dueReminderWindow(scheduledTime: number) {
  return {
    from: scheduledTime + 9 * 60 * 1000,
    to: scheduledTime + 10 * 60 * 1000,
  }
}
