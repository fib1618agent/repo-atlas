import json

with open('/tmp/exec-logs/47329b30-d70f-4c38-963e-bb18d0ca3f83.log', 'r') as f:
    content = f.read()
    # Split the two JSONs
    # The first one is the user object, the second one is the list of repos
    parts = content.split('\n[')
    repos_json = '[' + parts[1]
    repos = json.loads(repos_json)

languages = {}
topics = {}
archived_count = 0
fork_count = 0

for repo in repos:
    lang = repo.get('language')
    if lang:
        languages[lang] = languages.get(lang, 0) + 1
    
    repo_topics = repo.get('topics', [])
    for topic in repo_topics:
        topics[topic] = topics.get(topic, 0) + 1
    
    if repo.get('archived'):
        archived_count += 1
    if repo.get('fork'):
        fork_count += 1

print(f"Total Repos: {len(repos)}")
print(f"Archived: {archived_count}")
print(f"Forks: {fork_count}")
print(f"Languages: {dict(sorted(languages.items(), key=lambda item: item[1], reverse=True))}")
print(f"Topics: {dict(sorted(topics.items(), key=lambda item: item[1], reverse=True))}")

# Taxonomy derivation
# Look for patterns in repo names or descriptions to suggest categories
categories = {}
for repo in repos:
    name = repo['name'].lower()
    desc = (repo['description'] or "").lower()
    
    cat = "Uncategorized"
    if any(k in name or k in desc for k in ['app', 'mobile', 'android', 'ios']):
        cat = "Mobile Applications"
    elif any(k in name or k in desc for k in ['api', 'server', 'backend', 'service']):
        cat = "Backend/Services"
    elif any(k in name or k in desc for k in ['ui', 'frontend', 'web', 'react', 'css']):
        cat = "Frontend/Web"
    elif any(k in name or k in desc for k in ['bot', 'slack', 'discord']):
        cat = "Bots/Integrations"
    elif any(k in name or k in desc for k in ['config', 'dotfiles', 'setup', 'scripts']):
        cat = "Tools/Config"
    
    categories[cat] = categories.get(cat, 0) + 1

print(f"Suggested Categories: {categories}")
