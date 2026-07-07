import { writeFile } from "node:fs/promises"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"

function projectRootExportPlugin(): Plugin {
  return {
    name: "system-flow-project-root-export",
    configureServer(server) {
      server.middlewares.use("/__system-flow/export", (request, response, next) => {
        if (request.method !== "POST") {
          next()
          return
        }

        let body = ""
        request.setEncoding("utf8")
        request.on("data", (chunk: string) => {
          body += chunk
          if (body.length > 10_000_000) request.destroy()
        })
        request.on("error", () => {
          response.statusCode = 400
          response.end(JSON.stringify({ error: "Could not read export request" }))
        })
        request.on("end", async () => {
          try {
            const parsed = JSON.parse(body) as {
              filename?: unknown
              content?: unknown
            }
            if (
              typeof parsed.filename !== "string" ||
              typeof parsed.content !== "string"
            ) {
              response.statusCode = 400
              response.end(JSON.stringify({ error: "Invalid export payload" }))
              return
            }

            const filename = path.basename(parsed.filename).replace(/[^\w.-]/g, "_")
            if (!filename || filename === "." || filename === "..") {
              response.statusCode = 400
              response.end(JSON.stringify({ error: "Invalid filename" }))
              return
            }

            const outputPath = path.resolve(__dirname, filename)
            if (!outputPath.startsWith(`${__dirname}${path.sep}`)) {
              response.statusCode = 400
              response.end(JSON.stringify({ error: "Invalid output path" }))
              return
            }

            await writeFile(outputPath, parsed.content, "utf8")
            response.setHeader("Content-Type", "application/json")
            response.end(JSON.stringify({ path: outputPath }))
          } catch {
            response.statusCode = 500
            response.end(JSON.stringify({ error: "Could not write export file" }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  // Preview tooling assigns a port via PORT; vite ignores it by default.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  plugins: [react(), tailwindcss(), projectRootExportPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
})
