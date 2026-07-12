# Update

Before updating, create a database backup and read the release notes.

```bash
git pull --ff-only
docker compose pull
docker compose up --build -d
```

Flyway services run before the application services and apply pending migrations. Use explicit image tags in long-running installations when reproducibility matters.
