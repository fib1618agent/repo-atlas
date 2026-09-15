import json

with open('repos.json', 'r') as f:
    repos = json.load(f)

# Redefining heuristics for checking
heuristics = {
    "AI & Agents": ['ai', 'agent', 'gpt', 'llama', 'langchain', 'llm', 'nlp', 'openai', 'anthropic', 'agentic'],
    "Enterprise Java": ['java', 'spring', 'hibernate', 'maven', 'gradle', 'jakarta', 'jee', 'microservices', 'jpa', 'springboot', 'jms', 'ejb'],
    "Cloud & DevOps": ['docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'terraform', 'ansible', 'jenkins', 'ci-cd', 'devops', 'cloud', 'nginx', 'traefik', 'prometheus', 'grafana', 'compose'],
    "Web Development": ['react', 'vue', 'angular', 'nextjs', 'html', 'css', 'javascript', 'typescript', 'web', 'frontend', 'backend', 'express', 'node', 'tailwind', 'sass', 'bootstrap', 'ui', 'app', 'ionic', 'cordova'],
    "Data & Tools": ['data', 'sql', 'nosql', 'database', 'tool', 'cli', 'utility', 'script', 'automation', 'csv', 'json', 'redis', 'mongodb', 'postgresql', 'mysql', 'elasticsearch', 'algorithms', 'structure', 'deep-learning']
}

def classify(repo):
    name = repo['name'].lower()
    desc = (repo['description'] or "").lower()
    topics = [t.lower() for t in repo.get('topics', [])]
    lang = (repo['language'] or "").lower()
    combined = f"{name} {desc} {' '.join(topics)}"
    
    if any(h in combined for h in heuristics["AI & Agents"]): return "AI & Agents"
    if any(h in combined or lang == 'java' for h in heuristics["Enterprise Java"]): return "Enterprise Java"
    if any(h in combined for h in heuristics["Cloud & DevOps"]): return "Cloud & DevOps"
    if any(h in combined for h in heuristics["Web Development"]): return "Web Development"
    if any(h in combined for h in heuristics["Data & Tools"]): return "Data & Tools"
    return "Other"

others = [r for r in repos if classify(r) == "Other"]
for r in others:
    print(f"{r['name']} | {r['language']} | {r['description']}")
