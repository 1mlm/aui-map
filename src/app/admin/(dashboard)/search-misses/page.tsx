import type { Metadata } from "next"
import { prisma } from "@/utils/prisma"
import { dismissSearchMiss } from "./actions"

export const metadata: Metadata = { title: "Missed searches" }
export const dynamic = "force-dynamic"

export default async function AdminSearchMissesPage() {
  const misses = await prisma.searchMiss.findMany({
    orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
    take: 300,
  })

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="font-semibold text-xl">Missed searches</h1>
        <p className="text-muted-foreground text-sm">
          Things people typed in the map that matched no pin. Most typed first.
          Add a pin or an alias, then dismiss the row.
        </p>
      </div>
      {misses.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Query</th>
              <th className="py-2 pr-4 font-medium">Times</th>
              <th className="py-2 pr-4 font-medium">Last seen</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {misses.map((miss) => (
              <tr key={miss.query} className="border-t">
                <td className="py-2 pr-4">{miss.query}</td>
                <td className="py-2 pr-4 tabular-nums">{miss.count}</td>
                <td className="py-2 pr-4">
                  {miss.lastSeen.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="py-2 text-right">
                  <form action={dismissSearchMiss}>
                    <input type="hidden" name="query" value={miss.query} />
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
