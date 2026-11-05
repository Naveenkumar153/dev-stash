# Test Action

1. Read current-feature.md to understand what was implemented
2. Identify server actions and utility functions added/modified for this feature
3. Check if tests already exist for these functions
4. For functions without tests that have testable logic, write unit tests:
   - Create unit tests using Vitest, following Testing in context/coding-standards.md
   - Focus on server actions and utilities (not components)
   - Colocate as `<file>.test.ts`, and mock Prisma, auth, email and Next APIs so no real service is reached
   - Test happy path and error cases
   - Do not write tests just to write them. Use your best judgement
5. Run `npm test` to verify all tests pass
6. Report test coverage for the new feature code