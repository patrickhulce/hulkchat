<a href="https://hulkchat.vercel.app/">
  <h1 align="center">HulkChat</h1>
</a>

<p align="center">
  An open-source AI chatbot app built with Next.js, the Vercel AI SDK, OpenAI, Anthropic, and Vercel KV.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a> ·
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
- React Server Components (RSCs), Suspense, and Server Actions
- [Vercel AI SDK](https://sdk.vercel.ai/docs) for streaming chat UI
- Support for OpenAI (default) and Anthropic
- Edge runtime-ready
- Chat History, rate limiting, and session storage with [Vercel KV](https://vercel.com/storage/kv)
- [NextAuth.js](https://github.com/nextauthjs/next-auth) for authentication

## Model Providers

This template ships with OpenAI `gpt-3.5-turbo` as the default. However, thanks to the [Vercel AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [Anthropic](https://anthropic.com), [Hugging Face](https://huggingface.co), or using [LangChain](https://js.langchain.com) with just a few lines of code.

## Running locally

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with the Vercel project accounts (creates `.vercel` directory): `vercel link`
3. Download the environment variables: `vercel env pull`

### First Terminal

```bash
pnpm install
pnpm dev
```

### Second Terminal

```bash
npx inngest-cli@latest dev
```

The app should now be running on [localhost:3000](http://localhost:3000/).
