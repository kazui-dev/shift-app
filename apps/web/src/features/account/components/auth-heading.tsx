/**
 * The app's mark, shown above every sign-in choice. The name is left to the
 * document title: the screen is short, and the mark already carries it.
 */
export function AuthHeading() {
  return (
    <img
      className="mx-auto h-36 w-auto sm:h-40"
      src="/kuruton-login.png"
      alt="旭祭シフト"
    />
  )
}
