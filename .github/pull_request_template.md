## Pull Request Checklist

Please ensure all items below are completed before requesting review:

- [ ] Branch is named `feature/*` and is up to date with `develop`
- [ ] Database migrations rebuild cleanly from empty (`npm run db:reset`)
- [ ] Tests added and passing (`npm run db:test`)
- [ ] `EXPLAIN ANALYZE` checked for new or changed SQL queries
- [ ] No secrets or sensitive credentials committed in code or configuration
- [ ] Documentation and Swagger/OpenAPI specifications updated to match changes
- [ ] At least one reviewer approved before merging
