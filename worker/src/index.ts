export interface Env {
  GITHUB_TOKEN: string
}

const REPO = 'joaogtito/PLViewer'
const WORKFLOW = 'atualizar-dados.yml'
const REF = 'master'

async function disparar(env: Env): Promise<void> {
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`
  let ultimo = ''
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'plviewer-cron-worker',
        },
        body: JSON.stringify({ ref: REF }),
      })
      if (r.status === 204) return
      ultimo = `${r.status} ${(await r.text()).slice(0, 300)}`
      // 4xx (token inválido, workflow inexistente) não melhora com nova tentativa.
      if (r.status < 500 && r.status !== 429) break
    } catch (e) {
      ultimo = `rede: ${String(e)}`
    }
    await new Promise((ok) => setTimeout(ok, 2000 * (tentativa + 1)))
  }
  // Lançar o erro marca a invocação como falha no painel e nos Workers Logs.
  throw new Error(`Disparo falhou: ${ultimo}`)
}

export default {
  async scheduled(_evento: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(disparar(env))
  },
}
