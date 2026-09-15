/** The app's mark and name, shown above every sign-in choice. */
export function AuthHeading() {
  return (
    <div className="text-center">
      <img
        className="mx-auto mb-10 h-36 w-auto sm:h-40"
        src="/kuruton-login.png"
        alt=""
      />
      <h1 className="text-2xl font-semibold tracking-tight">旭祭シフト</h1>
    </div>
  )
}
