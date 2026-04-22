with open('/Users/clintbush/Documents/Projects/AipedApps/Drafts/WorkoutTracker/workout-tracker-ai/index.html', 'r') as f:
    content = f.read()

# Remove the inline <style> block (from <style>REMOVE_MARKER to </style>)
import re

# Remove the style block
content = re.sub(r'  <style>REMOVE_MARKER\n.*?  </style>\n', '', content, flags=re.DOTALL)

# Replace the inline <script>...</script> block with an external script reference
# The script block starts with <script>\n// ─────────────────────────────────────\n//  State
# and ends with boot();\n</script>
content = re.sub(r'<script>\n// ─.*?boot\(\);\n</script>', '<script src="app.js"></script>', content, flags=re.DOTALL)

# Also add chart.js back before app.js
content = content.replace('<script src="app.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>\n<script src="app.js"></script>')

with open('/Users/clintbush/Documents/Projects/AipedApps/Drafts/WorkoutTracker/workout-tracker-ai/index.html', 'w') as f:
    f.write(content)

print("Done. Lines:", content.count('\n'))
print(content[:500])
