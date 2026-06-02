const fs = require('fs');
const path = require('path');

const srcBase = 'd:/Documentos D/Documentos Yoe/BeZhas/BeZhas Blockchain/Landing/stitch_bezhas_landing_redesign';
const destBase = 'd:/Documentos D/Documentos Yoe/BeZhas/BeZhas Blockchain/control-center/frontend/app/(landing)';

const mappings = [
  { folder: 'bezhas_commerce_tools', route: 'commerce', name: 'Commerce' },
  { folder: 'bezhas_bridges_assets', route: 'bridges', name: 'Bridges' },
  { folder: 'bezhas_developers_hub', route: 'developers', name: 'Developers' },
  { folder: 'bezhas_enterprise_solutions', route: 'enterprise', name: 'Enterprise' },
  { folder: 'bezhas_financial_solutions', route: 'financial', name: 'Financial' },
  { folder: 'bezhas_learn_documentation', route: 'learn', name: 'Learn' },
  { folder: 'bezhas_network_status', route: 'network', name: 'Network' },
  { folder: 'bezhas_payment_protocol', route: 'payments', name: 'Payments' },
  { folder: 'bezhas_rpc_services', route: 'rpc', name: 'RPC' },
  { folder: 'bezhas_solutions_rwa_depin', route: 'solutions', name: 'Solutions' },
  { folder: 'bezhas_validators_hub', route: 'validators', name: 'Validators' }
];

function htmlToJSX(html) {
  // Convert class= to className=
  let jsx = html.replace(/class=/g, 'className=');
  
  // Convert HTML comments <!-- --> to JSX {/* */}
  jsx = jsx.replace(/<!--(.*?)-->/g, '{/* $1 */}');
  
  // Auto-close specific tags
  jsx = jsx.replace(/<(img|input|br|hr)([^>]*?)(?<!\/)>/g, '<$1$2 />');
  
  // Handle some common style string replacements
  jsx = jsx.replace(/style="([^"]*)"/g, (match, styleString) => {
    if (styleString.includes('font-variation-settings')) {
      return `style={{ fontVariationSettings: "'FILL' 1" }}`;
    }
    // Generic simple strip for other inline styles which usually are not used in these tailwind designs
    return ''; 
  });
  
  // Fix specific SVG attributes if any
  jsx = jsx.replace(/stroke-width=/g, 'strokeWidth=');
  jsx = jsx.replace(/stroke-linecap=/g, 'strokeLinecap=');
  jsx = jsx.replace(/stroke-linejoin=/g, 'strokeLinejoin=');
  jsx = jsx.replace(/fill-rule=/g, 'fillRule=');
  jsx = jsx.replace(/clip-rule=/g, 'clipRule=');
  
  // Remove wrapper <main> because we already have it in layout.tsx, or keep it but change to <div>?
  // Layout.tsx has <main className="..."> {children} </main>.
  // So we extract inside first.
  const mainMatch = jsx.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    jsx = mainMatch[1];
  }

  // The code contains <section>, <div>, etc. We wrap in a Fragment
  return `<>\n${jsx}\n</>`;
}

for (const { folder, route, name } of mappings) {
  const srcFile = path.join(srcBase, folder, 'code.html');
  if (fs.existsSync(srcFile)) {
    const html = fs.readFileSync(srcFile, 'utf8');
    const jsxContent = htmlToJSX(html);
    
    const componentCode = `export default function ${name}Page() {\n  return (\n    ${jsxContent}\n  );\n}\n`;
    
    const destDir = path.join(destBase, route);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(destDir, 'page.tsx'), componentCode);
    console.log(`Converted ${folder} -> /${route}`);
  } else {
    console.log(`Skipped ${folder} (no code.html)`);
  }
}

// Special case: generate a Home page for /
const homeCode = `import Link from 'next/link';
export default function HomePage() {
  return (
    <section className="mb-12">
      <div className="max-w-6xl">
        <div className="bg-primary/20 backdrop-blur-md px-3 py-1 rounded border border-primary/30 inline-block mb-4">
          <span className="text-[10px] font-bold tracking-widest text-[#0d33f2] uppercase">Welcome to BeZhas</span>
        </div>
        <h1 className="text-7xl font-black italic tracking-tighter uppercase mb-4 leading-none">
          Enterprise <span className="text-[#0d33f2]">Ecosystem</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mb-8">
          The central hub for BeZhas Blockchain technology. Access developer tools, network metrics, enterprise solutions, and decentralized finance portals.
        </p>
        <div className="flex space-x-4">
          <Link href="/developers">
            <button className="bg-[#0d33f2] text-white px-8 py-3 font-bold tracking-widest uppercase italic text-sm hover:shadow-[0_0_20px_rgba(13,51,242,0.4)] transition-all">
              Initialize SDK
            </button>
          </Link>
          <Link href="/network">
            <button className="bg-white/5 border border-white/10 px-8 py-3 font-bold tracking-widest uppercase italic text-sm hover:bg-white/10 transition-all">
              Network Status
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(destBase, 'page.tsx'), homeCode);
console.log('Generated / (Home)');
