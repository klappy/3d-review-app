// Presentation only. The existing server remains the authority for synthetic sign-in.
// Explicit developer entry: https://dev.3dreview.app/?dev-tools=signin#signin
export function sandboxToolsEnabled({ hostname = '', search = '' } = {}) {
  return ['dev.3dreview.app', 'localhost', '127.0.0.1', '[::1]'].includes(hostname)
    && new URLSearchParams(search).get('dev-tools') === 'signin';
}
