# Neon MCP

The Neon MCP server is configured in `.mcp.json`. Every Neon MCP call for this
project targets:

| | Name | ID |
| --- | --- | --- |
| Org | `naveen_official` | `org-wispy-grass-62167681` |
| Project | `Dev_stash` | `lively-sunset-41357751` |
| Branch | `development` | `br-rough-cell-az2ync9n` |

The org id is required by `list_projects`. Pass `project_id` **and**
`branch_id` explicitly on every call — omitting `branch_id` silently targets
the default branch, which is `production` (`br-square-hall-aztqqvza`). Never
rely on the default.

## Production is off-limits

Do not read from, write to, or run any tool against `production`
(`br-square-hall-aztqqvza`) unless I name it in that request. Prior approval
for a production action does not carry to the next one. If a task seems to
need production, stop and ask first.

Also off-limits unless I ask for it in that same request, on any branch:

- Creating, deleting or resetting branches, endpoints, databases or roles
- Destructive SQL — `DROP`, `TRUNCATE`, `DELETE`, `ALTER`, or an `UPDATE`
  without a `WHERE`
- Anything that changes project settings, billing or access

Read-only SQL (`SELECT`, `EXPLAIN`) and schema inspection against
`development` need no confirmation.

## Schema changes

Schema changes go through Prisma migrations (`npm run db:migrate`), never
through Neon MCP SQL and never `prisma db push` — see the migrations rule in
`context/project-overview.md`. Use Neon MCP to inspect and query, not to
change structure.
