# Project Skills Matrix

## 1. Frontend Skills (Next.js)

| Skill Name | Level | Why it is Needed | Tools/Libraries |
|---|---|---|---|
| **React Fundamentals** | Intermediate | Foundation for building component-based interfaces, managing component lifecycle, and implementing reusable UI elements following strict separation of concerns. | React 18+ |
| **Next.js (App Router)** | Advanced | Core framework used for server-side rendering (SSR), static site generation (SSG), and scalable routing. Essential for clean architectural layering. | Next.js (App Router) |
| **State Management** | Intermediate | Needed to handle complex application state (e.g., user sessions, infrastructure metrics) without prop-drilling or tight coupling between features. | Zustand, React Context API |
| **Forms & Validation** | Intermediate | Critical for capturing user input (e.g., adding assets, configuring settings) securely and efficiently with robust data validation interfaces. | React Hook Form, Zod |
| **API Integration & WebSockets** | Advanced | Required to fetch, mutate, and cache data efficiently. Specifically, relying on WebSockets to natively stream live telemetry data (e.g., ping status, active alerts) to the UI reacting to state passively without aggressive HTTP polling. | TanStack Query, Socket.io-client / Native WebSockets |
| **UI Frameworks** | Intermediate | Speeds up development while maintaining a highly aesthetic, responsive, and accessible user interface without cluttering source files with plain CSS. | Tailwind CSS, shadcn/ui, Radix UI |
| **Performance Optimization** | Advanced | Ensuring fast load times and smooth rendering of potentially heavy infrastructure topologies and large data tables. | Core Web Vitals, dynamic imports, React memoization |

## 2. Backend Skills (NestJS)

- **Core NestJS Architecture (Modules, Services, Controllers)**
  - *Description*: Strict adherence to modular architecture. Controllers handle routing, services handle business logic. Strongly emphasizes Dependency Injection (DI) and separation of concerns.
  - *Use Case*: Organizing the IT infrastructure management app into domain-specific modules (e.g., users, assets, networks) to allow independent evolution.

- **Multi-tenancy Architecture Context**
  - *Description*: Handling tenant context dynamically in middleware and routing. Context-aware services that automatically scope requests to the active tenant.
  - *Use Case*: Preventing data bleeding across completely decoupled organizations managing infrastructure on the same overarching application instance.

- **WebSockets (Real-time monitoring via Gateways)**
  - *Description*: Using NestJS WebSocket Gateways to establish persistent, bidirectional communication channels with the client.
  - *Use Case*: Streaming live telemetry data (e.g. ping status, active alerts) to the frontend, pushing actionable data passively rather than requiring aggressive HTTP polling loops over REST APIs.

- **Authentication & Authorization (JWT, RBAC)**
  - *Description*: Implementing secure stateless authentication and Role-Based Access Control to manage user permissions dynamically.
  - *Use Case*: Ensuring only authorized administrators can modify infrastructure settings, while restricting read-only users.

- **API Design (REST or GraphQL)**
  - *Description*: Designing predictable, well-versioned, and abstracted API endpoints using Data Transfer Objects (DTOs) to establish clear communication contracts.
  - *Use Case*: Serving structured data to the frontend or third-party integrations with strict boundaries on what is exposed.

- **Middleware, Guards, Interceptors**
  - *Description*: Utilizing NestJS lifecycle hooks for request processing, permission validation, and response transformation cleanly without muddying business logic.
  - *Use Case*: Logging (Middleware), verifying admin access & tenant isolation (Guards), and standardizing response formats/errors (Interceptors).

## 3. Database Skills (PostgreSQL)

- **Multi-tenancy Architecture (Data Isolation Options)**
  - *Description*: Designing database isolation schemas (Row-Level Security - RLS, or discrete separate schemas per tenant) alongside deep Prisma integration.
  - *Use Case*: Providing a database-level, structurally enforced boundary guaranteeing prevention of data bleeding across completely decoupled organizations managing infrastructure on the exact same hardware/instance.
- **Schema Design**: Designing properly abstraction-aligned, normalized schemas that model complex IT infrastructures.
- **Indexing**: Strategically applying B-Tree, Hash, or GiST indexes to speed up frequent queries on deeply relational data and highly filtered columns.
- **Query Optimization**: Analyzing `EXPLAIN` plans and resolving bottleneck queries (e.g., avoiding N+1 loops) to ensure the data layer remains scalable indefinitely.
- **Transactions**: Sustaining ACID properties when executing complex multi-step database writes to prevent state corruption across domains.

## 4. Cybersecurity Skills

*Note: As an IT Infrastructure Management platform, system security is the critical backbone. These skills are fundamentally required to protect enterprise telemetry and infrastructure configurations.*

- **OWASP Top 10 Mastery**
  - *Risk*: Exposure to the most common web vulnerabilities (Injection, Broken Auth, Security Misconfigurations).
  - *Mitigation*: Routine architecture reviews, deep security scanning, and universal developer adherence to defensive coding practices in all modules.

- **XSS, CSRF, and SQL/NoSQL Injection Prevention**
  - *Risk*: Unauthorized script execution in browsers, forced state changes, and database mass-compromise.
  - *Mitigation*: Utilizing framework defaults (React escaping), comprehensive input validation (Zod/Pipes), strict parameterized ORM queries via Prisma, and rigorous CORS/CSRF token policies.

- **Advanced Identity & Secure Authentication (Bcrypt, JWT, MFA, OAuth2)**
  - *Risk*: Password leaks, credential stuffing, and long-term session hijacking.
  - *Mitigation*: Hashing passwords with modern algorithms (Bcrypt/Argon2), enforcing extremely short JWT lifetimes, using secure HttpOnly cookies for rotation, and establishing zero-trust Multi-Factor Authentication (MFA).

- **Role-Based & Attribute-Based Access Control (RBAC & ABAC)**
  - *Risk*: Horizontal and vertical privilege escalation by untrusted users.
  - *Mitigation*: Baking granular access control into the folder architecture, enforced by backend Guards that evaluate user roles and organization tenant scopes dynamically on every request.

- **API & Network Security (WAF, Rate Limiting, DDoS Protection)**
  - *Risk*: Denial of Service (DoS) attacks, brute-force intrusion, and malformed request injections.
  - *Mitigation*: Utilizing Web Application Firewalls (WAF), global API rate limiters, aggressive throttling for authentication endpoints, and strict payload size limitations.

- **Data Encryption & Key Management (At Rest & In Transit)**
  - *Risk*: Physical loss of database media, exposure of credentials (e.g. third-party API keys), or network interception (Man-in-the-Middle).
  - *Mitigation*: Encrypting Postgres volumes natively (At Rest), strictly leveraging TLS 1.2+ (In Transit), and manually encrypting sensitive hardware secrets before database insertion using a secure Key Management Service.

- **Audit Logging & SIEM Integration**
  - *Risk*: Inability to trace malicious internal actions or debug structural misconfigurations without an immutable trail.
  - *Mitigation*: Logging every state mutation (who changed what, when, and the original state) to append-only tables, and exporting critical metrics to SIEM tools (e.g. ELK, Datadog) for anomaly intelligence.

- **Application Security Testing (SAST/DAST & Dependency Scanning)**
  - *Risk*: Introduction of known CVEs via third-party NPM packages or insecure code commits.
  - *Mitigation*: Automating Static/Dynamic Application Security Testing within CI/CD pipelines to block vulnerable dependencies before compilation.

- **Container & CI/CD Security**
  - *Risk*: Compromised Docker images or externally leaked pipeline secrets.
  - *Mitigation*: Running Docker containers with least-privilege, non-root users, utilizing verifiable image signing, and extracting all `.env` secrets safely into a dedicated secret manager (e.g., GitHub Secrets, Vault).

## 5. DevOps & Infrastructure Skills

- **Docker**: Containerizing frontend, backend, and infrastructure dependencies ensuring maximum environment parity and complete isolation between logical applications.
- **CI/CD Pipelines**: Automating testing, linting (preventing architecture regressions), building, and deploying directly upon merge.
- **Environment Management**: Hard boundary separation between config and code (`.env`), safely injecting environment variables without hardcoding secrets anywhere in the domain.
- **Reverse Proxy (NGINX)**: Distributing edge traffic strictly to respective internal interfaces, terminating SSL securely, and providing an abstraction over the backend micro-processes.
- **Monitoring (Observability)**: Instrumenting foundational container and resource monitoring (CPU, RAM, Connections).

## 6. AI-Assisted Development Skills

- **GitHub Copilot**
  - *Best Practices*: Use for writing deterministic unit test scaffolds, autocompleting repetitive typing, generating JSDoc comments, and fulfilling pre-designed structural templates.
  - *When to Use*: During granular, file-level coding tasks where the architectural context is already strictly defined and isolated.

- **Antigravity (Agent-Style AI / Architecture Guardian)**
  - *Best Practices*: Treat as your lead architect. Engage it to uphold separation of concerns, propose scalable modular folder structures, conduct dependency impact assessments, and cleanly extend legacy features.
  - *When to Use*: For project-wide feature planning, laying out foundational scaffolding, safely untangling coupled logic, and ensuring modifications preserve maximum future extensibility.

## 7. Additional Advanced Skills

- **Microservices Basics**: Grasping bounded context models and message broker abstraction (RabbitMQ/Kafka) as a structured evolution strategy when a NestJS monolith surpasses reasonable single-process scale.
- **Event-Driven Architecture**: Decoupling interdependent modules using an Event Bus (e.g. firing a disconnected `DeviceOffline` event that prompts autonomous responses from UI, notification, and logging domains without direct hard links).
