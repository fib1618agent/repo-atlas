import json

with open('repos.json', 'r') as f:
    repos = json.load(f)

heuristics = {
    "AI & Agents": ['ai', 'agent', 'gpt', 'llama', 'langchain', 'llm', 'nlp', 'openai', 'anthropic', 'agentic', 'brain', 'knowledge-forge'],
    "Enterprise Java": ['java', 'spring', 'hibernate', 'maven', 'gradle', 'jakarta', 'jee', 'microservices', 'jpa', 'springboot', 'jms', 'ejb', 'ossrh'],
    "Cloud & DevOps": ['docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'terraform', 'ansible', 'jenkins', 'ci-cd', 'devops', 'cloud', 'nginx', 'traefik', 'prometheus', 'grafana', 'compose', 'vnc'],
    "Web Development": ['react', 'vue', 'angular', 'nextjs', 'html', 'css', 'javascript', 'typescript', 'web', 'frontend', 'backend', 'express', 'node', 'tailwind', 'sass', 'bootstrap', 'ui', 'app', 'ionic', 'cordova', 'auth', 'admin', 'tracker', 'hub', 'portfolio', 'cv', 'me', 'website', 'portal', 'liquid'],
    "Data & Tools": ['data', 'sql', 'nosql', 'database', 'tool', 'cli', 'utility', 'script', 'automation', 'csv', 'json', 'redis', 'mongodb', 'postgresql', 'mysql', 'elasticsearch', 'algorithms', 'structure', 'docs', 'api', 'collection', 'postman']
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

categories = {c: [] for c in heuristics.keys()}
categories["Other"] = []

for repo in repos:
    cat = classify(repo)
    categories[cat].append(repo)

print(f"User: imdadareeph")
print(f"Total Repositories: {len(repos)}")
for cat, r_list in categories.items():
    print(f"{cat}: {len(r_list)}")

# Selection strategy for 12 representative repos
# Prioritize stars, then diversity
representative = []
cat_order = ["AI & Agents", "Enterprise Java", "Cloud & DevOps", "Web Development", "Data & Tools", "Other"]
pointers = {c: 0 for c in cat_order}

# 2 from each category first
for cat in cat_order:
    sorted_cat = sorted(categories[cat], key=lambda x: (x.get('stargazers_count', 0), x.get('pushed_at', '')), reverse=True)
    representative.extend(sorted_cat[:min(2, len(sorted_cat))])

# Fill the rest with most starred
if len(representative) < 12:
    remaining = [r for r in repos if r not in representative]
    remaining.sort(key=lambda x: (x.get('stargazers_count', 0), x.get('pushed_at', '')), reverse=True)
    representative.extend(remaining[:12-len(representative)])

print("\n--- 12 Representative Repositories ---")
for i, r in enumerate(representative[:12], 1):
    cat = classify(r)
    stars = r['stargazers_count']
    lang = r['language'] or "N/A"
    desc = r['description'] or "No description"
    print(f"{i}. {r['name']} ({lang}) - Category: {cat}, Stars: {stars}")
    print(f"   Description: {desc}")
