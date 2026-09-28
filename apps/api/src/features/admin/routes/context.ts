export type AdminEnv = {
  Bindings: CloudflareBindings
  Variables: {
    adminUser: {
      id: string
      userId: string
    }
  }
}
