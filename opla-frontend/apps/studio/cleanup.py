import re

path = r"c:\Users\kings\Dev Projects\opla\opla-frontend\apps\studio\src\pages\ProjectWorkspace.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove 'Search,' import
content = re.sub(r'^\s*Search,\s*\n', '', content, flags=re.MULTILINE)

# Remove unused const structures
content = re.sub(r'const taskStatusTone: Record<string, string> = {[^}]+};\s*\n', '', content)
content = re.sub(r"const compactInputClassName = '.*?';\s*\n", '', content)
content = re.sub(r"const compactSelectClassName = '.*?';\s*\n", '', content)

# Remove unused states
states_to_remove = [
    r"const \[savingStatus, setSavingStatus\] = useState\(false\);\s*\n",
    r"const \[savingAccess, setSavingAccess\] = useState\(false\);\s*\n",
    r"const \[updatingArtifactId, setUpdatingArtifactId\] = useState<string \| null>\(null\);\s*\n",
    r"const \[deletingArtifactId, setDeletingArtifactId\] = useState<string \| null>\(null\);\s*\n",
    r"const \[memberSearch, setMemberSearch\] = useState\(''\);\s*\n",
    r"const \[formSearch, setFormSearch\] = useState\(''\);\s*\n",
    r"const \[taskSearch, setTaskSearch\] = useState\(''\);\s*\n",
    r"const \[reportSearch, setReportSearch\] = useState\(''\);\s*\n",
    r"const \[accessorType, setAccessorType\] = useState<'user' \| 'team'>\('user'\);\s*\n"
]
for state in states_to_remove:
    content = re.sub(state, '', content)

# Remove unused memos/vars
content = re.sub(r"const reportHealth = useMemo\(\([^)]*\) => \{[^\}]+\}, \[[^\]]+\]\);\s*\n", '', content)
content = re.sub(r"const getRoleTemplateOptionLabel = \([^\)]*\) => \{[^\}]+\};\s*\n", '', content)

# Remove projectLeadLabel useMemo block
content = re.sub(r"const projectLeadLabel = useMemo\(\(\) => \{[^\}]+\}[^\}]+\}[^\}]+\}, \[[^\]]+\]\);\s*\n", '', content)
# Ensure we got projectLeadLabel completely
content = re.sub(r"const projectLeadLabel = useMemo\(\(\) => \{.+?return leadRule \? resolveRuleLabel\(leadRule\) : 'Not set';\s*\}, \[accessRules, members, teams\]\);\s*\n", '', content, flags=re.DOTALL)

# Remove projectGuestLabel block
content = re.sub(r"const viewerCount = useMemo\([\s\S]+?\](?:,|\s)*\);\s*\n", '', content)
content = re.sub(r"const projectGuestLabel = .*?;\s*\n", '', content)

# Remove handleStatusChange
content = re.sub(r"const handleStatusChange = async \([^\)]*\) => \{[\s\S]+?\}\s*};\s*\n", '', content)

# Remove handleReportResponsibilityChange
content = re.sub(r"const handleReportResponsibilityChange = async \([\s\S]+?\}\s*};\s*\n", '', content)

# Fix sets where updating/deleting artifacts was called
content = re.sub(r"setSavingStatus\(true\);\s*\n", '', content)
content = re.sub(r"setSavingStatus\(false\);\s*\n", '', content)
content = re.sub(r"setSavingAccess\(true\);\s*\n", '', content)
content = re.sub(r"setSavingAccess\(false\);\s*\n", '', content)
content = re.sub(r"setUpdatingArtifactId\([^)]*\);\s*\n", '', content)
content = re.sub(r"setDeletingArtifactId\([^)]*\);\s*\n", '', content)
content = re.sub(r"accessorType: accessorType,", "accessorType: 'user',", content)


with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("Cleaned up unused variables.")
