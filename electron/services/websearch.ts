import type { AppSettings, WebSearchResult } from '../types'
import { apiFetch } from './http'

type SearchProvider = 'duckduckgo' | 'tavily' | 'brave'

export class WebSearchService {
  private apiKey = ''
  private provider: SearchProvider = 'duckduckgo'

  configure(settings: Pick<AppSettings, 'searchApiKey' | 'searchProvider'>): void {
    this.apiKey = settings.searchApiKey?.trim() ?? ''
    this.provider = settings.searchProvider ?? 'duckduckgo'
  }

  async search(query: string, maxResults = 5): Promise<WebSearchResult[]> {
    if (this.provider === 'tavily' && this.apiKey) {
      const tavily = await this.searchTavily(query, maxResults)
      if (tavily.length > 0) return tavily
    }

    if (this.provider === 'brave' && this.apiKey) {
      const brave = await this.searchBrave(query, maxResults)
      if (brave.length > 0) return brave
    }

    const ddg = await this.searchDuckDuckGo(query, maxResults)
    if (ddg.length > 0) return ddg

    return [
      {
        title: 'Search fallback',
        url: '',
        snippet: `[DuckDuckGo fallback] No structured results for: ${query}`
      }
    ]
  }

  private async searchTavily(query: string, maxResults: number): Promise<WebSearchResult[]> {
    try {
      const response = await apiFetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: maxResults
        })
      })
      if (!response.ok) return []
      const data = (await response.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string }>
      }
      return (data.results ?? []).map((r) => ({
        title: r.title || query,
        url: r.url || '',
        snippet: r.content || ''
      }))
    } catch {
      return []
    }
  }

  private async searchBrave(query: string, maxResults: number): Promise<WebSearchResult[]> {
    try {
      const response = await apiFetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
        {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': this.apiKey
          }
        }
      )
      if (!response.ok) return []
      const data = (await response.json()) as {
        web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
      }
      return (data.web?.results ?? []).map((r) => ({
        title: r.title || query,
        url: r.url || '',
        snippet: r.description || ''
      }))
    } catch {
      return []
    }
  }

  private async searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`

    try {
      const response = await apiFetch(url, {
        headers: { 'User-Agent': 'OpenRouterAgent/1.0' }
      })

      if (!response.ok) {
        return this.fallbackHtmlSearch(query, maxResults)
      }

      const data = (await response.json()) as {
        AbstractText?: string
        AbstractURL?: string
        Heading?: string
        RelatedTopics?: Array<{
          Text?: string
          FirstURL?: string
          Topics?: Array<{ Text?: string; FirstURL?: string }>
        }>
      }

      const results: WebSearchResult[] = []

      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || '',
          snippet: data.AbstractText
        })
      }

      const topics = data.RelatedTopics || []
      for (const topic of topics) {
        if (results.length >= maxResults) break
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text
          })
        }
        if (topic.Topics) {
          for (const sub of topic.Topics) {
            if (results.length >= maxResults) break
            if (sub.Text && sub.FirstURL) {
              results.push({
                title: sub.Text.split(' - ')[0] || sub.Text,
                url: sub.FirstURL,
                snippet: sub.Text
              })
            }
          }
        }
      }

      if (results.length === 0) {
        return this.fallbackHtmlSearch(query, maxResults)
      }

      return results.slice(0, maxResults)
    } catch {
      return this.fallbackHtmlSearch(query, maxResults)
    }
  }

  private async fallbackHtmlSearch(query: string, maxResults: number): Promise<WebSearchResult[]> {
    try {
      const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const response = await apiFetch(htmlUrl, {
        headers: { 'User-Agent': 'OpenRouterAgent/1.0' }
      })
      const html = await response.text()
      const results: WebSearchResult[] = []
      const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g

      let match
      const links: Array<{ url: string; title: string }> = []
      while ((match = linkRegex.exec(html)) !== null && links.length < maxResults) {
        links.push({ url: match[1], title: match[2].trim() })
      }

      const snippets: string[] = []
      while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
        snippets.push(match[1].trim())
      }

      links.forEach((link, i) => {
        results.push({
          title: link.title,
          url: link.url,
          snippet: snippets[i] || ''
        })
      })

      return results
    } catch {
      return []
    }
  }
}
