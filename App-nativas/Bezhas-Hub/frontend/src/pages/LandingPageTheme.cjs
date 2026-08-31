const fs = require('fs');

const filePath = 'd:/Documentos D/Documentos Yoe/BeZhas/BeZhas Web/bezhas-web3/frontend/src/pages/LandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
    'bg-black': 'bg-gray-50 dark:bg-black',
    'bg-[#020203]': 'bg-gray-100 dark:bg-[#020203]',
    'bg-[#0f0f16]': 'bg-white dark:bg-[#0f0f16]',
    'bg-[#010105]': 'bg-white dark:bg-[#010105]',
    'text-white': 'text-gray-900 dark:text-white',
    'text-gray-200': 'text-gray-800 dark:text-gray-200',
    'text-gray-300': 'text-gray-700 dark:text-gray-300',
    'text-gray-400': 'text-gray-600 dark:text-gray-400',
    'text-gray-500': 'text-gray-500 dark:text-gray-500',
    'border-white/5': 'border-gray-200 dark:border-white/5',
    'border-white/10': 'border-gray-300 dark:border-white/10',
    'border-white/20': 'border-gray-400 dark:border-white/20',
    'bg-white/5': 'bg-gray-100 dark:bg-white/5',
    'bg-white/10': 'bg-gray-200 dark:bg-white/10',
    'shadow-black': 'shadow-gray-200 dark:shadow-black'
};

function processClassString(str) {
    let classes = str.split(/\s+/);
    let newClasses = [];
    for (let cls of classes) {
        // Find if cls starts with one of our keys or matches exactly
        let replaced = false;
        for (let [old, replace] of Object.entries(replacements)) {
            if (cls === old) {
                newClasses.push(replace);
                replaced = true;
                break;
            } else if (cls.startsWith(old + '/')) {
                // e.g. bg-[#010105]/60 -> bg-white/60 dark:bg-[#010105]/60
                const parts = replace.split(' ');
                // parts[0] is light class (bg-white), parts[1] is dark class (dark:bg-[#010105])
                const suffix = cls.substring(old.length); // /60
                newClasses.push(parts[0] + suffix + ' ' + parts[1] + suffix);
                replaced = true;
                break;
            }
        }
        if (!replaced) {
            newClasses.push(cls);
        }
    }
    return newClasses.join(' ');
}

// Replace in className="..."
content = content.replace(/className="([^"]*)"/g, (match, p1) => {
    return 'className="' + processClassString(p1) + '"';
});

// Replace in className={`...`}
content = content.replace(/className=\{`([^`]*)`\}/g, (match, p1) => {
    return 'className={`' + processClassString(p1) + '`}';
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated LandingPage.jsx with dark variants.');
