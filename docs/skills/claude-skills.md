# Claude Skills

Generated 2026-09-25. Invoke with `/<skill-name>` or via the Skill tool.

## AWS

| Skill | Purpose |
|---|---|
| aws-ai-ml | SageMaker fine-tuning, model selection, deployment, endpoint diagnostics |
| aws-auth | Cognito user/identity pools, Amplify auth, OAuth/OIDC, tokens, API authorizers |
| aws-billing-and-cost-management | Cost analysis, budgets, Savings Plans/RIs, Compute Optimizer, CUR, Free Tier |
| aws-blocks | AWS Blocks Infrastructure-from-Code framework |
| aws-cdk | CDK (TypeScript/Python) authoring, deploy, troubleshooting |
| aws-cloudformation | Template authoring, cfn-lint/cfn-guard validation, failed-stack diagnosis |
| aws-compute | EC2, Auto Scaling, IMDSv2, AMIs, Systems Manager |
| aws-containers | EKS, ECS, Fargate, ECR, Elastic Beanstalk |
| aws-database | Routes database tasks (Aurora, DynamoDB, RDS, DocumentDB, Neptune, etc.) |
| aws-deployment | CodePipeline, CodeBuild, CodeDeploy, CodeArtifact, CodeConnections |
| aws-iam | IAM policies, trust policies, STS, Organizations, service roles |
| aws-messaging-and-streaming | SQS, SNS, EventBridge, MQ, Kinesis, Firehose, Flink, MSK |
| aws-networking | Route 53, CloudFront, Transit Gateway, Direct Connect, VPN, WAF, Shield |
| aws-observability | CloudWatch, Application Signals, Log Insights, alarms |
| aws-security | Security Hub, GuardDuty, Inspector, Macie, Detective, Security Lake |
| aws-serverless | Lambda, API Gateway, Step Functions, EventBridge, SAM |
| aws-storage | S3, EFS, FSx, EBS selection, migration, cost |
| amazon-bedrock | Bedrock model invocation, Knowledge Bases, Agents, Guardrails, AgentCore |
| aws-sdk-js-v3-usage | AWS SDK for JavaScript v3 patterns |
| aws-sdk-python-usage | boto3/botocore patterns |
| aws-sdk-swift-usage | AWS SDK for Swift patterns |
| launch-with-aws | Launch workflow on AWS |
| setting-up-cloudwatch-observability | First-time CloudWatch/Omni setup |
| signing-in-to-aws | AWS sign-in helper |

## Cloudflare

| Skill | Purpose |
|---|---|
| cloudflare / cloudflare:cloudflare | General Cloudflare platform |
| agents-sdk / cloudflare:agents-sdk | Cloudflare Agents SDK apps |
| cloudflare-email-service | Cloudflare Email Service |
| cloudflare-one | Cloudflare One (Zero Trust) |
| cloudflare-one-migrations | Migrations to Cloudflare One |
| durable-objects | Durable Objects |
| nextjs-on-cloudflare | Next.js on Cloudflare |
| sandbox-migrate-to-next, sandbox-next, sandbox-stable | Cloudflare Sandbox SDK |
| turnstile-spin | Turnstile |
| web-perf | Web performance |
| workers-best-practices | Workers best practices |
| wrangler | Wrangler CLI |

(Each also available with the `cloudflare:` prefix.)

## SuperClaude Commands

`analyze`, `build`, `cleanup`, `deploy`, `design`, `dev-setup`, `document`, `estimate`, `explain`, `git`, `improve`, `index`, `load`, `migrate`, `review`, `scan`, `spawn`, `task`, `test`, `troubleshoot`

## Design & Frontend

| Skill | Purpose |
|---|---|
| frontend-design | Frontend design |
| frontend-dev | Frontend development |
| design-review | Design review |
| impeccable-design-polish | Design polish |
| enhance-prompt | Prompt enhancement |
| shadcn-ui | shadcn/ui components |
| figma-implement-design | Implement Figma designs |
| web-design-guidelines | Web design guidelines |
| threejs | Three.js |
| remotion | Remotion video |
| copywriting | Copywriting |
| mcpmarket-me:font-recommendations | Font recommendations |
| dataviz | Charts, dashboards, visualizations |
| artifact-design, artifact-diagramming, artifact-capabilities | Artifact page authoring |

## Documents, Media & Browser

| Skill | Purpose |
|---|---|
| doc, anthropic-skills:docx | Word documents |
| pptx, anthropic-skills:pptx | PowerPoint |
| anthropic-skills:pdf | PDF |
| anthropic-skills:xlsx | Excel |
| anthropic-skills:docs | Docs |
| viewmd | Render markdown files |
| screenshot, full-page-screenshot | Screenshots |
| youtube-clipper | YouTube clipping |
| agent-browser | Browser automation CLI |
| claude-in-chrome | Chrome automation |

## Obsidian / Wiki (claude-obsidian)

`autoresearch`, `canvas`, `save`, `wiki`, `defuddle`, `obsidian-bases`, `obsidian-markdown`, `think`, `wiki-cli`, `wiki-fold`, `wiki-ingest`, `wiki-lint`, `wiki-mode`, `wiki-query`, `wiki-retrieve`

## Style Modes

| Skill | Purpose |
|---|---|
| caveman:caveman (+ cavecrew, caveman-commit, caveman-compress, caveman-help, caveman-review, caveman-stats) | Terse response mode |
| ponytail:ponytail (+ ponytail-audit, ponytail-debt, ponytail-gain, ponytail-help, ponytail-review) | Minimal-code mode |

## Code Quality & Workflow

| Skill | Purpose |
|---|---|
| brainstorming | Turn ideas into designs |
| code-review | Diff/PR review |
| simplify | Reuse/simplification cleanup |
| security-review | Security review |
| pr-feedback-quality-gate | PR feedback gate |
| graphify | Knowledge graph from code/docs |
| run | Launch and drive the project app |
| init | Create CLAUDE.md |
| claude-api | Claude API / Anthropic SDK reference |

## Claude Code Configuration

| Skill | Purpose |
|---|---|
| update-config | settings.json, hooks, permissions, env |
| keybindings-help | Keyboard shortcuts |
| fewer-permission-prompts | Build a permission allowlist |
| loop | Recurring/self-paced runs |
| schedule | Scheduled cloud agents |
| anthropic-skills:skill-creator | Create skills |
| anthropic-skills:import-memory | Import memory |
| anthropic-skills:morning | Morning routine |

## Agents

Invoke via the Agent tool with `subagent_type`.

### Built-in

| Agent | Purpose |
|---|---|
| claude, general-purpose | Catch-all multi-step tasks and searches |
| Explore | Read-only broad search across many files |
| Plan | Implementation planning, no edits |
| claude-code-guide | Questions on Claude Code, Agent SDK, Claude API |
| statusline-setup | Configure status line |

### Engineering

| Agent | Purpose |
|---|---|
| Backend Architect | Scalable backend, DB, API, cloud design |
| Frontend Developer | React/Vue/Angular, UI, performance |
| Senior Developer | Laravel/Livewire/FluxUI, advanced CSS, Three.js |
| Software Architect | System design, DDD, architectural decisions |
| Rapid Prototyper | Fast PoC/MVP |
| Minimal Change Engineer | Minimum-viable diffs, no scope creep |
| Code Reviewer | Correctness, maintainability, security review |
| Codebase Onboarding Engineer | Explain unfamiliar codebases from source |
| Codebase Archaeologist | Multi-tool drift, dead code, doc-vs-code divergence |
| Git Workflow Master | Branching, conventional commits, rebasing, worktrees |
| DevOps Automator | CI/CD, infra automation |
| SRE (Site Reliability Engineer) | SLOs, error budgets, observability |
| Developer Tooling Engineer | CLI/internal dev tools DX |
| API Platform Engineer | Contract-first APIs, versioning, SDKs, gateways |
| MCP Builder | Design/build/test MCP servers |
| LSP/Index Engineer | LSP clients, semantic indexing |
| Database Optimizer | Schema, queries, indexing |
| Data Engineer | Pipelines, lakehouse, Spark, dbt |
| Data Visualization Engineer | D3/Vega, honest, accessible charts |

### AI & Agents

| Agent | Purpose |
|---|---|
| AI Engineer | ML models, deployment, AI features |
| Prompt Engineer | Craft and optimize LLM prompts |
| RAG Pipeline Engineer | Chunking, hybrid search, re-ranking, evals |
| Multi-Agent Systems Architect | Agent topology, context, trust, failure recovery |
| Knowledge Graph Engineer | Entities/relationships, context navigation |

### Security

| Agent | Purpose |
|---|---|
| Application Security Engineer | Threat modeling, secure review, SAST/DAST |
| AI-Generated Code Security Auditor | Secrets, RLS, prompt-injection in vibe-coded apps |
| Secrets & Credential Hygiene Engineer | Secret detection, vaulting, rotation, leak response |

### QA & Testing

| Agent | Purpose |
|---|---|
| API Tester | API validation, performance, integration QA |
| Test Automation Engineer | Playwright/Cypress, flake elimination |
| Performance Benchmarker | Measure and optimize performance |
| Evidence Collector | Screenshot-backed QA |
| Reality Checker | Evidence-based production-readiness gate |
| Accessibility Auditor | WCAG audits, assistive-tech testing |

### Design & UX

| Agent | Purpose |
|---|---|
| UI Designer | Visual design systems, components |
| UX Architect | CSS systems, implementation foundations |
| UX Researcher | Usability testing, behavior analysis |

### Geospatial & Immersive

| Agent | Purpose |
|---|---|
| Web GIS Developer | MapLibre, ArcGIS JS, Leaflet apps |
| Spatial Data Engineer | Geospatial ETL, CRS reprojection |
| 3D & Scene Developer | Cesium, ArcGIS Scene Viewer, 3D web |
| XR Immersive Developer | WebXR AR/VR |

### Product, Content & Research

| Agent | Purpose |
|---|---|
| Product Manager | Product lifecycle, roadmap, GTM |
| Technical Writer | Docs, API refs, READMEs, tutorials |
| Developer Advocate | DX, community, technical content |
| Content Creator | Multi-platform content strategy |
| LinkedIn Content Creator | LinkedIn thought leadership |
| SEO Specialist | Technical SEO, organic growth |
| Analytics Reporter | Dashboards, KPIs, insights |
| Feedback Synthesizer | User feedback into priorities |
| Trend Researcher | Market intelligence, competitive analysis |
| Investment Researcher | Due diligence, portfolio, valuation |
| Research Synthesist | Literature review, evidence synthesis |
| Statistician | Experimental design, inference |
| Tool Evaluator | Tool/platform assessment |
| Master Plan Architect | Deep plans and red-team critique, no code |
| ZK Steward | Zettelkasten knowledge-base stewardship |

### Plugin agents

| Agent | Purpose |
|---|---|
| caveman:cavecrew-builder | Surgical 1-2 file edits |
| caveman:cavecrew-investigator | Read-only code locator (file:line table) |
| caveman:cavecrew-reviewer | One-line-per-finding diff review |
| claude-obsidian:verifier | Pre-commit staged-diff audit |
| claude-obsidian:wiki-ingest | Parallel wiki source ingestion |
| claude-obsidian:wiki-lint | Wiki health check |
