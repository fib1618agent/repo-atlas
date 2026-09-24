import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Linkedin, Mail, Phone, Languages, Coffee, GraduationCap, Award, BadgeCheck } from "lucide-react";
import { RepoAtlasLogo } from "@/components/atlas/RepoAtlasLogo";

export const Route = createFileRoute("/about")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "About — RepoAtlas" },
      { name: "description", content: "About Imdad Areeph — Lead Software Architect, AI Engineering & Distributed Systems." },
    ],
  }),
  component: AboutPage,
});

/* ── Data (from resume) ─────────────────────────────────────── */

const SKILL_GROUPS: { label: string; items: string[] }[] = [
  { label: "AI / LLM", items: ["Generative AI", "LLM Engineering", "Agentic AI", "Multi-Agent Systems", "AI Agents", "Agent Orchestration", "RAG", "Knowledge Graphs", "AI Memory", "Context Engineering", "LangChain", "Spec-Driven Development"] },
  { label: "Architecture", items: ["Distributed Systems", "Microservices", "Event-Driven Architecture", "Solution Architecture", "API Architecture", "Reactive Programming", "Scalability", "Reliability"] },
  { label: "Programming", items: ["Java 17", "Java 11", "Java 8", "Python", "JavaScript", "TypeScript", "SQL"] },
  { label: "Frameworks", items: ["Spring Boot", "Spring WebFlux", "Spring Cloud", "Project Reactor", "Hibernate", "JUnit 5", "Mockito"] },
  { label: "Messaging", items: ["Solace PubSub+", "Kafka", "RabbitMQ", "JMS", "Spring Cloud Stream"] },
  { label: "Databases", items: ["Couchbase", "PostgreSQL", "Oracle", "MongoDB", "MariaDB", "Neo4j", "PGVector", "Qdrant"] },
  { label: "Cloud / DevOps", items: ["AWS", "Kubernetes", "OpenShift", "Docker", "Jenkins", "Git", "Maven", "CI/CD"] },
  { label: "Security", items: ["OAuth2", "JWT", "Keycloak", "Spring Security", "Secrets Management", "HashiCorp Vault"] },
  { label: "Observability", items: ["OpenTelemetry", "Prometheus", "Grafana", "Datadog", "Splunk", "CloudWatch"] },
];

const PROJECTS = ["UAE Gems", "DevUtilz", "VibeConnect", "DevPrompts", "Pet Tracker AI", "RepoAtlas"];

const CERTIFICATIONS = [
  "Solace Event-Driven Architecture Certification",
  "Java Certification",
  "Spring Boot & Microservices Certification",
  "Linux Expert Certification",
  "Agile and Scrum Training",
];

const AWARDS = [
  "Najim Gold Award for Work Excellency",
  "GEM Award (On-the-Spot Award)",
  "Multiple Client Appreciations",
];

/* ── Small building blocks (atlas visual language) ──────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="atlas-eyebrow mb-2">{children}</p>;
}

function AtlasCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="atlas-chip">{children}</span>;
}

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="atlas-header sticky top-0 z-40">
        <RepoAtlasLogo />
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link to="/" className="atlas-nav-item">Explore</Link>
          <Link to="/catalogue" className="atlas-nav-item">Catalogue</Link>
          <Link to="/categories" className="atlas-nav-item">Categories</Link>
          <Link to="/insights" className="atlas-nav-item">Insights</Link>
          <span className="atlas-nav-item is-active">About</span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← Back to Atlas
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        {/* ── Header / hero ── */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionLabel>Profile</SectionLabel>
            <h1 className="text-3xl font-bold text-foreground">Imdad Areeph</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lead Software Architect · AI Engineering · Distributed Systems · Agentic AI
            </p>
            <div className="mt-4 flex items-center gap-4">
              <a
                href="https://github.com/imdadareeph"
                target="_blank" rel="noreferrer" aria-label="GitHub profile"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://www.linkedin.com/in/imdadareeph/"
                target="_blank" rel="noreferrer" aria-label="LinkedIn profile"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="mailto:imdadareeph@gmail.com"
                aria-label="Email"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-5 w-5" />
              </a>
              <a
                href="tel:+971507605159"
                aria-label="Phone"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Phone className="h-5 w-5" />
              </a>
            </div>
          </div>

          <a
            href="https://buymeacoffee.com/imdadareeph"
            target="_blank" rel="noopener noreferrer"
            className="group flex shrink-0 items-center gap-3 rounded-xl border border-[#FFDD00]/40 bg-[#FFDD00]/10 px-5 py-4 transition-colors hover:bg-[#FFDD00]/20"
          >
            <Coffee className="h-7 w-7 text-[#FFDD00]" />
            <span className="text-left">
              <span className="block text-sm font-semibold text-foreground">Buy Me a Coffee</span>
              <span className="block text-[11px] text-muted-foreground">Support the work behind RepoAtlas</span>
            </span>
          </a>
        </div>

        {/* ── Summary ── */}
        <AtlasCard>
          <SectionLabel>Professional Summary</SectionLabel>
          <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
            <li>Software engineering and architecture leader with <strong className="text-foreground">14+ years</strong> of experience designing and delivering scalable enterprise systems, event-driven microservices, cloud-native services, and AI-driven engineering solutions.</li>
            <li>Hands-on lead architect with deep experience in distributed systems, reactive Java, messaging platforms, observability, security architecture, API security, Kubernetes, AWS, and Generative AI.</li>
            <li>Experienced in agentic AI, multi-agent orchestration, RAG, knowledge graphs, contextual memory, AI-assisted software engineering, and AI-enabled SDLC workflows spanning requirements through production delivery.</li>
            <li>Strong experience across aviation, retail banking, healthcare, payments, and e-commerce domains, owning technical analysis, architecture, implementation, testing, deployment, and production support end to end.</li>
          </ul>
        </AtlasCard>

        {/* ── Core skills ── */}
        <section>
          <h2 className="mb-5 text-lg font-bold text-foreground">Core Technical Skills</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SKILL_GROUPS.map((group) => (
              <AtlasCard key={group.label}>
                <p className="mb-2.5 text-[11px] uppercase tracking-widest text-muted-foreground">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => <Chip key={item}>{item}</Chip>)}
                </div>
              </AtlasCard>
            ))}
          </div>
        </section>

        {/* ── Experience — reserved for a future 3D animation ── */}
        <section id="experience">
          <h2 className="mb-5 text-lg font-bold text-foreground">Experience</h2>
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 text-sm text-muted-foreground">
            3D experience visualization coming soon
          </div>
        </section>

        {/* ── AI / open-source projects ── */}
        <AtlasCard>
          <SectionLabel>AI Engineering, Open-Source &amp; Personal Projects</SectionLabel>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Built multiple AI-driven applications and prototypes around agent orchestration, RAG, knowledge retrieval, contextual memory, and knowledge graphs. Publishes technical content on generative AI, agentic engineering, and AI-assisted software development through the Agentic Coding Newsletter, alongside open-source contributions on GitHub.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PROJECTS.map((p) => <Chip key={p}>{p}</Chip>)}
          </div>
        </AtlasCard>

        {/* ── Certifications / Education / Awards ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AtlasCard>
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> Certifications
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {CERTIFICATIONS.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </AtlasCard>

          <AtlasCard>
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> Education
            </p>
            <p className="text-sm text-muted-foreground">
              B.Tech / B.E. in Computer Engineering — Visvesvaraya Technological University, Karnataka, India
            </p>
          </AtlasCard>

          <AtlasCard>
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Award className="h-3.5 w-3.5" /> Awards
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {AWARDS.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </AtlasCard>
        </div>

        {/* ── Contact / languages ── */}
        <AtlasCard>
          <SectionLabel>Contact</SectionLabel>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" /><span className="text-foreground">imdadareeph@gmail.com</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" /><span className="text-foreground">+971-507-605159</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Languages className="h-4 w-4 shrink-0" /><span className="text-foreground">English, Hindi/Urdu, Assamese</span>
            </div>
          </div>
        </AtlasCard>
      </div>
    </div>
  );
}
