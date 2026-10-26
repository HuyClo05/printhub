# AWS Deployment (planned)

Nothing in this repository deploys to AWS yet. There is no CDK app. This page records the target so the self-hosted design stays portable.

## Target mapping

| Role | Self-hosted (today) | AWS (planned) |
|---|---|---|
| Frontend | Caddy serving the React bundle | S3 + CloudFront |
| Identity | Keycloak | Cognito (same OIDC + PKCE flow) |
| API | FastAPI container | FastAPI on ECS Fargate, private subnets |
| Database | PostgreSQL 17 | RDS PostgreSQL |
| Object storage | SeaweedFS | Private S3 bucket |
| Queue | `print_tasks` with leases in PostgreSQL | Same table, or SQS + DLQ |
| Slicer | Private Compose service | Localhost-only sidecar next to the worker |
| Secrets | `.ph_env` | Secrets Manager + IAM task roles |
| Observability | None | CloudWatch, X-Ray |
| CI/CD | None | GitHub Actions + ECR via GitHub OIDC |
| Printer agent | Outbound HTTPS polling | Unchanged |

## Portability rules already in the code

- The API only needs `OIDC_ISSUER`, `OIDC_JWKS_URL` and optionally `OIDC_AUDIENCE`, so Cognito drops in.
- Leaving `S3_ENDPOINT` unset makes boto3 use regional AWS S3.
- The browser receives only public `VITE_*` values.

## Before deploying

- Create an AWS Budget alarm (planned at $20, alerts at 50/80/100 %) before any always-on resource.
- Rough planning cost: about $92/month always-on, about $25/month if destroyed between sessions. NAT gateway, load balancer and RDS dominate. Confirm current prices.
- Set Cognito callback/logout URLs to the exact CloudFront host, and S3 CORS for signed browser uploads without making the bucket public.
