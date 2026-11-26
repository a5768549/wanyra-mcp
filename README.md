# Wanyra MCP Server (`@star1age/wanyra-mcp`)

[![Wanyra MCP server](https://glama.ai/mcp/servers/a5768549/wanyra-mcp/badge.svg)](https://glama.ai/mcp/servers/a5768549/wanyra-mcp)

Zero-dependency [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for **[Wanyra API](https://api.star1age.cn/en)** by [Star1Age](https://star1age.cn).

Give Claude Code, Cursor, Codex, Windsurf, Cline, or any MCP client direct access to **81 live GA multimodal AI models**—including 23 video generation models (`MiniMax H3`, `Seedance 2.0/2.5`, `Kling 3.0 Omni`, `Wan 3.0/2.7`, `Vidu Q3/Q2 Pro`, `Hailuo H3`, `HappyHorse 1.1`), 22 LLMs (`Claude`, `GPT`, `Gemini`, `DeepSeek`, `Qwen`, `Grok`), 23 image models, and 7 audio models—behind a single OpenAI-compatible pay-as-you-go gateway.

## Tools Included

| Tool | API Key Required? | Description |
| --- | --- | --- |
| `wanyra_list_models` | **No** | Query the live GA model catalog and exact real-time pricing (`1,000 points = CN¥1`). Filter by modality (`text`, `video`, `image`, `audio`, `embedding`, `realtime`, `web`) or keyword. |
| `wanyra_estimate_cost` | **No** | Calculate exact CNY cost estimates for video duration/resolution or text token counts against live catalog rates. |
| `wanyra_chat` | Yes (`WANYRA_API_KEY`) | Run chat completions against any of the 22 Wanyra text/reasoning models. |
| `wanyra_generate_image` | Yes (`WANYRA_API_KEY`) | Generate images via `/v1/images/generations` with automatic `Idempotency-Key`. |
| `wanyra_generate_video` | Yes (`WANYRA_API_KEY`) | Submit multipart async video jobs via `/v1/videos` with optional polling until completion. |

## Quick Start (Zero Dependencies, Node.js 18+)

Run directly from GitHub via `npx`:

```json
{
  "mcpServers": {
    "wanyra": {
      "command": "npx",
      "args": ["-y", "github:a5768549/wanyra-mcp"],
      "env": {
        "WANYRA_API_KEY": "sk-your-key-from-api.star1age.cn"
      }
    }
  }
}
```

> `wanyra_list_models` and `wanyra_estimate_cost` work immediately **without** setting `WANYRA_API_KEY`.

## Local Development & Verification

```bash
git clone https://github.com/a5768549/wanyra-mcp.git
cd wanyra-mcp
npm test
```

## Related Links

- **Wanyra API Portal & Live Pricing**: https://api.star1age.cn/en
- **API Docs**: https://api.star1age.cn/en/docs
- **Public No-Auth Live Catalog JSON**: https://api.star1age.cn/api/portal/public-api/catalog
- **Starter Examples (Node.js & Python)**: https://github.com/a5768549/wanyra-api-examples
- **Star1Age Ecosystem**: [Davro AI Agent](https://davro.app) · [Toonra AI Comic Canvas](https://canvas.star1age.cn) · [Zuolo AI Video Workflow](https://workflow.star1age.cn) · [Guides](https://star1age.cn/guides)

## License

MIT
