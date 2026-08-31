import re

file_path = 'd:/Documentos D/Documentos Yoe/BeZhas/BeZhas Web/bezhas-web3/frontend/src/pages/LandingPage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make a backup
with open(file_path + '.bak', 'w', encoding='utf-8') as f:
    f.write(content)

replacements = {
    r'bg-black': 'bg-gray-50 dark:bg-black',
    r'bg-\[\#020203\]': 'bg-gray-100 dark:bg-[#020203]',
    r'bg-\[\#0f0f16\]': 'bg-white dark:bg-[#0f0f16]',
    r'bg-\[\#010105\]': 'bg-white dark:bg-[#010105]',
    r'text-white': 'text-gray-900 dark:text-white',
    r'text-gray-200': 'text-gray-800 dark:text-gray-200',
    r'text-gray-300': 'text-gray-700 dark:text-gray-300',
    r'text-gray-400': 'text-gray-600 dark:text-gray-400',
    r'text-gray-500': 'text-gray-500 dark:text-gray-500',
    r'border-white/5': 'border-gray-200 dark:border-white/5',
    r'border-white/10': 'border-gray-300 dark:border-white/10',
    r'border-white/20': 'border-gray-400 dark:border-white/20',
    r'bg-white/5': 'bg-gray-100 dark:bg-white/5',
    r'bg-white/10': 'bg-gray-200 dark:bg-white/10',
    r'shadow-black': 'shadow-gray-200 dark:shadow-black'
}

def replace_classes(match):
    class_str = match.group(1)
    
    # Simple word replacements
    for old, new in replacements.items():
        # Match exact class name without replacing partial strings
        class_str = re.sub(r'(?<!dark:)\b' + old + r'(?!\/)', new, class_str)
        # Handle cases like bg-[#010105]/60
        class_str = re.sub(r'(?<!dark:)\b' + old + r'(/[0-9]+)', new + r'\1', class_str)
        
    return 'className="' + class_str + '"'

# Regex to match className="..."
new_content = re.sub(r'className="([^"]*)"', replace_classes, content)

# But wait! We also have to handle template literals like className={`...`}
def replace_template_classes(match):
    class_str = match.group(1)
    
    for old, new in replacements.items():
        class_str = re.sub(r'(?<!dark:)\b' + old + r'(?!\/)', new, class_str)
        class_str = re.sub(r'(?<!dark:)\b' + old + r'(/[0-9]+)', new + r'\1', class_str)
        
    return 'className={`' + class_str + '`}'

new_content = re.sub(r'className=\{\`([^`]*)\`\}', replace_template_classes, new_content)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done applying dark/light modes')
