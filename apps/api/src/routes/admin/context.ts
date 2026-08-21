export type AdminEnv = {
  Bindings: CloudflareBindings
  Variables: {
    adminMember: {
      id: string
      userId: string
    }
  }
}
